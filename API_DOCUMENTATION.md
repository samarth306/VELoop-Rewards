# VELOOP Rewards — API Documentation

Base URL:

```text
https://veloop-rewards-jj94.onrender.com
```

Swagger:

```text
https://veloop-rewards-jj94.onrender.com/docs
```

GitHub:

```text
https://github.com/samarth306/VELoop-Rewards
```

---

# Table of Contents

1. [API Principles](#api-principles)
2. [Authentication](#authentication)
3. [Health APIs](#health-apis)
4. [Authentication APIs](#authentication-apis)
5. [Wallet APIs](#wallet-apis)
6. [Transaction APIs](#transaction-apis)
7. [Payout APIs](#payout-apis)
8. [Current Payout Mapping](#current-payout-mapping)
9. [Withdrawal APIs](#withdrawal-apis)
10. [Withdrawal Validation](#withdrawal-validation)
11. [Balance Protection](#balance-protection)
12. [Idempotency](#idempotency)
13. [Concurrency Protection](#concurrency-protection)
14. [Wallet Ledger](#wallet-ledger)
15. [Payout Destination Validation](#payout-destination-validation)
16. [Password Reset Security](#password-reset-security)
17. [Rewards APIs](#rewards-apis)
18. [Admin / Maintenance APIs](#admin--maintenance-apis)
19. [Error Handling](#error-handling)
20. [Security](#security)
21. [Recommended API Test Flow](#recommended-api-test-flow)
22. [Important Negative Tests](#important-negative-tests)
23. [Live API Links](#live-api-links)

---

# API Principles

VELOOP Rewards follows a backend-authoritative architecture.

The frontend is a consumer of the API and must not be treated as the source of truth for:

- wallet balances
- required VEs
- payout configuration
- withdrawal eligibility
- withdrawal ownership
- transaction records

The backend independently validates wallet-sensitive operations before modifying MongoDB.

The main wallet flow is:

```text
React Frontend
      ↓
JWT-authenticated API request
      ↓
FastAPI
      ↓
Authentication / Authorization
      ↓
Business validation
      ↓
MongoDB
      ↓
API response
      ↓
Frontend refresh
```

---

# Authentication

Protected endpoints use:

```http
Authorization: Bearer <access_token>
```

The access token is returned by the login or registration flow.

The backend extracts the authenticated user's identity from the JWT.

Clients must not send another user's ID to access that user's wallet.

---

# Health APIs

## GET `/`

Returns basic API identity and status.

Example structure:

```json
{
  "name": "VELOOP Rewards API",
  "version": "...",
  "status": "running",
  "docs": "/docs"
}
```

## GET `/health`

Checks the API and MongoDB connectivity.

Example healthy response:

```json
{
  "status": "healthy",
  "database": "connected",
  "version": "...",
  "timestamp": "..."
}
```

If the database is unavailable, the API returns an unavailable/error response rather than reporting a healthy database connection.

---

# Authentication APIs

## POST `/auth/register`

Creates a new user account.

### Request

```json
{
  "name": "Demo User",
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

### Response

A successful registration returns an access token according to the authentication response model.

The password is not stored as plain text.

---

## POST `/auth/login`

Authenticates an existing user.

### Request

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

### Successful Response

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

Invalid credentials are rejected.

---

## GET `/auth/me`

Authentication required.

Returns the authenticated user's public account information.

Sensitive authentication fields such as the password hash are not intended to be returned to the client.

### Header

```http
Authorization: Bearer <access_token>
```

---

## PATCH `/auth/me`

Authentication required.

Updates supported profile information for the authenticated user.

### Request

```json
{
  "name": "Updated Name"
}
```

The update applies to the authenticated account.

---

## POST `/auth/change-password`

Authentication required.

Verifies the current password before storing the new password.

### Request

```json
{
  "current_password": "CurrentPassword123",
  "new_password": "NewPassword123"
}
```

The new password must satisfy the backend password validation rules and must not simply reuse the current password.

---

## POST `/auth/forgot-password`

Starts the password-reset flow.

### Request

```json
{
  "email": "user@example.com"
}
```

The response is intentionally generic so that account existence is not disclosed.

For a valid account, the backend creates a reset-token hash and expiry and initiates the configured reset-link/email flow.

---

## POST `/auth/reset-password`

Uses a valid and unexpired reset token.

### Request

```json
{
  "token": "<reset-token>",
  "new_password": "NewPassword123"
}
```

Invalid or expired reset tokens are rejected.

After a successful reset, the reset token is invalidated.

---

# Wallet APIs

## GET `/wallet/me`

Authentication required.

Returns the authenticated user's backend-stored wallet.

### Header

```http
Authorization: Bearer <access_token>
```

### Wallet fields

```text
ves
sves
gems
tokens
```

Example structure:

```json
{
  "user_id": "<authenticated-user-id>",
  "ves": 100000,
  "sves": 5000,
  "gems": 100,
  "tokens": 500
}
```

The actual response may contain additional wallet metadata depending on the backend model.

---

# Wallet Source of Truth

The authoritative wallet balance is stored in MongoDB and returned by the backend.

The frontend must not be allowed to replace the server balance with a client-controlled value.

Example:

```text
Frontend displays:
1,000 VEs

User manipulates browser state:
999,999 VEs

Backend wallet:
1,000 VEs
```

The backend continues to use:

```text
1,000 VEs
```

for authoritative withdrawal validation.

---

# Transaction APIs

## GET `/wallet/me/transactions`

Authentication required.

Returns wallet transactions belonging to the authenticated user.

Transactions are returned newest first.

### Typical response structure

```json
{
  "user_id": "<authenticated-user-id>",
  "count": 2,
  "transactions": [
    {
      "transaction_id": "<transaction-id>",
      "user_id": "<authenticated-user-id>",
      "currency": "ves",
      "type": "WITHDRAWAL",
      "amount": 10000,
      "balance_before": 50000,
      "balance_after": 40000,
      "source": "withdrawal",
      "reference_id": "<withdrawal-id>",
      "status": "COMPLETED",
      "description": "Withdrawal",
      "metadata": {},
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

### Typical transaction fields

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

Transaction records belong to the authenticated user.

---

# Payout APIs

## GET `/payout-options`

Returns the backend-controlled payout configuration.

The response contains the available payout methods and their supported denominations.

The frontend should load these values from this endpoint instead of hard-coding authoritative payout rules.

### Response structure

The response includes:

```text
currency
options
```

Each payout option can contain:

```text
method_id
name
type
currency
active
denominations
description
```

Each denomination contains the payout value and the required VEs.

---

## GET `/payout-options/{option_id}`

Returns a single configured payout option.

Example:

```http
GET /payout-options/upi
```

The returned option contains its backend-controlled denominations and payout configuration.

---

# Current Payout Mapping

The final payout configuration is:

| Payout Value | Required VEs |
| -----------: | -----------: |
|          ₹10 |        1,000 |
|          ₹25 |        2,500 |
|          ₹50 |        5,000 |
|         ₹100 |       10,000 |
|         ₹150 |       15,000 |
|         ₹300 |       30,000 |
|         ₹500 |       50,000 |
|       ₹1,000 |      100,000 |

These are the authoritative final payout values.

The obsolete values are not part of the final API configuration.

In particular, the API documentation must not use the old mapping:

```text
₹10    → 2,400 VEs
₹25    → 5,800 VEs
₹50    → 10,000 VEs
₹100   → 19,500 VEs
₹150   → 28,500 VEs
₹300   → 52,500 VEs
₹500   → 80,500 VEs
₹1,000 → 150,000 VEs
```

The backend-controlled mapping is the only authoritative mapping.

---

# Supported Payout Methods

The configured payout system supports:

```text
UPI
Bank Transfer
UPI QR
```

All supported methods use the backend payout configuration.

The client does not determine the final required VEs.

---

# Withdrawal APIs

## POST `/wallet/me/withdrawal`

Authentication required.

Creates a withdrawal for the authenticated user.

### Example UPI Request

```json
{
  "amount": 100,
  "payout_option_id": "upi",
  "payout_details": {
    "upi_id": "example@upi"
  },
  "request_id": "<unique-request-id>"
}
```

For this example:

```text
Payout = ₹100
Required VEs = 10,000
```

The backend resolves the required VEs from the selected payout configuration.

### Example Bank Transfer Request

```json
{
  "amount": 100,
  "payout_option_id": "bank_transfer",
  "payout_details": {
    "account_name": "Demo User",
    "account_number": "123456789012",
    "ifsc": "SBIN0001234",
    "bank_name": "Example Bank"
  },
  "request_id": "<unique-request-id>"
}
```

The exact payout detail validation is determined by the selected backend payout option.

---

# Withdrawal Processing Sequence

```text
POST /wallet/me/withdrawal
          ↓
Authenticate request
          ↓
Identify current user
          ↓
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
Read stored wallet balance
          ↓
Conditionally deduct VEs
          ↓
Create withdrawal record
          ↓
Create wallet transaction
          ↓
Return withdrawal
```

A successfully accepted withdrawal is created with:

```text
status = PENDING
```

The frontend then refreshes the wallet and withdrawal/transaction history.

---

# GET `/wallet/me/withdrawals`

Authentication required.

Returns withdrawals belonging to the authenticated user.

### Typical fields

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

Sensitive payout details are handled by the backend according to its sanitization/masking logic.

---

# Withdrawal Validation

The backend validates a withdrawal independently of the frontend.

The validation sequence is:

1. Authenticate the user.
2. Identify the authenticated user.
3. Validate the payout option.
4. Validate the selected denomination.
5. Resolve the required VEs from backend configuration.
6. Validate payout destination details.
7. Check the request ID.
8. Read the current stored wallet balance.
9. Confirm sufficient VEs.
10. Perform a conditional wallet deduction.
11. Create the withdrawal record.
12. Create the wallet transaction.
13. Return the withdrawal response.

The frontend cannot provide an arbitrary VEs deduction and make the backend accept it.

---

# Balance Protection

A withdrawal can only deduct VEs when:

```text
stored_ves_balance >= required_ves
```

Example:

```text
Available VEs = 20,000
Required VEs  = 30,000

Result:
Withdrawal rejected
```

The wallet must remain unchanged after the rejected withdrawal.

The server does not trust a browser-visible wallet balance.

---

# Conditional Wallet Deduction

Conceptually, the wallet operation must behave like:

```text
Update wallet
only when:

user_id = authenticated user
AND
ves >= required_ves
```

This prevents an invalid withdrawal from reducing the wallet below the required available balance.

It also protects against simultaneous withdrawal requests competing for the same VEs.

---

# Idempotency

Withdrawal requests contain:

```text
request_id
```

The request ID is used to protect against duplicate submissions.

Before creating a new withdrawal, the backend checks whether the authenticated user already has a withdrawal associated with the same request ID.

This protects against:

- double-click submission
- browser resubmission
- network retry
- client retry
- repeated API calls

Conceptually:

```text
Request ID: ABC123

First request:
ABC123 → withdrawal created

Repeated request:
ABC123 → existing request detected
```

The backend must not create an unintended second withdrawal for the same authenticated user and request ID.

---

# Concurrency Protection

The wallet deduction is balance-sensitive.

Example:

```text
Starting balance = 10,000 VEs

Request A = 8,000 VEs
Request B = 8,000 VEs
```

Both withdrawals must not succeed.

Expected behavior:

```text
One request:
SUCCESS

Other request:
INSUFFICIENT BALANCE
```

The successful request conditionally reduces the stored balance first.

The second request then evaluates the updated database balance.

This prevents the same VEs from being spent twice.

---

# Wallet Transaction / Ledger

Every successful wallet-changing withdrawal should have a corresponding transaction record.

Typical fields:

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

For a withdrawal:

```text
currency      = ves
type          = WITHDRAWAL
amount        = required VEs
source        = withdrawal
reference_id  = withdrawal ID
```

The metadata can preserve:

```text
payout option
payout method
payout value
required VEs
```

This allows wallet movement to be traced back to the withdrawal that caused it.

---

# Withdrawal Status

Newly accepted withdrawals are recorded as:

```text
PENDING
```

The withdrawal record can contain:

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

The frontend should display the backend-provided status rather than inventing a local status.

---

# Payout Destination Validation

Payout details are validated according to the selected payout method.

Examples:

## UPI

```json
{
  "upi_id": "example@upi"
}
```

## Bank Transfer

```json
{
  "account_name": "Demo User",
  "account_number": "123456789012",
  "ifsc": "SBIN0001234",
  "bank_name": "Example Bank"
}
```

## UPI QR

The payout request uses the fields expected by the backend payout configuration.

The server is responsible for final validation.

---

# Password Reset Security

The password-reset flow is designed so that the reset token is not stored as a usable plain token in the database.

The backend:

```text
Raw reset token
      ↓
Hash
      ↓
Store token hash + expiry
```

During reset:

```text
Submitted token
      ↓
Hash
      ↓
Find matching unexpired token hash
      ↓
Update password
      ↓
Remove reset token fields
```

Expired or invalid reset tokens are rejected.

---

# Rewards APIs

## GET `/rewards/config`

Returns backend-controlled reward configuration used by the demonstration frontend.

The response includes:

- daily reward values
- manual conversion rates for SVEs, Tokens and Gems

Example:

```json
{
  "daily_rewards": {
    "1": {"ves": 100},
    "10": {"ves": 200, "sves": 1, "tokens": 1, "gems": 1}
  },
  "conversion_rates": {
    "sves": 500,
    "tokens": 2000,
    "gems": 5000
  }
}
```

## GET `/rewards/daily`

Authentication required.

Returns today's daily reward status, streak day and the reward currently available to the user.

## POST `/rewards/daily/claim`

Authentication required.

Claims the current daily reward. The backend prevents duplicate claims for the same calendar day, updates the wallet and records ledger entries in one database transaction.

## POST `/rewards/convert`

Authentication required.

The client submits only the source currency and the amount the user explicitly selected.

Example:

```json
{
  "currency": "gems",
  "amount": 2
}
```

Supported currencies and server rates:

```text
1 SVE   = 500 VEs
1 Token = 2,000 VEs
1 Gem   = 5,000 VEs
```

The backend checks the stored source balance, applies the configured rate, debits the selected source amount and credits the resulting VEs inside one MongoDB transaction. Both sides of the conversion are recorded in the wallet ledger.


# Admin / Maintenance APIs

The backend contains development/maintenance routes that are not part of the normal end-user flow.

These routes must not be exposed as ordinary frontend features.

## POST `/admin/rewards/credit`

Credits one or more supported reward currencies to a specified user for administration/testing. This route requires the configured `X-Admin-Key` request header.

Example header:

```text
X-Admin-Key: <server-configured-secret>
```

Example body:

```json
{
  "email": "user@example.com",
  "sves": 500,
  "gems": 25,
  "tokens": 50,
  "description": "Demo reward"
}
```

This route is for maintenance/testing and is not part of the normal frontend user flow.

## POST `/admin/auth/reset-password`

Administrative password-reset route.

The request requires the configured administrative reset secret.

Example structure:

```json
{
  "email": "user@example.com",
  "new_password": "NewPassword123",
  "admin_secret": "<server-configured-secret>"
}
```

Never commit the real administrative secret to source control.

---

# Error Handling

The API uses HTTP status codes and structured error responses for validation and authorization failures.

Typical categories include:

| Status | Meaning                                           |
| -----: | ------------------------------------------------- |
|    200 | Successful request                                |
|    201 | Resource created where applicable                 |
|    400 | Invalid request / validation failure              |
|    401 | Authentication required or invalid authentication |
|    403 | Authenticated but not permitted                   |
|    404 | Resource/user/option not found                    |
|    409 | Conflict where applicable                         |
|    422 | Request schema validation failure                 |
|    500 | Unexpected server error                           |
|    503 | Service/database configuration unavailable        |

The exact response body depends on the endpoint and validation path.

---

# Common Withdrawal Errors

## Insufficient Balance

Example condition:

```text
Available = 5,000 VEs
Required  = 10,000 VEs
```

The withdrawal is rejected.

The stored wallet is not allowed to become negative.

## Invalid Payout Option

If the client sends an unknown payout option ID, the backend rejects the request.

## Invalid Denomination

If the requested payout amount is not configured for the selected payout option, the backend rejects the request.

## Invalid Payout Details

If the payout destination does not satisfy the selected payout method's validation rules, the backend rejects the request.

## Duplicate Request

If the same authenticated user submits the same request ID again, the backend can return the existing withdrawal instead of creating another one.

---

# Security

The API applies the following security principles:

- JWT authentication for protected endpoints
- Authenticated-user-based wallet access
- Password hashing
- Reset-token hashing
- Reset-token expiry validation
- Pydantic request validation
- Server-side payout validation
- Server-side VEs validation
- Conditional balance updates
- Withdrawal idempotency
- User-specific transaction access
- User-specific withdrawal access
- Sensitive configuration outside source control

The frontend is never considered authoritative for wallet balances or payout costs.

---

# Recommended API Test Flow

Use the live Swagger interface:

```text
https://veloop-rewards-jj94.onrender.com/docs
```

Recommended sequence:

1. Register or use an existing test account.
2. Login using `/auth/login`.
3. Copy the returned `access_token`.
4. Authorize Swagger using the Bearer token.
5. Call `GET /auth/me`.
6. Call `GET /wallet/me`.
7. Call `GET /wallet/me/transactions`.
8. Call `GET /payout-options`.
9. Select a valid payout option and denomination.
10. Submit a valid withdrawal.
11. Verify the response status is `PENDING`.
12. Call `GET /wallet/me/withdrawals`.
13. Call `GET /wallet/me/transactions`.
14. Call `GET /wallet/me` again.
15. Verify the VEs balance has been updated correctly.

---

# Important Negative Tests

The following tests should be performed separately.

## Test 1 — Invalid JWT

Call:

```http
GET /wallet/me
```

without a valid Bearer token.

Expected:

```text
Authentication failure
```

## Test 2 — Invalid Payout Option

Submit a withdrawal with a fake payout option ID.

Expected:

```text
Request rejected
```

## Test 3 — Invalid Denomination

Submit a payout amount that is not configured.

Expected:

```text
Request rejected
```

## Test 4 — Insufficient Balance

Attempt a payout requiring more VEs than the stored balance.

Expected:

```text
Withdrawal rejected
Wallet unchanged
```

## Test 5 — Duplicate Request ID

Submit the same request twice with the same authenticated user and request ID.

Expected:

```text
No unintended duplicate withdrawal
```

## Test 6 — Concurrent Withdrawal

Start with:

```text
10,000 VEs
```

Submit two withdrawals requiring:

```text
8,000 VEs
```

Expected:

```text
Only one can successfully deduct the available balance.
```

## Test 7 — Frontend Balance Manipulation

Change a browser-visible VEs value to:

```text
999999
```

Then attempt a withdrawal.

Expected:

```text
Backend ignores manipulated display value.
Stored MongoDB balance remains authoritative.
```

## Test 8 — Arbitrary VEs Manipulation

Attempt to modify the withdrawal request so that the client supplies a lower or arbitrary VEs deduction.

Expected:

```text
Backend resolves required VEs from payout configuration.
```

## Test 9 — Cross-User Access

Attempt to use one user's authenticated token to retrieve another user's wallet/transactions/withdrawals.

Expected:

```text
Only the authenticated user's records are returned.
```

---

# Example End-to-End Withdrawal

Suppose the wallet contains:

```text
VEs = 25,000
```

The user selects:

```text
Payout = ₹100
```

Backend configuration says:

```text
₹100 = 10,000 VEs
```

The withdrawal request is sent.

Backend processing:

```text
Stored balance = 25,000
Required       = 10,000
Condition      = 25,000 >= 10,000
```

The deduction succeeds.

New wallet balance:

```text
15,000 VEs
```

The backend creates:

```text
Withdrawal
+
Wallet transaction
```

The withdrawal status is:

```text
PENDING
```

The frontend refreshes the wallet and history.

---

# API Source of Truth Rules

The following values must come from the backend:

```text
Wallet balances
Payout methods
Payout denominations
Required VEs
Withdrawal eligibility
Withdrawal status
Transaction history
```

The frontend may display these values but must not redefine them.

---

# API and Frontend Relationship

```text
                 ┌────────────────────┐
                 │   React Frontend   │
                 └─────────┬──────────┘
                           │
                           │ HTTPS + JWT
                           ▼
                 ┌────────────────────┐
                 │    FastAPI API     │
                 └─────────┬──────────┘
                           │
             ┌─────────────┼──────────────┐
             │             │              │
             ▼             ▼              ▼
        Authentication   Wallet        Payout
             │             │              │
             └─────────────┼──────────────┘
                           ▼
                    Withdrawal Logic
                           │
                           ▼
                    MongoDB Atlas
```

---

# Live API Links

## Frontend

https://veloop-rewards-frontend-ggzf.onrender.com

## Backend

https://veloop-rewards-jj94.onrender.com

## Swagger

https://veloop-rewards-jj94.onrender.com/docs

## Health

https://veloop-rewards-jj94.onrender.com/health

## GitHub

https://github.com/samarth306/VELoop-Rewards

---

# Final API Checklist

Before final submission, verify:

- [ ] `/` responds successfully
- [ ] `/health` reports MongoDB connectivity
- [ ] registration works
- [ ] login works
- [ ] JWT protection works
- [ ] `/auth/me` works
- [ ] profile update works
- [ ] password change works
- [ ] forgot-password works
- [ ] reset-password works
- [ ] `/wallet/me` returns the authenticated wallet
- [ ] transaction history is user-specific
- [ ] payout options are backend-driven
- [ ] final payout mapping is correct
- [ ] invalid payout option is rejected
- [ ] invalid denomination is rejected
- [ ] invalid payout details are rejected
- [ ] insufficient balance is rejected
- [ ] withdrawal creates a `PENDING` record
- [ ] withdrawal creates a ledger transaction
- [ ] duplicate request IDs are handled
- [ ] concurrent withdrawals cannot overspend the wallet
- [ ] frontend balance manipulation does not bypass backend validation
- [ ] cross-user wallet access is prevented
- [ ] Reward conversion allows only user-selected amounts
- [ ] final payout mapping is backend-controlled and verified
- [ ] real secrets are not documented or committed
- [ ] Swagger documentation is available
- [ ] deployed backend is reachable
- [ ] deployed frontend is reachable
