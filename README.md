# VELOOP Rewards â€” Wallet & Payout System

A backend-driven digital rewards wallet and payout demonstration system built with Python, FastAPI, MongoDB Atlas, and React.

The project is designed around a core rule:

> The backend is the source of truth for wallet balances, transactions, payout configuration, validation, and withdrawal processing.

The React frontend provides the user interface and consumes the deployed FastAPI APIs.

---

## Project Overview

VELOOP Rewards manages the following wallet assets:

- VEs
- SVEs
- Gems
- Tokens
- Spins

The current payout flow uses VEs for supported redemption requests.

### Core capabilities

- User registration and login
- JWT-based authentication
- Password hashing
- Profile retrieval and update
- Change password
- Forgot-password and reset-password flow
- Backend-driven wallet balances
- Wallet transaction history
- Backend-controlled payout options
- Payout denomination validation
- Payout destination validation
- Withdrawal requests
- Withdrawal status tracking
- Idempotent withdrawal request handling
- Server-side balance validation
- Wallet transaction / ledger records
- MongoDB persistence
- Health and API documentation endpoints
- Live frontend and backend deployment

---

## Live Links

### Frontend

https://veloop-rewards-frontend-ggzf.onrender.com

### Backend API

https://veloop-rewards-jj94.onrender.com

### FastAPI Swagger Docs

https://veloop-rewards-jj94.onrender.com/docs

### Health Check

https://veloop-rewards-jj94.onrender.com/health

### GitHub Repository

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

# Architecture

```text
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚      React Frontend      â”‚
                    â”‚                          â”‚
                    â”‚ Login                    â”‚
                    â”‚ Wallet                   â”‚
                    â”‚ Transactions             â”‚
                    â”‚ Withdrawals              â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                 â”‚
                                 â”‚ HTTPS / JSON
                                 â–¼
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚       FastAPI API        â”‚
                    â”‚                          â”‚
                    â”‚ Authentication           â”‚
                    â”‚ Wallet                   â”‚
                    â”‚ Transactions             â”‚
                    â”‚ Payout Options           â”‚
                    â”‚ Withdrawal Validation    â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                 â”‚
                                 â–¼
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚       MongoDB Atlas       â”‚
                    â”‚                          â”‚
                    â”‚ Users                    â”‚
                    â”‚ Wallets                  â”‚
                    â”‚ Wallet Transactions      â”‚
                    â”‚ Withdrawals              â”‚
                    â”‚ Payout Configuration     â”‚
                    â”‚ Audit Logs               â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

# Backend Source of Truth

The frontend does not own the authoritative wallet balance.

The authenticated frontend requests the wallet from:

```http
GET /wallet/me
```

The backend loads the wallet for the authenticated user and returns the stored balances.

The frontend displays the returned values and uses the backend response as the basis for the UI.

Payout configuration is loaded from the backend through:

```http
GET /payout-options
```

The frontend does not determine the authoritative VEs cost of a payout.

---

# Authentication

JWT authentication is used for protected APIs.

### Login flow

```text
User enters credentials
        â†“
POST /auth/login
        â†“
Backend validates email and password
        â†“
JWT access token returned
        â†“
Frontend uses Bearer token
        â†“
Protected wallet APIs identify the authenticated user
```

Invalid credentials return an authentication error, and inactive accounts are rejected.

Passwords are stored as password hashes rather than plain text.

---

# Authentication Endpoints

## Register

```http
POST /auth/register
```

Creates a user account and returns an access token.

## Login

```http
POST /auth/login
```

Authenticates a user and returns a JWT access token.

## Current User

```http
GET /auth/me
```

Authentication required.

Returns the current user's public account information.

## Update Profile

```http
PATCH /auth/me
```

Authentication required.

Updates the user's profile name.

## Change Password

```http
POST /auth/change-password
```

Authentication required.

The current password is verified before the new password is stored.

The new password must be different from the current password.

## Forgot Password

```http
POST /auth/forgot-password
```

Starts the password reset flow.

The endpoint uses a generic response so the response does not disclose whether a particular email address exists in the system.

A reset-token hash and expiry are stored for a valid account.

## Reset Password

```http
POST /auth/reset-password
```

Uses a valid and unexpired reset token to update the user's password.

The reset token hash is removed after a successful reset.

---

# Wallet Endpoints

## Get My Wallet

```http
GET /wallet/me
```

Authentication required.

Returns the authenticated user's wallet.

Supported wallet fields:

```text
ves
sves
gems
tokens
spins
```

The wallet is loaded from MongoDB for the authenticated user's user ID.

---

# Transaction History

## Get My Transactions

```http
GET /wallet/me/transactions
```

Authentication required.

Returns transaction records belonging to the authenticated user.

Results are sorted by `created_at` in descending order.

A transaction record can contain:

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

---

# Payout Configuration

## List Payout Options

```http
GET /payout-options
```

Returns the backend-controlled payout configuration.

The response identifies the supported currency and available payout options.

## Get a Single Payout Option

```http
GET /payout-options/{option_id}
```

Returns the configuration for a specific payout option.

---

# Withdrawal Flow

The withdrawal flow is server-driven.

```text
Wallet
   â†“
