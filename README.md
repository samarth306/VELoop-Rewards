# VELOOP Rewards — Wallet & Payout System

A backend-driven digital rewards wallet and payout demonstration system built with **Python, FastAPI, MongoDB Atlas, and React**.

The project is designed around one core rule:

> **The backend is the source of truth for wallet balances, transactions, payout configuration, validation, and withdrawal processing.**

The React frontend is a demonstration layer that consumes the FastAPI backend and displays the authenticated user's wallet, transaction history, payout options, and withdrawal flow.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Live Links](#live-links)
4. [Technology Stack](#technology-stack)
5. [System Architecture](#system-architecture)
6. [Backend Source of Truth](#backend-source-of-truth)
7. [Authentication](#authentication)
8. [Wallet](#wallet)
9. [Transaction Ledger](#transaction-ledger)
10. [Payout Configuration](#payout-configuration)
11. [Current Payout Mapping](#current-payout-mapping)
12. [Withdrawal Flow](#withdrawal-flow)
13. [Withdrawal Validation](#withdrawal-validation)
14. [Idempotency and Duplicate Protection](#idempotency-and-duplicate-protection)
15. [Concurrency and Balance Protection](#concurrency-and-balance-protection)
16. [Payout Destination Validation](#payout-destination-validation)
17. [Database Architecture](#database-architecture)
18. [Security](#security)
19. [Password Recovery](#password-recovery)
20. [Reward Service](#reward-service)
21. [Frontend](#frontend)
22. [API Reference](#api-reference)
23. [Health and Deployment](#health-and-deployment)
24. [Local Development](#local-development)
25. [Environment Variables](#environment-variables)
26. [Project Structure](#project-structure)
27. [Testing Checklist](#testing-checklist)
28. [Recommended Demo Flow](#recommended-demo-flow)
29. [Postman](#postman)
30. [Scaling Considerations](#scaling-considerations)
31. [Submission Checklist](#submission-checklist)
32. [Final Links](#final-links)

---

# Project Overview

VELOOP Rewards is a wallet and payout demonstration application focused primarily on backend architecture, wallet accounting, transaction history, withdrawal validation, authentication, and security.

The application provides an authenticated wallet containing:

- VEs
- SVEs
- Gems
- Tokens

Reward conversion is manual: the user enters the amount of SVE, Token or Gem to convert, and the backend applies the configured server rate.

The payout system uses **VEs** as the authoritative redemption currency.

---

# Key Features

## Authentication

- User registration
- User login
- JWT Bearer authentication
- Password hashing
- Current-user profile
- Profile name update
- Change password
- Forgot-password flow
- Reset-password flow
- Protected wallet APIs
- User-specific authorization

## Wallet

- Backend-driven wallet balances
- VEs balance
- SVEs balance
- Gems balance
- Tokens balance
- Authenticated wallet retrieval
- Wallet refresh after successful withdrawal

## Transactions

- Wallet transaction history
- Credit/debit ledger records
- Balance-before tracking
- Balance-after tracking
- Transaction status
- Transaction source
- Reference IDs
- Metadata
- Timestamped records

## Payout

- Backend-controlled payout options
- UPI payout
- Bank transfer payout
- UPI QR payout
- Backend-controlled payout denominations
- Server-side VEs calculation
- Payout destination validation
- Withdrawal confirmation
- Pending withdrawal status

## Frontend Experience

- Premium dark-theme dashboard
- Custom VELOOP logo system
- Profile photo upload and camera capture
- 30 illustrated avatar presets
- In-app notification center with read state
- About VELOOP project page
- Refresh controls with loading feedback
- Manual SVE / Token / Gem conversion
- Responsive mobile and desktop layouts

## Withdrawal Security

- Server-side balance validation
- Conditional wallet deduction
- Idempotency using request IDs
- Duplicate submission protection
- User-specific withdrawal ownership
- Invalid payout option rejection
- Invalid denomination rejection
- Invalid destination rejection
- Insufficient balance protection
- Transaction ledger creation
- Withdrawal history

## Deployment

- React frontend deployed on Render
- FastAPI backend deployed on Render
- MongoDB Atlas database
- FastAPI Swagger documentation
- Health-check endpoint
- GitHub repository

---

# Live Links

## Frontend

https://veloop-rewards-frontend-ggzf.onrender.com

## Backend API

https://veloop-rewards-jj94.onrender.com

## FastAPI Swagger

https://veloop-rewards-jj94.onrender.com/docs

## Health Check

https://veloop-rewards-jj94.onrender.com/health

## GitHub

https://github.com/samarth306/VELoop-Rewards

---

# Technology Stack

## Backend

- Python
- FastAPI
- Pydantic
- PyMongo
- MongoDB Atlas
- JWT authentication
- Password hashing
- Render

## Frontend

- React
- Vite
- JavaScript
- CSS
- Inline SVG interface icons

## Database

- MongoDB Atlas

---

# System Architecture

```text
                         ┌──────────────────────────────┐
                         │        React Frontend        │
                         │                              │
                         │ Login / Register             │
                         │ Wallet                       │
                         │ Transactions                 │
                         │ Withdrawal                   │
                         │ Profile                      │
                         └──────────────┬───────────────┘
                                        │
                                        │ HTTPS / JSON
                                        │ Bearer JWT
                                        ▼
                         ┌──────────────────────────────┐
                         │         FastAPI API          │
                         │                              │
                         │ Authentication              │
                         │ Wallet Services              │
                         │ Transaction Services         │
                         │ Payout Configuration         │
                         │ Withdrawal Validation        │
                         │ Reward Service               │
                         └──────────────┬───────────────┘
                                        │
                                        │ PyMongo
                                        ▼
                         ┌──────────────────────────────┐
                         │        MongoDB Atlas         │
                         │                              │
                         │ Users                        │
                         │ Wallets                      │
                         │ Transactions                 │
                         │ Withdrawals                  │
                         │ Payout Configuration         │
                         │ Audit Logs                   │
                         └──────────────────────────────┘
```

---

# Backend Source of Truth

The backend is authoritative for all wallet-sensitive operations.

The frontend may display a balance, but it cannot change the authoritative stored balance.

The authenticated wallet is loaded through:

```http
GET /wallet/me
```

The backend identifies the user from the authenticated JWT and loads the corresponding wallet.

The client cannot safely perform a withdrawal by changing a browser-visible balance.

For example, changing a displayed value from:

```text
1,000 VEs
```

to:

```text
999,999 VEs
```

does not change the actual wallet stored in MongoDB.

The backend independently reads the stored wallet balance before processing a withdrawal.

---

# Authentication

JWT Bearer authentication protects authenticated APIs.

## Login Flow

```text
User enters email and password
            ↓
POST /auth/login
            ↓
Backend validates credentials
            ↓
JWT access token generated
            ↓
Frontend stores the authenticated session
            ↓
Bearer token sent with protected requests
            ↓
Backend identifies authenticated user
```

Invalid credentials are rejected.

Inactive accounts are rejected.

Passwords are stored as hashes rather than plain-text passwords.

---

# Authentication Endpoints

## Register

```http
POST /auth/register
```

Creates a user account.

## Login

```http
POST /auth/login
```

Authenticates a user and returns an access token.

## Current User

```http
GET /auth/me
```

Returns the authenticated user's public account information.

Authentication is required.

## Update Profile

```http
PATCH /auth/me
```

Updates supported profile information for the authenticated user.

## Change Password

```http
POST /auth/change-password
```

Authentication is required.

The current password is verified before the new password is stored.

The new password must differ from the current password.

## Forgot Password

```http
POST /auth/forgot-password
```

Starts the password-reset process.

The endpoint uses a generic response so an attacker cannot use the response to determine whether an email address exists.

For a valid account, a reset-token hash and expiry are stored.

## Reset Password

```http
POST /auth/reset-password
```

Uses a valid and unexpired reset token to update the password.

The reset-token hash is removed after successful password reset.

---

# Wallet

## Get My Wallet

```http
GET /wallet/me
```

Authentication is required.

The backend returns the wallet belonging to the authenticated user.

Supported wallet fields:

```text
ves
sves
gems
tokens
```

---

# Wallet Data Principles

The frontend must treat backend wallet values as read-only display data.

The authoritative balance is stored in MongoDB.

For VEs:

```text
Stored MongoDB balance
        ↓
Backend wallet endpoint
        ↓
Frontend display
```

For withdrawal:

```text
Frontend selection
        ↓
Backend receives request
        ↓
Backend loads payout configuration
        ↓
Backend resolves required VEs
        ↓
Backend loads stored wallet balance
        ↓
Backend conditionally deducts VEs
```

The client does not determine the final VEs cost.

---

# Transaction Ledger

## Get My Transactions

```http
GET /wallet/me/transactions
```

Authentication is required.

The endpoint returns transaction records belonging to the authenticated user.

Transactions are ordered by `created_at` descending.

A transaction can contain:

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

The ledger provides traceability for wallet changes.

For a withdrawal, the transaction records the VEs movement and withdrawal context.

---

# Payout Configuration

Payout configuration is backend-controlled.

The frontend obtains available payout options from:

```http
GET /payout-options
```

The frontend does not hard-code the authoritative VEs cost.

A single payout option can be retrieved using:

```http
GET /payout-options/{option_id}
```

The backend configuration controls:

- payout method
- payout denomination
- required VEs
- supported currency
- payout option identity

---

# Current Payout Mapping

The final payout mapping used by the project is:

| Payout | Required VEs |
| -----: | -----------: |
|    ₹10 |    1,000 VEs |
|    ₹25 |    2,500 VEs |
|    ₹50 |    5,000 VEs |
|   ₹100 |   10,000 VEs |
|   ₹150 |   15,000 VEs |
|   ₹300 |   30,000 VEs |
|   ₹500 |   50,000 VEs |
| ₹1,000 |  100,000 VEs |

These values are backend-controlled.

The authoritative final mapping is the table above.

---

# Supported Payout Methods

The backend supports payout configuration for:

- UPI
- Bank Transfer
- UPI QR

Each method uses the configured payout denominations.

The frontend loads these methods from the backend instead of assuming a fixed configuration.

---

# Withdrawal Flow

The complete withdrawal flow is:

```text
Wallet
   ↓
Open Withdrawal
   ↓
Load payout options
   ↓
Select payout method
   ↓
Select payout denomination
   ↓
Enter payout details
   ↓
Review withdrawal
   ↓
Confirm
   ↓
POST /wallet/me/withdrawal
   ↓
Validate authenticated user
   ↓
Validate payout option
   ↓
Validate denomination
   ↓
Resolve required VEs
   ↓
Validate payout destination
   ↓
Validate request ID
   ↓
Load current wallet balance
   ↓
Conditionally deduct VEs
   ↓
Create withdrawal record
   ↓
Create wallet transaction
   ↓
Return withdrawal
   ↓
Status = PENDING
   ↓
Refresh wallet
   ↓
Refresh transaction/withdrawal history
```

---

# Withdrawal Endpoint

## Create Withdrawal

```http
POST /wallet/me/withdrawal
```

Authentication is required.

The request contains the selected payout information, payout details, and a request ID.

The server resolves the authoritative VEs requirement from the selected backend payout configuration.

The client does not submit an authoritative VEs deduction.

---

# Withdrawal Request Principles

A withdrawal request contains information such as:

```text
payout option ID
payout denomination
payout details
request ID
```

The backend determines the required VEs.

For example, if the selected payout is:

```text
₹100
```

the backend resolves:

```text
Required VEs = 10,000
```

The frontend cannot change that to an arbitrary value.

---

# Withdrawal Records

## Get My Withdrawals

```http
GET /wallet/me/withdrawals
```

Authentication is required.

The endpoint returns withdrawal records belonging to the authenticated user.

A withdrawal record can contain:

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

A newly accepted withdrawal is represented with:

```text
status = PENDING
```

---

# Withdrawal Validation

The server performs the following validation sequence:

1. Authenticate the request.
2. Identify the authenticated user.
3. Validate the payout option.
4. Validate the selected denomination.
5. Resolve required VEs from backend configuration.
6. Validate payout destination details.
7. Check the request ID for an existing request.
8. Read the current wallet balance.
9. Confirm sufficient VEs.
10. Perform a conditional wallet deduction.
11. Create the withdrawal record.
12. Create the wallet ledger transaction.
13. Return the withdrawal response.

This prevents the frontend from bypassing the business rules.

---

# Insufficient Balance Protection

A withdrawal must never be allowed when the stored VEs balance is insufficient.

Conceptually:

```text
Only deduct when:

stored_ves_balance >= required_ves
```

If the balance is insufficient, the backend rejects the operation.

Example:

```text
Required = 50,000 VEs
Available = 20,000 VEs
Result = Rejected
```

The frontend cannot override this validation.

---

# Conditional Wallet Update

The wallet deduction is performed against the stored database balance.

Conceptually:

```text
UPDATE wallet
SET ves = ves - required_ves
WHERE user_id = authenticated_user
AND ves >= required_ves
```

This is important because two simultaneous withdrawal requests must not both spend the same balance.

---

# Idempotency and Duplicate Protection

Withdrawal requests accept a `request_id`.

Before creating a new withdrawal, the backend checks whether the same authenticated user has already submitted a request with that ID.

This protects against:

- double-click submission
- browser resubmission
- network retry
- client retry
- accidental duplicate requests

If an existing request is found, the backend can return the existing withdrawal instead of creating another one.

---

# Concurrency and Balance Protection

The wallet must remain correct even when two withdrawal requests arrive at approximately the same time.

Example:

```text
Available VEs = 10,000

Request A = 8,000 VEs
Request B = 8,000 VEs
```

Both requests must not succeed.

The conditional wallet update ensures that once the first successful request reduces the balance, the second request must re-check the current stored balance.

Expected result:

```text
Request A → SUCCESS
Request B → INSUFFICIENT BALANCE
```

The exact winner depends on which request successfully performs the conditional update first.

---

# Payout Destination Validation

The backend validates payout details according to the selected payout method.

Examples of payout types include:

```text
UPI
Bank Transfer
UPI QR
```

The client cannot simply select a payout method and bypass destination validation.

Invalid payout details are rejected before the withdrawal is finalized.

Sensitive payout details should not be exposed unnecessarily in the frontend transaction history.

---

# Wallet Transaction on Withdrawal

A successful withdrawal creates a corresponding wallet transaction.

The ledger captures the VEs movement.

Typical withdrawal transaction information includes:

```text
currency = ves
type = WITHDRAWAL
amount = required VEs
source = withdrawal
reference_id = withdrawal ID
status
balance_before
balance_after
metadata
created_at
updated_at
```

The metadata preserves payout context such as:

```text
payout option
payout method
payout value
required VEs
```

This makes the wallet movement traceable.

---

# Compensation / Failure Handling

The withdrawal implementation also protects against persistence failures after a wallet deduction.

If the wallet is deducted but a required persistence operation fails during the implemented compensation path, the deducted VEs can be restored.

This reduces the risk of a wallet balance being lost without a corresponding withdrawal record.

---

# Database Architecture

MongoDB Atlas is the persistent database.

The project uses collections/models for areas including:

```text
users
wallets
wallet transactions
withdrawals
payout options
audit logs
```

Logical backend models include:

```text
User
Auth
Wallet
WalletTransaction
Withdrawal
PayoutOption
AuditLog
```

User-specific access is based on the authenticated `user_id`.

A client does not choose another user's wallet by sending a different wallet owner ID.

---

# Security

## Authentication

JWT Bearer authentication protects authenticated operations.

## Authorization

Protected operations operate on the authenticated user's identity.

## Password Hashing

Passwords are stored as hashes rather than plain-text passwords.

## Input Validation

Pydantic models validate request data before business logic is executed.

## Wallet Authorization

The backend loads wallet data for the authenticated user.

## Payout Authorization

The backend resolves payout configuration from server-side configuration.

## Password Reset Security

Reset-token hashes and expiry are used instead of storing a usable reset token as the authoritative database value.

## Secrets

Sensitive credentials must remain outside source control.

The real `.env` file must never be committed.

---

# Password Recovery

The password recovery flow is:

```text
User selects Forgot Password
          ↓
POST /auth/forgot-password
          ↓
Backend generates reset token
          ↓
Token hash stored with expiry
          ↓
Reset link/token delivered through configured flow
          ↓
User submits new password
          ↓
POST /auth/reset-password
          ↓
Backend validates token and expiry
          ↓
Password hash updated
          ↓
Reset token invalidated
```

The forgot-password endpoint should use a generic response to avoid account enumeration.

---

# Reward Service

The project includes a backend reward service for reward-related wallet operations.

The final user-facing scope includes daily rewards and manual reward conversion.

Reward-related wallet credits remain backend-controlled and produce proper wallet/transaction records where applicable.

---

# Frontend

The React frontend is a demonstration layer over the backend.

The frontend provides:

- Login
- Registration
- Password recovery
- Password reset
- Wallet overview
- VEs display
- SVEs display
- Gems display
- Tokens display
- Recent wallet activity
- Transaction history
- Withdrawal interface
- Backend payout methods
- Backend payout denominations
- Payout detail forms
- Withdrawal confirmation
- Withdrawal history
- Profile controls
- Loading states
- Error states
- Success states
- Responsive layouts

---

# Frontend Source-of-Truth Rules

The frontend must not be treated as a wallet database.

The following values are display values:

```text
VEs
SVEs
Gems
Tokens
```

The backend remains authoritative.

For withdrawal:

```text
Frontend
   ↓
Selection
   ↓
API request
   ↓
Backend validation
   ↓
Database operation
   ↓
Response
   ↓
Frontend refresh
```

The frontend refreshes wallet and history after a successful withdrawal.

---

# User Experience

The final UI is intended to provide a polished rewards-wallet experience while keeping the implementation focused on the assignment's backend requirements.

Important UX states include:

- initial loading
- wallet loading
- payout loading
- withdrawal submission
- successful withdrawal
- insufficient balance
- invalid payout details
- invalid payout option
- duplicate request
- authentication failure
- API/server error
- session expiration

The UI should not present client-side values as authoritative business rules.

---

# API Reference

## Authentication

| Method | Endpoint                | Purpose          |
| ------ | ----------------------- | ---------------- |
| POST   | `/auth/register`        | Register user    |
| POST   | `/auth/login`           | Login            |
| GET    | `/auth/me`              | Current user     |
| PATCH  | `/auth/me`              | Update profile   |
| POST   | `/auth/change-password` | Change password  |
| POST   | `/auth/forgot-password` | Start reset flow |
| POST   | `/auth/reset-password`  | Reset password   |

## Wallet

| Method | Endpoint                  | Purpose                  |
| ------ | ------------------------- | ------------------------ |
| GET    | `/wallet/me`              | Get authenticated wallet |
| GET    | `/wallet/me/transactions` | Get transaction history  |
| POST   | `/wallet/me/withdrawal`   | Create withdrawal        |
| GET    | `/wallet/me/withdrawals`  | Get withdrawal history   |

## Payout

| Method | Endpoint                      | Purpose               |
| ------ | ----------------------------- | --------------------- |
| GET    | `/payout-options`             | List payout options   |
| GET    | `/payout-options/{option_id}` | Get one payout option |

## Health

| Method | Endpoint  | Purpose             |
| ------ | --------- | ------------------- |
| GET    | `/`       | API identity/status |
| GET    | `/health` | Database/API health |

---

# Health API

## Root

```http
GET /
```

Returns basic API identity and status information.

## Health Check

```http
GET /health
```

The health endpoint verifies the API/database state.

A healthy response follows the project's health response structure, including status, database state, and API version.

---

# Deployment

The deployed architecture is:

```text
React Frontend
      │
      │ HTTPS
      ▼
Render Frontend
      │
      │ HTTPS API
      ▼
Render FastAPI Backend
      │
      │ PyMongo
      ▼
MongoDB Atlas
```

The backend uses environment variables for sensitive configuration.

No production database credentials should be committed to GitHub.

---

# Local Development

## Clone Repository

```bash
git clone https://github.com/samarth306/VELoop-Rewards.git
cd VELoop-Rewards
```

## Create Python Environment

Windows PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

## Install Backend Dependencies

```powershell
pip install -r requirements.txt
```

## Configure Environment

Create:

```text
.env
```

using:

```text
.env.example
```

as the template.

Never commit real secrets.

## Run Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Run Backend

Start the FastAPI application using the project's configured Python entry point and environment variables.

The deployed backend is:

```text
https://veloop-rewards-jj94.onrender.com
```

---

# Environment Variables

The project uses environment variables for configuration.

Typical configuration includes:

```text
MONGO_URI
JWT_SECRET
JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES
FRONTEND_URL
```

Additional variables may be used by the password-reset/email configuration.

Do not place real credentials in:

- README
- source code
- Postman collection
- GitHub repository
- screenshots
- public documentation

Use `.env.example` with placeholder values.

---

# Project Structure

```text
VELOop Project/
│
├── backend/
│   └── app/
│       ├── auth_service.py
│       ├── collections.py
│       ├── database.py
│       ├── jwt_service.py
│       ├── main.py
│       ├── reward_service.py
│       ├── wallet_service.py
│       │
│       └── models/
│           ├── audit_log.py
│           ├── auth.py
│           ├── payout_option.py
│           ├── user.py
│           ├── wallet.py
│           ├── wallet_transaction.py
│           └── withdrawal.py
│
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       └── ...
│
├── README.md
├── API_DOCUMENTATION.md
├── TEST_CASES.md
├── requirements.txt
├── .gitignore
├── .env.example
└── VELOOP_Rewards_Postman_Collection.json
```

---

# Important Files

## `backend/app/main.py`

Main FastAPI application.

Responsible for API routes, authentication integration, wallet endpoints, payout configuration, withdrawal processing, and related backend functionality.

## `backend/app/reward_service.py`

Reward-related backend service for daily claims and manual SVE/Token/Gem conversion.

## `backend/app/wallet_service.py`

Wallet operations and balance-related business logic.

## `frontend/src/App.jsx`

Main React frontend application.

## `frontend/src/App.css`

Frontend styling and responsive UI.

## `API_DOCUMENTATION.md`

Detailed API documentation.

## `TEST_CASES.md`

Testing scenarios and expected results.

## `VELOOP_Rewards_Postman_Collection.json`

API testing collection.

---

# Testing Checklist

The following scenarios should be tested before final submission.

## Authentication Tests

- Valid registration
- Duplicate registration
- Valid login
- Invalid password
- Invalid email
- Protected endpoint without JWT
- Invalid JWT
- Current user endpoint
- Profile update
- Change password
- Forgot password
- Reset password
- Expired reset token

## Wallet Tests

- Authenticated wallet loads
- Wallet values are returned from backend
- Correct user wallet is returned
- Unauthorized wallet request is rejected
- Transaction history loads
- Transaction history belongs only to current user

## Payout Tests

- Payout options load from backend
- Valid payout option accepted
- Invalid payout option rejected
- Valid denomination accepted
- Invalid denomination rejected
- Required VEs resolved from backend
- Frontend cannot choose arbitrary VEs deduction

## Withdrawal Tests

- Valid UPI withdrawal
- Valid bank withdrawal
- Valid UPI QR withdrawal
- Invalid payout details
- Insufficient VEs
- Duplicate request ID
- Successful withdrawal
- Withdrawal appears in history
- Wallet balance decreases correctly
- Ledger transaction is created
- Withdrawal status becomes `PENDING`

## Concurrency Tests

Example:

```text
Starting VEs = 10,000

Withdrawal A = 8,000
Withdrawal B = 8,000
```

Expected:

```text
Only one request succeeds.
The other request is rejected because the remaining
stored balance is insufficient.
```

## Frontend Manipulation Test

Try changing the browser-visible wallet value:

```text
VEs = 999999
```

Then submit a withdrawal.

Expected:

```text
Backend ignores the manipulated display value.
Backend uses the stored MongoDB wallet balance.
```

## Payout Manipulation Test

Try changing the request so that the client attempts to submit an arbitrary VEs deduction.

Expected:

```text
Backend resolves the required VEs from payout configuration.
```

---

# Recommended Demo Flow

A clean project demonstration can follow this sequence:

```text
1. Open live frontend
        ↓
2. Login
        ↓
3. Open Wallet
        ↓
4. Show backend-driven wallet balances
        ↓
5. Open transaction history
        ↓
6. Open Withdrawal
        ↓
7. Show payout methods loaded from backend
        ↓
8. Select payout denomination
        ↓
9. Show required VEs
        ↓
10. Enter payout details
        ↓
11. Review confirmation
        ↓
12. Submit withdrawal
        ↓
13. Backend validates request
        ↓
14. VEs conditionally deducted
        ↓
15. Withdrawal stored as PENDING
        ↓
16. Ledger transaction created
        ↓
17. Wallet refreshed
        ↓
18. Withdrawal history refreshed
```

---

# Example Payout Demonstration

For a ₹100 withdrawal:

```text
Selected payout:
₹100

Backend configuration:
10,000 VEs

Wallet before:
15,000 VEs

Required:
10,000 VEs

Wallet after:
5,000 VEs
```

The frontend does not calculate the authoritative deduction.

The backend resolves:

```text
₹100 → 10,000 VEs
```

from payout configuration.

---

# Example Insufficient Balance Demonstration

```text
Wallet:
5,000 VEs

Selected payout:
₹100

Required:
10,000 VEs
```

Result:

```text
Withdrawal rejected
Insufficient VEs balance
```

The stored wallet remains unchanged.

---

# Example Idempotency Demonstration

A request uses:

```text
request_id = unique-request-123
```

If the same request is submitted twice:

```text
First request  → Withdrawal created
Second request → Existing request detected
```

The system must not create two withdrawals for the same request ID and user.

---

# Transaction Consistency

A wallet transaction should preserve the relationship:

```text
balance_after
=
balance_before + credit - debit
```

For a withdrawal:

```text
balance_after
=
balance_before - required_ves
```

The transaction ledger provides the historical record required to inspect wallet movement.

---

# Auditability

Wallet-sensitive operations should be traceable through:

- wallet transaction ID
- withdrawal ID
- request ID
- user ID
- timestamp
- transaction status
- payout metadata

This makes it possible to understand why a wallet balance changed.

---

# API Documentation

The project includes API documentation separately in:

```text
API_DOCUMENTATION.md
```

Swagger documentation is also available from the deployed FastAPI application:

```text
https://veloop-rewards-jj94.onrender.com/docs
```

---

# Postman Collection

The project includes:

```text
VELOOP_Rewards_Postman_Collection.json
```

The collection is intended for API verification including authentication, wallet, payout, and withdrawal flows.

Use environment variables rather than committing access tokens or credentials.

---

# Test Documentation

Testing scenarios are documented in:

```text
TEST_CASES.md
```

Important backend cases include:

- normal credit
- normal withdrawal
- insufficient balance
- duplicate withdrawal
- concurrent withdrawal
- invalid payout option
- invalid denomination
- unauthorized wallet access
- invalid payout destination
- frontend request manipulation

---

# Scaling Considerations

The current project is a demonstration deployment. A production-scale wallet system would require additional engineering.

## Database Transactions

For operations involving multiple collections, MongoDB transactions can be used where required.

## Atomic Wallet Updates

Balance-sensitive operations should remain conditional and server-side.

## Ledger

A production wallet should retain an append-oriented ledger suitable for reconciliation.

## Idempotency

Money-moving operations should continue to use idempotency keys and suitable unique indexes.

## Indexing

Frequently queried fields should have appropriate indexes, including:

```text
user_id
request_id
transaction_id
withdrawal_id
created_at
status
```

## Queues

Long-running external payout processing can be moved to background workers or queues.

## Caching

Caching can be used for non-authoritative configuration or derived information.

Cached values must never become the authoritative wallet balance.

## Rate Limiting

Production systems should apply route-specific rate limiting to:

- login
- registration
- password recovery
- reward-credit operations
- withdrawal operations

## Fraud Detection

Production payout systems should add:

- velocity checks
- anomaly detection
- duplicate behavior detection
- account-level controls
- withdrawal risk rules

## Audit Logging

Important administrative and wallet-state actions should be logged.

## Reconciliation

Wallet balances, transaction ledger entries, and payout records should be periodically reconciled.

## Monitoring

Production systems should use:

- structured logs
- metrics
- alerting
- database monitoring
- error tracking

---

# Final Submission Checklist

Before submitting the project, verify:

## Backend

- [ ] FastAPI backend starts successfully
- [ ] MongoDB connection works
- [ ] `/health` returns healthy
- [ ] Authentication works
- [ ] JWT protection works
- [ ] Wallet endpoint works
- [ ] Transaction endpoint works
- [ ] Payout options endpoint works
- [ ] Withdrawal endpoint works
- [ ] Withdrawal history works
- [ ] Insufficient balance is rejected
- [ ] Invalid payout option is rejected
- [ ] Invalid denomination is rejected
- [ ] Invalid payout details are rejected
- [ ] Duplicate request IDs are handled
- [ ] Concurrent withdrawal protection works
- [ ] Wallet ledger records are created

## Frontend

- [ ] Login works
- [ ] Registration works
- [ ] Wallet loads from backend
- [ ] Transaction history loads
- [ ] Payout methods load from backend
- [ ] Payout denominations load from backend
- [ ] Withdrawal confirmation works
- [ ] Successful withdrawal refreshes wallet
- [ ] Successful withdrawal refreshes history
- [ ] Error states work
- [ ] Loading states work
- [ ] Responsive layout works
- [ ] Manual reward conversion works per currency and amount
- [ ] Conversion rates come from backend configuration

## Documentation

- [ ] README.md is complete
- [ ] API_DOCUMENTATION.md is included
- [ ] TEST_CASES.md is included
- [ ] Postman collection is included
- [ ] `.env.example` is included
- [ ] Real `.env` is not committed
- [ ] Secrets are not committed

## Deployment

- [ ] GitHub repository is available
- [ ] Frontend deployment is available
- [ ] Backend deployment is available
- [ ] Swagger documentation is available
- [ ] Health endpoint is available

---

# Final Links

## GitHub

https://github.com/samarth306/VELoop-Rewards

## Frontend

https://veloop-rewards-frontend-ggzf.onrender.com

## Backend

https://veloop-rewards-jj94.onrender.com

## Swagger

https://veloop-rewards-jj94.onrender.com/docs

## Health

https://veloop-rewards-jj94.onrender.com/health

---

# Project Summary

VELOOP Rewards is a backend-driven wallet and payout demonstration built with:

- FastAPI
- Python
- MongoDB Atlas
- React
- Vite

The implementation focuses on:

- server-authoritative wallet data
- authenticated user access
- backend-controlled payout configuration
- validated payout destinations
- safe VEs deduction
- transaction traceability
- idempotent withdrawal handling
- concurrency-safe balance protection
- persistent MongoDB records
- password recovery
- a polished demonstration frontend

The final payout mapping is:

```text
₹10    → 1,000 VEs
₹25    → 2,500 VEs
₹50    → 5,000 VEs
₹100   → 10,000 VEs
₹150   → 15,000 VEs
₹300   → 30,000 VEs
₹500   → 50,000 VEs
₹1,000 → 100,000 VEs
```

The backend remains the authoritative source for wallet balances, payout configuration, withdrawal validation, and wallet transactions.
