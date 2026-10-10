# VELOOP Rewards — Audit Summary

## High-priority findings addressed

- Payout endpoints previously read a Python constant despite a payout-options collection/model existing. Runtime payout reads use MongoDB. Missing methods are inserted individually, and only a database record that exactly matches the incorrect defaults shipped in the previous replacement ZIP is migrated to the PDF mapping.
- A withdrawal could omit `request_id`; idempotency was therefore optional. It is now required and conflicting payload reuse is rejected.
- There was no administrative withdrawal status/rejection/refund route. A protected lifecycle endpoint is now included; rejected withdrawals refund VEs and record a ledger entry transactionally.
- User-email and wallet-owner uniqueness was not enforced by declared unique indexes. Unique indexes are now requested at startup.
- Sensitive endpoints lacked throttling. Basic per-process limits are now present.
- JWT configuration could be missing/placeholder without a clear startup failure. Configuration is now validated.
- The uploaded archive included a real `.env`, Git metadata, and bundled virtual environments. The replacement ZIP excludes those materials.

## Payout mapping decision

The payout mapping follows the PDF: ₹10 = 2,400 VEs; ₹25 = 5,800; ₹50 = 10,000; ₹100 = 19,500; ₹150 = 28,500; ₹300 = 52,500; ₹500 = 80,500; ₹1,000 = 150,000. The previous replacement ZIP incorrectly used lower values; an exact-match migration corrects those defaults while preserving customized database records. Amazon and Google Play gift-card options use this configured denomination table and require manual fulfilment; no provider integration is claimed.

## Validation actually performed

- Python compilation: passed (`python -m compileall -q backend start.py`).
- Offline source-contract suite: 11 tests passed (`python -m unittest discover -s tests -v`).
- Frontend JSX syntax: passed using the supplied Babel parser. Frontend production build: **not verified**. Dependency installation timed out in this environment and Vite was unavailable, so no successful production build is claimed.
- MongoDB transaction behavior, real email delivery, live deployment, concurrent withdrawal behavior, and operator workflow: **not verified in this environment**. Execute the live checks in `TEST_CASES.md` after replacing and configuring the project.

## Remaining production considerations

- The rate limiter is process-local and resets on restart; use Redis/API-gateway limits for multiple instances.
- Admin APPROVED status is an operator record, not a payout-provider integration. Mark approved only after actual payment completion.
- Reconcile any existing duplicate email or wallet records before deployment if unique-index creation fails.