Choose Withdrawal
   â†“
Load payout options from backend
   â†“
Select payout method
   â†“
Select payout denomination
   â†“
Enter payout details
   â†“
Review confirmation
   â†“
POST /wallet/me/withdrawal
   â†“
Backend validates payout option
   â†“
Backend validates denomination
   â†“
Backend resolves required VEs
   â†“
Backend validates payout destination
   â†“
Backend checks request ID
   â†“
Backend checks available VEs
   â†“
Conditional wallet deduction
   â†“
Withdrawal record created
   â†“
Wallet transaction created
   â†“
Withdrawal status = PENDING
   â†“
Frontend refreshes wallet and history
```

---

# Withdrawal Endpoints

## Create Withdrawal

```http
POST /wallet/me/withdrawal
```

Authentication required.

The request contains:

- payout amount / denomination
- payout option ID
- payout details
- request ID

The server resolves the required VEs from the selected payout configuration.

The client does not provide the authoritative VEs cost.

## Get My Withdrawals

```http
GET /wallet/me/withdrawals
```

Authentication required.

Returns withdrawal requests belonging to the authenticated user.

Withdrawal records can contain:

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

---

# Current Payout Values

The currently configured payout mapping is:

| Payout Value | Required VEs |
|---:|---:|
| â‚¹10 | 2,400 VEs |
| â‚¹25 | 5,800 VEs |
| â‚¹50 | 10,000 VEs |
| â‚¹100 | 19,500 VEs |
| â‚¹150 | 28,500 VEs |
| â‚¹300 | 52,500 VEs |
| â‚¹500 | 80,500 VEs |
| â‚¹1,000 | 150,000 VEs |

These values are part of the backend payout configuration. The frontend uses the payout-option response instead of treating these values as the authoritative business rule.

---

# Withdrawal Validation

The implemented withdrawal flow performs these server-side checks:

1. Validate the payout option.
2. Validate the selected denomination.
3. Resolve the required VEs from backend configuration.
4. Validate payout destination details.
5. Check the request ID for an existing request from the same user.
6. Read the current wallet balance.
7. Deduct VEs only when the wallet contains enough VEs.
8. Create the withdrawal record.
9. Create the corresponding wallet transaction.
10. Return the created withdrawal.
11. Restore the deducted VEs if record persistence fails during the implemented compensation path.

---

# Insufficient Balance Protection

The wallet update uses a conditional database update based on the stored VEs balance.

Conceptually:

```text
Only update the wallet when:

