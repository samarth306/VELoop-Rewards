"""Offline contract checks for the VELOOP Rewards source tree.

These tests intentionally do not connect to MongoDB or claim live integration coverage.
"""
from pathlib import Path
import ast
import unittest

ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT / "backend/app/main.py").read_text(encoding="utf-8")
COLLECTIONS = (ROOT / "backend/app/collections.py").read_text(encoding="utf-8")
FRONTEND = (ROOT / "frontend/src/App.jsx").read_text(encoding="utf-8")


class ProjectContractTests(unittest.TestCase):
    def test_backend_python_parses(self):
        for path in (ROOT / "backend").rglob("*.py"):
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))

    def test_payout_reads_are_database_backed(self):
        self.assertIn('payout_options_collection.find_one(', MAIN)
        self.assertIn('payout_options_collection.find(', MAIN)
        self.assertIn('payout_options_collection.update_one(', MAIN)
        self.assertIn('"$setOnInsert"', MAIN)
        self.assertIn("upsert=True", MAIN)

    def test_pdf_payout_mapping_is_configured_in_seed(self):
        import re

        expected = [
            (10, 2400),
            (25, 5800),
            (50, 10000),
            (100, 19500),
            (150, 28500),
            (300, 52500),
            (500, 80500),
            (1000, 150000),
        ]

        tree = ast.parse(MAIN)
        options_node = next(
            node for node in tree.body
            if isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name)
                and target.id == "PAYOUT_OPTIONS"
                for target in node.targets
            )
        )
        options = ast.literal_eval(options_node.value)

        for option in options:
            denominations = {
                (item["payout_value"], item["required_amount"])
                for item in option.get("denominations", [])
            }
            self.assertEqual(denominations, set(expected))

    def test_gift_card_methods_are_backend_configured(self):
        tree = ast.parse(MAIN)
        options_node = next(
            node for node in tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == "PAYOUT_OPTIONS" for target in node.targets)
        )
        options = ast.literal_eval(options_node.value)
        methods = {item["method_id"]: item for item in options}
        for method_id, expected_type in (
            ("amazon_gift_card", "AMAZON_GIFT_CARD"),
            ("google_play_gift_card", "GOOGLE_PLAY_GIFT_CARD"),
        ):
            self.assertIn(method_id, methods)
            self.assertEqual(methods[method_id]["type"], expected_type)
            self.assertTrue(methods[method_id]["active"])
            self.assertEqual(
                {(d["payout_value"], d["required_amount"]) for d in methods[method_id]["denominations"]},
                {(10, 2400), (25, 5800), (50, 10000), (100, 19500), (150, 28500), (300, 52500), (500, 80500), (1000, 150000)},
            )
        self.assertIn('payout_type in {"AMAZON_GIFT_CARD", "GOOGLE_PLAY_GIFT_CARD"}', MAIN)
        self.assertNotIn("Gift-card redemption is not configured yet", FRONTEND)
        self.assertIn("giftCardEmail", FRONTEND)

    def test_payout_startup_migrates_known_defaults_and_seeds_giftcards(self):
        tree = ast.parse(MAIN)
        payout_node = next(
            node for node in tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == "PAYOUT_OPTIONS" for target in node.targets)
        )
        startup_node = next(
            node for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "initialize_payout_configuration"
        )
        current_options = ast.literal_eval(payout_node.value)
        previous_release_default = [(10, 1000), (25, 2500), (50, 5000), (100, 10000), (150, 15000), (300, 30000), (500, 50000), (1000, 100000)]

        class FakePayoutCollection:
            def __init__(self, initial):
                self.items = {item["method_id"]: dict(item) for item in initial}
                self.index_created = False

            def update_one(self, query, update, upsert=False):
                method_id = query["method_id"]
                item = self.items.get(method_id)
                if item is None and upsert and "$setOnInsert" in update:
                    self.items[method_id] = dict(update["$setOnInsert"])
                    return
                if item is not None and "$set" in update:
                    item.update(update["$set"])

            def find_one(self, query, projection=None):
                item = self.items.get(query["method_id"])
                return dict(item) if item else None

            def create_index(self, *args, **kwargs):
                self.index_created = True

        initial = []
        for option in current_options[:3]:
            old = dict(option)
            old["denominations"] = [
                {"payout_value": payout, "required_amount": ves}
                for payout, ves in previous_release_default
            ]
            initial.append(old)

        fake_collection = FakePayoutCollection(initial)
        namespace = {"PAYOUT_OPTIONS": current_options, "payout_options_collection": fake_collection, "now_utc": lambda: "test-time"}
        startup_node.decorator_list = []  # Evaluate the real function without FastAPI's decorator.
        exec(compile(ast.Module(body=[startup_node], type_ignores=[]), "backend/app/main.py", "exec"), namespace)
        namespace["initialize_payout_configuration"]()

        self.assertTrue(fake_collection.index_created)
        self.assertEqual(set(fake_collection.items), {item["method_id"] for item in current_options})
        for item in current_options:
            stored = fake_collection.items[item["method_id"]]
            expected = {(d["payout_value"], d["required_amount"]) for d in item["denominations"]}
            actual = {(d["payout_value"], d["required_amount"]) for d in stored["denominations"]}
            self.assertEqual(actual, expected)

        # Operator-customized values must not be overwritten by the compatibility migration.
        custom = dict(current_options[0])
        custom["denominations"] = [{"payout_value": 10, "required_amount": 777}]
        custom_collection = FakePayoutCollection([custom])
        namespace["payout_options_collection"] = custom_collection
        namespace["initialize_payout_configuration"]()
        self.assertEqual(
            custom_collection.items["upi"]["denominations"],
            [{"payout_value": 10, "required_amount": 777}],
        )


    def test_gift_card_email_validation_normalizes_and_rejects_invalid(self):
        import re

        tree = ast.parse(MAIN)
        validator = next(
            node for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "validate_payout_details"
        )

        class FakeHTTPException(Exception):
            def __init__(self, status_code, detail):
                super().__init__(detail)
                self.status_code = status_code
                self.detail = detail

        configured_types = {
            "amazon_gift_card": "AMAZON_GIFT_CARD",
            "google_play_gift_card": "GOOGLE_PLAY_GIFT_CARD",
        }
        namespace = {
            "re": re,
            "HTTPException": FakeHTTPException,
            "get_payout_option": lambda option_id: {"type": configured_types[option_id]},
        }
        isolated = ast.Module(body=[validator], type_ignores=[])
        exec(compile(isolated, "backend/app/main.py", "exec"), namespace)
        validate = namespace["validate_payout_details"]

        for option_id in configured_types:
            self.assertEqual(
                validate(option_id, {"email": "  Gift.Test@Example.com "}),
                {"email": "gift.test@example.com"},
            )
            with self.assertRaises(FakeHTTPException) as raised:
                validate(option_id, {"email": "not-an-email"})
            self.assertEqual(raised.exception.status_code, 422)


    def test_startup_migrates_only_known_legacy_payout_defaults(self):
        self.assertIn("previous_release_default_denominations", MAIN)
        self.assertIn('current_pairs == previous_release_default_denominations', MAIN)
        self.assertIn('"$setOnInsert"', MAIN)


    def test_withdrawal_requires_idempotency_key(self):
        tree = ast.parse(MAIN)
        model = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "WithdrawalRequest")
        fields = {n.target.id: n.value for n in model.body if isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name)}
        self.assertIn("request_id", fields)
        self.assertIsInstance(fields["request_id"], ast.Call)
        self.assertTrue(any(k.arg == "min_length" and isinstance(k.value, ast.Constant) and k.value.value == 8 for k in fields["request_id"].keywords))

    def test_withdrawal_lifecycle_and_refund_exist(self):
        self.assertIn('/admin/withdrawals/{withdrawal_id}/status', MAIN)
        self.assertIn('"WITHDRAWAL_REFUND"', MAIN)
        self.assertIn('"withdrawal_rejection"', MAIN)

    def test_unique_ownership_indexes_are_declared(self):
        self.assertIn('name="unique_user_email", unique=True', COLLECTIONS)
        self.assertIn('name="unique_wallet_user", unique=True', COLLECTIONS)

    def test_sensitive_route_throttling_exists(self):
        self.assertIn('def throttle_sensitive_requests', MAIN)
        self.assertIn('status_code=429', MAIN)

    def test_removed_spin_feature_stays_out_of_frontend(self):
        self.assertNotRegex(FRONTEND.lower(), r'\bspin(s)?\b')

    def test_frontend_uses_backend_payout_endpoint(self):
        self.assertIn('"/payout-options"', FRONTEND)
        self.assertNotIn('const PAYOUT_OPTIONS = [', FRONTEND)


if __name__ == "__main__":
    unittest.main(verbosity=2)
