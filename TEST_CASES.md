# VELOOP Rewards — Test Cases & Verification

## Scope
These checks cover the wallet, rewards, conversion and withdrawal flows required by the internship task. The backend remains the source of truth for balances, payout rules and validation.

## Static / Source Verification

| Check | Result | Notes |
| --- | --- | --- |
| Backend Python syntax | PASS | `python -m compileall -q backend start.py`
| Frontend JSX parsing | PASS | Parsed with Babel parser bundled in the frontend project.
| Frontend route paths match backend | PASS | Wallet, transactions, withdrawals, rewards config/status, daily claim and conversion paths match.
| Removed public demo wallet mutation routes | PASS | Demo credit/withdrawal routes are not present in the final backend.
| Removed user-facing spin feature | PASS | No frontend spin control/action or reward-service spin operation.
| Payout mapping is server-side | PASS | Backend owns the final denomination mapping.
| Manual conversion | PASS | User selects currency and amount; backend validates balance and rate.
| Profile avatars | PASS | 30 emoji presets plus camera/device upload.
| Notifications | PASS | Client-side activity panel with local read state; no nonexistent notification API is called.
| Refresh controls | PASS | Refresh actions call the authenticated wallet/history/reward loaders.
| Daily reward claim method | PASS | Frontend uses `POST /rewards/daily/claim`.

## Required Functional Cases for Live Environment

1. Register a new account with a password of at least 8 characters.
2. Login and verify `/auth/me` returns the current user.
3. Verify the wallet loads from `/wallet/me`.
4. Verify transaction history loads from `/wallet/me/transactions`.
5. Click Refresh from Wallet and Transaction History and confirm the data reloads without a 404.
6. Open Notifications, verify activity entries appear when applicable, then use **Mark all read** and confirm the unread badge clears.
7. Open Profile, select any of the 30 illustrated avatars, close/reopen the profile and verify the selection persists in the same browser.
8. Open Rewards, confirm the daily reward status loads from `GET /rewards/daily`.
9. Claim the daily reward and confirm `POST /rewards/daily/claim` returns success or the already-claimed state; verify the wallet and ledger refresh.
10. Convert a partial amount of SVE, Gems or Tokens and confirm the source balance decreases and VEs increases by the backend-configured rate.
11. Attempt to convert more than the source balance; verify the backend rejects it.
12. Open Withdrawals, load payout options from the backend, select a denomination and submit valid details.
13. Confirm the withdrawal response is `PENDING`, the VEs balance is deducted server-side and the history entry appears.
14. Repeat a withdrawal with the same `request_id`; verify the same withdrawal is returned or the duplicate is rejected without a second debit.
15. Attempt two concurrent withdrawals against the same limited VEs balance; verify the wallet cannot be overspent.
16. Change the displayed payout amount or wallet balance in browser tools and verify the backend still validates the real stored wallet and payout configuration.

## Environment Note
The local development environment used for this audit had a MongoDB Atlas TLS handshake problem, while the deployed Render backend had previously reported a healthy database connection. The local TLS/network issue is not treated as a source-code pass/fail result. Before submission, execute the live functional cases against the deployed backend.

## Final Payout Mapping

- ₹10 = 1,000 VEs
- ₹25 = 2,500 VEs
- ₹50 = 5,000 VEs
- ₹100 = 10,000 VEs
- ₹150 = 15,000 VEs
- ₹300 = 30,000 VEs
- ₹500 = 50,000 VEs
- ₹1,000 = 100,000 VEs

## Conversion Rates

- 1 SVE = 500 VEs
- 1 Token = 2,000 VEs
- 1 Gem = 5,000 VEs
