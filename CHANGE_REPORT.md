# VELOOP Rewards — Replacement Change Report

## Scope
The existing React dashboard, visual design, colors, layout, icons/assets, and user-facing flows were intentionally preserved. Changes focus on backend correctness, security controls, project hygiene, and documentation.

## Changes made

1. **Payout configuration:** missing payout options are seeded individually and the list/detail endpoints and withdrawal validation read active options from MongoDB. The payout mapping now follows the task PDF throughout backend, tests and docs: ₹10/25/50/100/150/300/500/1,000 → 2,400/5,800/10,000/19,500/28,500/52,500/80,500/150,000 VEs. The previous replacement ZIP's lower default mapping is migrated only when stored denominations match it exactly; custom configuration is preserved. Amazon Gift Card and Google Play Gift Card were added with email validation and pending/manual fulfilment review.
2. **Withdrawal idempotency:** `request_id` is mandatory and validated. Retrying the same ID with the same normalized payload returns the original withdrawal; reusing it for a different amount, method, or payout destination returns HTTP 409.
3. **Withdrawal lifecycle:** added an admin-only status endpoint for PROCESSING, APPROVED, and REJECTED. Rejection requires a reason and refunds reserved VEs while adding a refund ledger entry in one MongoDB transaction. `ADMIN_WITHDRAWAL_KEY` is separate from reward-administration credentials.
4. **Database integrity:** added unique indexes for normalized user email and wallet ownership. Existing duplicate records, if any, must be reconciled before startup can create these indexes.
5. **Abuse controls:** added process-local throttling for authentication, password recovery, admin mutations, and withdrawal creation. Shared rate limiting is still recommended before horizontal scaling.
6. **JWT configuration:** the backend now refuses to start if `JWT_SECRET` is missing or left at the template placeholder.
7. **Audit reliability:** audit-log write failures are surfaced to application logs rather than silently discarded.
8. **Documentation/tests:** updated README/API docs/test notes and added offline source-contract tests.
9. **Archive cleanup:** excluded the uploaded `.env`, Git internals/history, Python virtual environments, `node_modules`, caches, and build output. Keep your existing local `.env` outside the replacement operation.

## Deliberately not changed

- Frontend visual design and current UI styling.
- Payout methods and wallet UI beyond the requested payout-rate correction. Amazon and Google Play gift-card methods are added as pending-review payout options; voucher delivery still requires manual operations because no provider integration is included.
- The removed spin feature.
- Existing React assets and core dashboard structure.

## Important deployment notes

- Configure `ADMIN_WITHDRAWAL_KEY` in Render only if an operator needs the new withdrawal review endpoint.
- Keep `JWT_SECRET`, `MONGO_URI`, SMTP credentials, and admin keys in environment settings, never in the ZIP or GitHub.
- If the uploaded `.env` values were ever committed to a remote repository or otherwise exposed, rotate the affected secrets.
- The new source-level checks do not substitute for live tests against MongoDB Atlas/Render. See `TEST_CASES.md`.
