# VELOOP Rewards — API Documentation

Base URL: `https://veloop-rewards-jj94.onrender.com`

Swagger: `https://veloop-rewards-jj94.onrender.com/docs`

## Authentication

Protected endpoints use:

```http
Authorization: Bearer <access_token>
```

The token is returned by the authentication flow.

## Health

### GET `/`

Returns API identity, version, running status, and the `/docs` path.

### GET `/health`

Checks API health and MongoDB connectivity.

Example:

```json
{
  "status": "healthy",
  "database": "connected",
  "version": "..."
}
```

## Authentication APIs

### POST `/auth/register`

Creates a user account and returns an access token.

Typical request:

```json
{
  "name": "Demo User",
  "email": "user@example.com",
  "password": "your-password"
}
```

### POST `/auth/login`

Authenticates an existing user.

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

Successful response:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

### GET `/auth/me`

Authentication required. Returns the authenticated user's public account information.

### PATCH `/auth/me`

Authentication required. Updates the authenticated user's profile name.

```json
{
  "name": "Updated Name"
}
```

### POST `/auth/change-password`

Authentication required. Verifies the current password before storing the new password.

```json
{
  "current_password": "current-password",
  "new_password": "new-password"
}
```

### POST `/auth/forgot-password`

Starts the password reset flow.

```json
{
  "email": "user@example.com"
}
```

The response is generic so account existence is not disclosed.

### POST `/auth/reset-password`

Uses a valid, unexpired reset token.

```json
{
  "token": "<reset-token>",
  "new_password": "new-password"
}
```

Invalid or expired tokens are rejected.

## Wallet APIs

### GET `/wallet/me`

Authentication required.

Returns the authenticated user's wallet:

```text
ves
sves
gems
tokens
spins
```

Wallet values are loaded from the backend database.

## Transaction APIs

### GET `/wallet/me/transactions`

Authentication required.

Returns transactions for the authenticated user, newest first.

Typical transaction fields:

```text
transaction_id
user_id
currency
type
amount
balance_before
balance_after
source
reference_id
status
description
metadata
created_at
updated_at
```

## Payout APIs

### GET `/payout-options`

Returns backend-controlled payout configuration.

### GET `/payout-options/{option_id}`

Returns a single payout option.

The frontend should use these endpoints instead of treating payout rules as the source of truth.

## Withdrawal APIs

### POST `/wallet/me/withdrawal`

Authentication required.

Request:

```json
{
  "amount": 10,
  "payout_option_id": "<backend-payout-option-id>",
  "payout_details": {
    "upi_id": "example@upi"
  },
  "request_id": "<unique-request-id>"
}
```

For bank payouts, `payout_details` contains the bank-specific fields required by the selected backend option.

The backend resolves the authoritative VEs cost from the selected payout configuration.

Withdrawal processing:

```text
Validate payout option
        ↓
Validate denomination
        ↓
Resolve required VEs
        ↓
Validate payout details
        ↓
Check request_id
        ↓
Check stored VEs balance
        ↓
Conditionally deduct VEs
        ↓
Create withdrawal record
        ↓
Create wallet transaction
        ↓
Return withdrawal
```

New withdrawals are created with status `PENDING`.

### GET `/wallet/me/withdrawals`

Authentication required.

Returns withdrawals belonging to the authenticated user.

Typical fields:

```text
withdrawal_id
request_id
user_id
currency
amount
payout_value
payout_option_id
payout_details
status
transaction_id
failure_reason
created_at
updated_at
```

## Current Payout Mapping

| Payout Value | Required VEs |
|---:|---:|
| ₹10 | 2,400 |
| ₹25 | 5,800 |
| ₹50 | 10,000 |
| ₹100 | 19,500 |
| ₹150 | 28,500 |
| ₹300 | 52,500 |
| ₹500 | 80,500 |
| ₹1,000 | 150,000 |

These values are backend payout configuration.

## Balance Validation

The withdrawal logic conditionally updates the wallet only when:

```text
ves >= required_ves
```

Otherwise the server rejects the withdrawal with an insufficient-balance error.

The client must not be able to choose an arbitrary VEs deduction.

## Idempotency

Withdrawal requests accept `request_id`.

Before creating a withdrawal, the backend checks whether the same authenticated user already has a withdrawal with the same request ID. Repeated submissions can therefore return the existing request instead of creating a second withdrawal.

## Wallet Transaction / Ledger

Withdrawal transactions contain information such as:

```text
transaction_id
user_id
currency
type
amount
balance_before
balance_after
source
reference_id
status
description
metadata
created_at
updated_at
```

Withdrawal metadata preserves payout information and the required VEs amount.

## Security

- JWT authentication for protected APIs
- Authenticated-user-based wallet access
- Password hashing
- Reset-token hashing and expiry validation
- Pydantic request validation
- Server-side payout validation
- Server-side balance validation
- Withdrawal idempotency
- Sensitive environment values kept outside source control

## Recommended Test Flow

Use the live Swagger interface:

1. Login.
2. Authorize with the returned Bearer token.
3. Call `GET /wallet/me`.
4. Call `GET /wallet/me/transactions`.
5. Call `GET /payout-options`.
6. Submit a valid `POST /wallet/me/withdrawal`.
7. Call `GET /wallet/me/withdrawals`.
8. Call `GET /wallet/me` again and verify the refreshed wallet.

Test invalid payout options, invalid denominations, insufficient VEs, invalid payout details, duplicate `request_id`, and frontend balance manipulation separately.

## Demo / Maintenance Routes

The backend also contains development/maintenance routes:

```text
GET  /wallet/demo
POST /wallet/demo/transaction
GET  /wallet/demo/transactions
POST /wallet/demo/withdrawal
GET  /wallet/demo/withdrawals
POST /admin/rewards/credit
POST /admin/auth/reset-password
```

These are not part of the normal end-user flow. Maintenance credentials must never be committed to source control.

## Live Links

Frontend: `https://veloop-rewards-frontend-ggzf.onrender.com`

Backend: `https://veloop-rewards-jj94.onrender.com`

Swagger: `https://veloop-rewards-jj94.onrender.com/docs`

GitHub: `https://github.com/samarth306/VELoop-Rewards`