ves >= required_ves
```

Otherwise the backend returns:

```text
Insufficient VEs balance
```

This means the client cannot simply replace the displayed balance with a larger number and have the server accept an invalid withdrawal.

---

# Idempotency

Withdrawal requests accept a `request_id`.

Before creating a new withdrawal, the backend checks for an existing withdrawal belonging to the same authenticated user with the same request ID.

This protects against duplicate submissions such as:

- Double-click submission
- Network retry
- Client retry
- Browser resubmission

When an existing request is found, the existing withdrawal record can be returned instead of creating a second request.

---

# Wallet Transactions / Ledger

Wallet changes are represented by wallet transaction records.

For a withdrawal, the ledger record stores the VEs movement and the payout context, including:

```text
transaction_id
user_id
currency = ves
type = WITHDRAWAL
amount = required VEs
balance_before
balance_after
source = withdrawal
reference_id = withdrawal ID
status
description
metadata
created_at
updated_at
```

The metadata also preserves the payout option, payout type, payout value, and required VEs.

---

# Database Architecture

MongoDB Atlas is the persistent database.

The project contains backend models for:

```text
User
Auth
Wallet
WalletTransaction
Withdrawal
PayoutOption
AuditLog
```

The application also keeps separate collection references for users, wallets, transactions, withdrawals, and payout configuration.

User-specific wallet and transaction access is based on the authenticated user's `user_id`.

---

# Security

## Authentication

JWT Bearer authentication protects authenticated wallet, transaction, profile, and withdrawal operations.

## Authorization

Authenticated APIs operate on the current authenticated user's identity rather than accepting a client-selected wallet owner.

## Password Protection

Passwords are hashed before storage.

## Validation

Pydantic request models validate input fields before business logic executes.

Payout destination details are validated according to the selected payout option.

## Server-Authoritative Wallet

The actual wallet values are loaded from MongoDB on the backend.

## Server-Authoritative Payout Cost

The required VEs value is resolved by the backend from payout configuration.

## Reset Token Protection

Password reset tokens are hashed before storage and checked against their expiry time.

## Sensitive Local Configuration

Sensitive values remain outside source control. The local `.env` file and `token.txt` file are ignored by Git.

---

# Health API

## Root

```http
GET /
```

Returns basic API identity, version, status, and the `/docs` path.

## Health Check

```http
GET /health
```

Checks the MongoDB connection and returns the API health status.

Example successful response:

```json
{
  "status": "healthy",
  "database": "connected",
  "version": "..."
}
```

---

# Frontend

The React frontend provides a polished dark-theme wallet experience with:

- Login and registration
- Password recovery and reset UI
- Wallet overview
- VEs, SVEs, Gems, Tokens and Spins cards
- Recent wallet activity
- Transaction history
- Withdrawal page
- Backend-driven payout methods
- Backend-driven payout denominations
- Payout detail forms
- Withdrawal confirmation
- Withdrawal history
- Profile controls
- Responsive layouts

The frontend is designed as a demonstration layer over the FastAPI backend.

---

# Recommended Demo Flow

Use the following sequence during the project demonstration:

```text
Login
  â†“
Wallet
  â†“
Backend wallet balances
  â†“
Transaction history
  â†“
Withdrawal
  â†“
Payout options from backend
  â†“
Select denomination
  â†“
Backend resolves required VEs
  â†“
Enter payout details
  â†“
Confirmation
  â†“
Submit withdrawal
  â†“
Server validation
  â†“
VEs deducted
  â†“
Withdrawal record created
  â†“
Ledger transaction created
  â†“
Status = PENDING
  â†“
Wallet refreshed
  â†“
Withdrawal history refreshed
```

---

# Testing Checklist

The following scenarios should be verified before final submission.

## Authentication

- Valid login
- Invalid login
- Protected endpoint without authentication
- Session expiry / invalid token
- Profile update
- Change password
- Forgot password
- Reset password

## Wallet

- Authenticated wallet loads correctly
- All supported wallet fields are returned
- Wallet values are read from the backend
- One user cannot use the frontend to select another user's wallet data

## Withdrawal

- Valid withdrawal
- Invalid payout option
- Invalid payout denomination
- Insufficient VEs balance
- Invalid payout destination
- Duplicate request ID
- Successful withdrawal creation
- Withdrawal appears in history
- Wallet balance changes after a successful withdrawal
- Withdrawal is recorded with a transaction reference

## Frontend Manipulation Test

Changing a browser-visible value such as:

```text
VEs = 999999
```

must not modify the actual wallet stored in the backend.

Likewise, the client must not be able to choose an arbitrary VEs deduction and bypass the backend payout configuration.

---

# Local Development

## Clone

```bash
git clone https://github.com/samarth306/VELoop-Rewards.git
cd VELoop-Rewards
```

## Python environment

Windows PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

## Install Python dependencies

```powershell
pip install -r requirements.txt
```

## Environment

Create a local `.env` file using the variable names and placeholder values documented in `.env.example`.

Never commit the real `.env` file.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

The Vite terminal prints the local development URL.

## Backend

Start the FastAPI application using the project's configured Python entry point and environment variables.

For the deployed environment:

https://veloop-rewards-jj94.onrender.com

---

# Project Structure

```text
VELOop Project/
â”‚
â”œâ”€â”€ backend/
â”‚   â””â”€â”€ app/
â”‚       â”œâ”€â”€ auth_service.py
â”‚       â”œâ”€â”€ collections.py
â”‚       â”œâ”€â”€ database.py
â”‚       â”œâ”€â”€ jwt_service.py
â”‚       â”œâ”€â”€ main.py
â”‚       â”œâ”€â”€ main_backup.py
â”‚       â”œâ”€â”€ transaction_service.py
â”‚       â”œâ”€â”€ wallet_service.py
â”‚       â”‚
â”‚       â””â”€â”€ models/
â”‚           â”œâ”€â”€ audit_log.py
â”‚           â”œâ”€â”€ auth.py
â”‚           â”œâ”€â”€ payout_option.py
â”‚           â”œâ”€â”€ user.py
â”‚           â”œâ”€â”€ wallet.py
â”‚           â”œâ”€â”€ wallet_transaction.py
â”‚           â””â”€â”€ withdrawal.py
â”‚
â”œâ”€â”€ frontend/
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ App.jsx
â”‚       â”œâ”€â”€ App.css
â”‚       â””â”€â”€ ...
â”‚
â”œâ”€â”€ README.md
â”œâ”€â”€ requirements.txt
â”œâ”€â”€ .gitignore
â””â”€â”€ .env.example
```

---

# API Summary

| Category | Main Endpoints |
|---|---|
| Authentication | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/change-password`, `/auth/forgot-password`, `/auth/reset-password` |
| Profile | `/auth/me` |
| Health | `/`, `/health` |
| Payout | `/payout-options`, `/payout-options/{option_id}` |
| Wallet | `/wallet/me` |
| Transactions | `/wallet/me/transactions` |
| Withdrawals | `/wallet/me/withdrawal`, `/wallet/me/withdrawals` |

