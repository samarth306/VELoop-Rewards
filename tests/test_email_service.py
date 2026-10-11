import io
import json
import os
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from backend.app.email_service import send_reset_email


class EmailServiceTests(unittest.TestCase):
    @patch.dict(os.environ, {
        "FRONTEND_URL": "https://veloop-rewards-frontend-ggzf.onrender.com",
        "RESEND_API_KEY": "re_test_secret",
        "RESEND_FROM": "VELOOP Rewards <noreply@example.com>",
    }, clear=True)
    @patch("backend.app.email_service.urlopen")
    def test_resend_sends_production_root_link(self, mocked_urlopen):
        response = MagicMock()
        response.status = 200
        response.read.return_value = b'{"id":"email-id"}'
        mocked_urlopen.return_value.__enter__.return_value = response
        self.assertTrue(send_reset_email("person@example.com", "random-token", 30))
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.resend.com/emails")
        self.assertEqual(request.get_header("Authorization"), "Bearer re_test_secret")
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["to"], ["person@example.com"])
        self.assertIn("/?token=random-token", payload["text"])
        self.assertIn("30 minutes", payload["text"])

    @patch.dict(os.environ, {}, clear=True)
    def test_no_provider_configuration_returns_false(self):
        self.assertFalse(send_reset_email("person@example.com", "token"))

    @patch.dict(os.environ, {
        "FRONTEND_URL": "https://veloop-rewards-frontend-ggzf.onrender.com",
        "RESEND_API_KEY": "re_test_secret",
        "RESEND_FROM": "VELOOP Rewards <noreply@example.com>",
    }, clear=True)
    @patch("backend.app.email_service.urlopen")
    def test_http_error_is_sanitized(self, mocked_urlopen):
        mocked_urlopen.side_effect = HTTPError(
            "https://api.resend.com/emails", 401, "unauthorized", {},
            io.BytesIO(b"response body must not leak"),
        )
        with self.assertRaisesRegex(RuntimeError, "HTTP 401") as raised:
            send_reset_email("person@example.com", "private-token")
        self.assertNotIn("re_test_secret", str(raised.exception))
        self.assertNotIn("private-token", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
