# VELOOP Rewards — Detailed Source Audit

**Audit date:** 2026-10-12  
**Repository:** `samarth306/VELoop-Rewards`  
**Scope:** React/Vite frontend, FastAPI backend, MongoDB persistence, authentication, wallet/rewards, payout configuration, withdrawal lifecycle, documentation and deployment readiness.

## Executive result

The source tree contains the main expected flows: registration/login, JWT-protected wallet routes, reward claims/conversion, backend-owned payout denominations, withdrawal idempotency, and rejection/refund handling. The live health response supplied during this investigation showed MongoDB connected, but a health check alone does not verify registration/login or financial transaction flows.

Several source-confirmed issues were corrected in this audit. **Live registration/login, Render deployment, email delivery, and MongoDB transaction behavior remain unverified** and must not be considered passed.

## Findings and changes

### Fixed in source

1. **CORS preflight requests consumed sensitive-route rate-limit quota — fixed.**  
   The HTTP middleware previously applied limits to every method on a sensitive path, including browser `OPTIONS` preflight requests. It now limits only actual `POST` and `PATCH` actions. A source-contract regression test was added.

2. **Daily reward streak date depended on the server's local timezone — fixed.**  
   Daily claim/status calculations now use the UTC date consistently with the backend's UTC timestamps. This avoids a local-development versus hosted-server date boundary mismatch.

3. **Final audit documentation contradicted the wallet conversion display — fixed.**  
   Documentation now states `240 VEs = ₹1`, matching the current frontend display.

4. **Environment template duplicated SMTP keys — fixed.**  
   Duplicate `SMTP_HOST/PORT/USER/PASSWORD/FROM` entries were removed from `.env.example`.

5. **Backend release version lagged the frontend — fixed in source.**  
   Backend `APP_VERSION` is now `2.4.1`, matching the frontend label. After the backend deploys, `/health` should report version `2.4.1`.

### Authentication: source review and remaining diagnosis

- Registration trims the name, lowercases/normalizes the email, inserts a user and wallet, and returns an access token.
- Login normalizes the email and verifies the stored password hash; a 401 `Invalid email or password` means the backend did not find a matching user/password pair for that request.
- The current frontend source consumes the registration token and signs the new account in immediately, rather than forcing a second login.
- Therefore, the source alone does **not** prove the cause of the reported fresh-account failure. The live frontend may still be running an older build, or the actual registration response/account state may differ from expectations. The frontend and backend deployments must be checked after the latest commits are deployed.
- Do not delete users or change database credentials as a guess. First verify registration's HTTP status/response and then verify `GET /auth/me` using the token returned by registration. Never share access tokens or passwords.

### Important limitations / production follow-up

1. **Live auth regression test — pending.** Register a new account in a private/incognito window, verify the app signs in, log out, then log in with the same credentials and verify `/auth/me`.
2. **Render deployment — pending.** The source version is `2.4.1`; the live health response seen earlier in this investigation was `2.4.0`, before the latest audit commits. Re-check the live endpoint after deployment.
3. **Automated CI — absent in the repository at audit time.** GitHub reported no status checks for the audited commit. Source-contract tests exist, but this audit did not execute them in a local runtime.
4. **Rate limiting is process-local.** It resets on restart and is not shared between multiple backend instances; use a shared store or gateway before horizontal scaling.
5. **Gift-card fulfilment is manual.** Amazon/Google Play options create pending requests; no external voucher-provider integration is present.
6. **Password-reset email requires provider configuration.** Gmail API, Resend, or SMTP settings must be correctly configured in the hosting environment; source presence does not prove delivery.
7. **Financial integration tests remain pending.** Validate Atlas transaction support, concurrent withdrawals, idempotency, rejection/refund, and ledger consistency against the live deployment before treating the application as production-ready.

## Payout and wallet invariants preserved

The audit did not alter payout values or frontend design. The required payout mapping remains:

| Payout | Required VEs |
|---:|---:|
| ₹10 | 2,400 |
| ₹25 | 5,800 |
| ₹50 | 10,000 |
| ₹100 | 19,500 |
| ₹150 | 28,500 |
| ₹300 | 52,500 |
| ₹500 | 80,500 |
| ₹1,000 | 150,000 |

The wallet's displayed estimate remains `240 VEs = ₹1`. Reward conversion rates remain 1 SVE = 500 VEs, 1 Token = 2,000 VEs, and 1 Gem = 5,000 VEs.

## Changesets

- Rate-limit CORS preflight regression: `d505a0adc24d8a9434cfc0c0420b7cb35ec5ee18`
- Correct wallet conversion documentation: `db28db32e5895629be1e8a126f214c25d66397e7`
- Remove duplicate SMTP template settings: `81392084abb59bc73c93ca31422f2c6c48629aaf`
- Add fresh-device authentication verification steps: `c2698dbdacdbfce05ab5bc7c27d571f82652086c`
- Add rate-limit regression contract: `7bfd994adb295d033b4e12f118ac2af05abf348b`
- Use UTC date for reward streaks: `060513d807e750b7ce79f544eb7c597715afe22e`
- Align backend version: `0ed454ecc1bc0deb6c129075da14cc508958ed18`

## Verification status

- Repository source re-read after edits: **completed**.
- Payout mapping rechecked in backend source: **matches required values**.
- Registration auto-token flow rechecked in frontend source: **present**.
- CORS preflight limiter guard rechecked: **present**.
- UTC daily-reward date usage rechecked: **present**.
- Python compile/unit tests, frontend production build, live auth flow, email delivery and live financial transaction tests: **not executed/verified in this environment**.