The backend also contains demonstration/admin endpoints used for project maintenance and testing. Sensitive maintenance credentials must remain outside source control.

---

# Scaling Considerations

If the wallet architecture is expanded from a demonstration deployment to a much larger production system, the following areas would need additional engineering:

## Database Transactions

Use appropriate multi-document database transactions when an operation requires guaranteed atomic changes across multiple collections.

## Atomic Wallet Updates

Keep balance-sensitive updates conditional and server-side so the stored balance remains authoritative.

## Ledger Architecture

Maintain an append-oriented transaction history for auditability and reconciliation.

## Idempotency

Continue using idempotency keys on money-moving operations and enforce appropriate database uniqueness constraints.

## Indexing

Add indexes for frequently queried fields such as:

```text
user_id
request_id
transaction_id
withdrawal_id
created_at
status
```

## Queues

Move long-running payout processing to background workers or queues so external payout processing does not depend on a single API request.

## Caching

Use caching for read-heavy, non-authoritative data such as configuration or derived summaries. Do not use cached values as the authoritative wallet balance.

## Rate Limiting

Apply route-specific rate limiting to authentication, password recovery, reward-credit, and withdrawal-sensitive endpoints.

## Fraud Detection

Add velocity checks, anomaly detection, duplicate-behaviour checks, withdrawal risk rules, and account-level controls.

## Audit Logging

Record important administrative and wallet-state actions for traceability.

## Reconciliation

Periodically reconcile wallet balances, ledger transactions, and payout records.

## Monitoring

Add structured application logs, metrics, alerting, database monitoring, and error tracking.

---

# Submission Checklist

Before final submission, verify:

- Wallet is backend-driven
- VEs are server-authoritative
- Other wallet currencies are server-authoritative
- Wallet transactions are stored
- Withdrawal requests are stored
- Payout options come from the backend
- Payout values are not trusted from the frontend
- Insufficient balance is rejected
- Duplicate withdrawal requests are handled
- Authenticated APIs are protected
- Validation is implemented
- Frontend is connected to the backend
- Wallet flow works
- Withdrawal flow works
- README is complete
- API documentation is available
- `.env` is not committed
- Secrets are not committed
- GitHub repository is available
- Live frontend is available
- Live backend is available
- Test cases are documented
- Database/model documentation is included or documented

---

# Final Links

### GitHub

https://github.com/samarth306/VELoop-Rewards

### Frontend

https://veloop-rewards-frontend-ggzf.onrender.com

### Backend

https://veloop-rewards-jj94.onrender.com

### Swagger

https://veloop-rewards-jj94.onrender.com/docs

---

# Project Summary

VELOOP Rewards is a backend-driven wallet and payout demonstration built with FastAPI, MongoDB Atlas, and React.

The implementation focuses on:

- server-authoritative wallet data
- authenticated user access
- validated payout configuration
- safe VEs deduction
- transaction traceability
- idempotent withdrawal handling
- persistent MongoDB records
- a polished demonstration frontend


