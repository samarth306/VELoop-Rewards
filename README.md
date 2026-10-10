# VELOOP Rewards — Wallet & Payout System

A backend-driven digital rewards wallet and payout demonstration built with **Python, FastAPI, MongoDB Atlas, React, and Vite**.

The core design principle is simple: **the backend is the source of truth** for wallet balances, payout configuration, withdrawal validation, and transaction records. The frontend displays data returned by the API; it does not determine the authoritative VEs cost of a withdrawal.

## Live Links

- **Frontend:** https://veloop-rewards-frontend-ggzf.onrender.com
- **Backend API:** https://veloop-rewards-jj94.onrender.com
- **Swagger API documentation:** https://veloop-rewards-jj94.onrender.com/docs
- **Health check:** https://veloop-rewards-jj94.onrender.com/health
- **GitHub repository:** https://github.com/samarth306/VELoop-Rewards

> Live services may take time to wake up on a free hosting tier. Do not put passwords, API keys, database credentials, or access tokens in public issues, screenshots, or documentation.

## Project reports

- [Audit report](docs/AUDIT_REPORT.md)
- [Change report](docs/CHANGE_REPORT.md)
- [Final audit notes](docs/FINAL_AUDIT.md)

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Wallet and Transaction Ledger](#wallet-and-transaction-ledger)
6. [Payout Configuration](#payout-configuration)
7. [Payout Methods](#payout-methods)
8. [Withdrawal Lifecycle](#withdrawal-lifecycle)
9. [Validation and Safety Controls](#validation-and-safety-controls)
10. [Authentication and Password Recovery](#authentication-and-password-recovery)
11. [API Reference](#api-reference)
12. [Database Overview](#database-overview)
13. [Local Setup](#local-setup)
14. [Environment Variables](#environment-variables)
15. [Project Structure](#project-structure)
16. [Tests and Build Checks](#tests-and-build-checks)
17. [Suggested Demo Flow](#suggested-demo-flow)
18. [Operational Notes and Limitations](#operational-notes-and-limitations)
19. [Future Production Improvements](#future-production-improvements)

## Project Overview

VELOOP Rewards is a demonstration application for an authenticated rewards wallet and payout workflow. It focuses on backend-controlled wallet operations, payout configuration, input validation, withdrawal records, and transaction traceability.

The wallet can display these reward balances:

- **VEs** — the payout/redemption currency.
- **SVEs**
- **Gems**
- **Tokens**

Reward conversion is performed through the backend using configured rules. The backend should validate every request and record applicable wallet changes; client-side display values are not authoritative.

## Features

### Authentication and account management

- User registration and login.
- JWT Bearer authentication for protected endpoints.
- Password hashing.
- Current-user profile and supported profile updates.
- Change-password flow.
- Forgot-password and reset-password endpoints.
- User-specific authorization for wallet data.

### Wallet and transaction history

- Authenticated wallet retrieval.
- VEs, SVEs, Gems, and Tokens balance display.
- Wallet transaction history.
- Credit/debit records with balance-before and balance-after fields where applicable.
- Withdrawal history and wallet refresh after a successful withdrawal.

### Payout and withdrawals

- Payout options loaded from the backend.
- Server-side denomination and VEs-cost configuration.
- UPI, Bank Transfer, UPI QR, Amazon Gift Card, and Google Play Gift Card options when active in backend configuration.
- Payout destination validation.
- Withdrawal confirmation and pending status.
- Request-ID-based duplicate-submission protection.
- Insufficient-balance checks and conditional wallet deduction.
- Withdrawal and wallet-transaction records for traceability.

### Frontend experience

- Responsive React/Vite interface.
- Dark dashboard styling.
- Wallet overview, recent activity, and transaction history.
- Payout method and denomination selection.
- Withdrawal details and confirmation.
- Profile controls, loading states, and error/success feedback.
- Reward-related interface elements, including manual conversion where configured.

## Technology Stack

| Area            | Technology                             |
| --------------- | -------------------------------------- |
| Backend         | Python, FastAPI, Pydantic              |
| Database access | PyMongo                                |
| Database        | MongoDB Atlas                          |
| Authentication  | JWT Bearer tokens and password hashing |
| Frontend        | React, Vite, JavaScript, CSS           |
| Hosting         | Render                                 |
| API exploration | FastAPI Swagger UI                     |

## Architecture

```text
React + Vite frontend
        |
        | HTTPS / JSON / Bearer token
        v
FastAPI backend
  - Authentication and authorization
  - Wallet and transaction services
  - Reward operations
  - Payout configuration
  - Withdrawal validation and processing
        |
        | PyMongo
        v
MongoDB Atlas
  - Users
  - Wallets
  - Wallet transactions
  - Withdrawals
  - Payout options
  - Audit records, where configured
```

The frontend requests data from the API. For wallet-sensitive operations, the backend identifies the user from the authenticated session and reads the stored wallet and payout configuration before processing the request.

## Wallet and Transaction Ledger

### Get the authenticated wallet

```http
GET /wallet/me
Authorization: Bearer <access_token>
```

The endpoint returns the wallet associated with the authenticated user. A browser-visible balance is only display data: changing it in the client does not change the balance stored in MongoDB.

### Get transaction history

```http
GET /wallet/me/transactions
Authorization: Bearer <access_token>
```

Transaction records may include fields such as transaction ID, currency, type, amount, balance before/after, source, reference ID, status, metadata, and timestamps.

The ledger helps explain wallet movements and connect a withdrawal to its corresponding transaction.

## Payout Configuration

The frontend loads payout choices from the backend instead of treating its own UI values as authoritative.

### List payout options

```http
GET /payout-options
```

### Get one payout option

```http
GET /payout-options/{option_id}
```

The backend configuration determines the payout method, denomination, option identity, and required VEs. The client must not be trusted to submit an arbitrary VEs deduction.

### Payout mapping from the project task PDF

The project’s configured UPI-style payout mapping is:

| Payout value | Required VEs |
| -----------: | -----------: |
|          ₹10 |        2,400 |
|          ₹25 |        5,800 |
|          ₹50 |       10,000 |
|         ₹100 |       19,500 |
|         ₹150 |       28,500 |
|         ₹300 |       52,500 |
|         ₹500 |       80,500 |
|       ₹1,000 |      150,000 |

These values are configuration, not a universal exchange rate. The API’s active payout-option records are the runtime source of truth. If an operator changes the database configuration, the runtime options may differ from this documentation; update this table when an approved configuration change is made.

## Payout Methods

The backend configuration can include:

- **UPI**
- **Bank Transfer**
- **UPI QR**
- **Amazon Gift Card**
- **Google Play Gift Card**

The methods and denominations actually available to a user depend on the active options returned by `GET /payout-options`.

For gift-card requests, the destination is an email address. The project does **not** include an external gift-card provider integration; gift-card fulfilment is manual and should remain pending until an operator has completed the fulfilment and reviewed the request. Do not assume gift-card denominations or pricing are independently verified by a third-party provider.

## Withdrawal Lifecycle

The intended request flow is:

1. The authenticated user loads the available payout options.
2. The user selects a method and a configured denomination.
3. The user enters the destination details and confirms the request.
4. The frontend sends the payout option, destination details, and a unique `request_id`.
5. The backend authenticates the user and validates the payout option, denomination, destination, and request ID.
6. The backend resolves the required VEs from server-side configuration.
7. The backend checks the stored wallet balance and attempts a conditional deduction.
8. The backend creates the withdrawal and corresponding wallet transaction records.
9. The API returns the withdrawal status; newly accepted requests use `PENDING`.
10. The frontend refreshes the wallet and relevant history.

The request endpoint is:

```http
POST /wallet/me/withdrawal
Authorization: Bearer <access_token>
Content-Type: application/json
```

Use the request schema shown in the deployed Swagger documentation (`/docs`) as the definitive reference for required JSON fields.

### Withdrawal history

```http
GET /wallet/me/withdrawals
Authorization: Bearer <access_token>
```

The endpoint returns withdrawal records belonging to the authenticated user.

## Validation and Safety Controls

The backend is responsible for enforcing the rules below:

- Reject unauthenticated requests to protected endpoints.
- Use the authenticated user identity rather than a client-supplied wallet owner.
- Reject unknown or inactive payout options.
- Reject denominations that are not configured for the selected option.
- Resolve the required VEs from server-side payout configuration.
- Validate destination details for the selected payout method.
- Reject a withdrawal when the stored balance is insufficient.
- Use a conditional wallet update so simultaneous requests cannot both spend the same available balance.
- Use a request ID to detect repeated submissions.
- Keep wallet and withdrawal history scoped to the authenticated user.
- Avoid exposing sensitive payout destination details unnecessarily in UI history.

### Idempotency and duplicate protection

Withdrawal requests use a client-generated `request_id`. Reusing the same ID should not create a second debit. If the same ID is submitted with a different payload, the API should reject the conflicting request rather than silently treating it as the original request.

### Concurrency example

Suppose the stored balance is **10,000 VEs**, and two requests each attempt to withdraw **8,000 VEs**. Both must not succeed. The conditional database update should allow at most one deduction; the other request should fail because the current balance is insufficient.

### Failure handling

Multi-step wallet operations must be designed to avoid a debit without a corresponding withdrawal/ledger record. The implementation includes compensation handling for certain persistence failures. This is not a substitute for reviewing transaction boundaries and failure cases before production use.

## Authentication and Password Recovery

### Authentication endpoints

| Method  | Endpoint                | Purpose                            |
| ------- | ----------------------- | ---------------------------------- |
| `POST`  | `/auth/register`        | Register an account                |
| `POST`  | `/auth/login`           | Authenticate and obtain a token    |
| `GET`   | `/auth/me`              | Get the current user               |
| `PATCH` | `/auth/me`              | Update supported profile fields    |
| `POST`  | `/auth/change-password` | Change password                    |
| `POST`  | `/auth/forgot-password` | Start password recovery            |
| `POST`  | `/auth/reset-password`  | Reset password using a valid token |

The forgot-password flow should return a generic response so that the endpoint does not disclose whether a particular email is registered. Reset tokens should expire and be invalidated after successful use.

Password reset delivery depends on the email/reset configuration available in the deployment. Verify the configured delivery path before relying on it in a live demonstration.

## API Reference

The deployed Swagger UI provides the most current route list and request/response schemas:

**https://veloop-rewards-jj94.onrender.com/docs**

Key routes documented for this project include:

| Method  | Endpoint                      | Purpose                 |
| ------- | ----------------------------- | ----------------------- |
| `POST`  | `/auth/register`              | Register                |
| `POST`  | `/auth/login`                 | Login                   |
| `GET`   | `/auth/me`                    | Current user            |
| `PATCH` | `/auth/me`                    | Update profile          |
| `POST`  | `/auth/change-password`       | Change password         |
| `POST`  | `/auth/forgot-password`       | Start reset flow        |
| `POST`  | `/auth/reset-password`        | Reset password          |
| `GET`   | `/wallet/me`                  | Get wallet              |
| `GET`   | `/wallet/me/transactions`     | Get transaction history |
| `POST`  | `/wallet/me/withdrawal`       | Create withdrawal       |
| `GET`   | `/wallet/me/withdrawals`      | Get withdrawal history  |
| `GET`   | `/payout-options`             | List payout options     |
| `GET`   | `/payout-options/{option_id}` | Get a payout option     |
| `GET`   | `/`                           | API identity/status     |
| `GET`   | `/health`                     | API/database health     |

Additional routes may exist in the implementation. Use Swagger rather than assuming this table is exhaustive.

## Database Overview

MongoDB Atlas is used for persistent application data. The logical data areas include:

- Users and authentication-related fields.
- Wallet balances.
- Wallet transaction ledger entries.
- Withdrawal requests and their statuses.
- Payout option configuration.
- Audit records, where configured.

User-specific API access should be based on the authenticated identity. Do not accept a client-provided user ID as proof that the caller owns a wallet.

## Local Setup

### Prerequisites

Install a supported Python version, Node.js/npm, and ensure the MongoDB Atlas database is reachable from your development environment.

### 1. Clone the repository

```bash
git clone https://github.com/samarth306/VELoop-Rewards.git
cd VELOop-Rewards
```

### 2. Create and activate a Python virtual environment

Windows PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use an approved local execution-policy option or activate the environment using your preferred terminal.

### 3. Install backend dependencies

From the repository root:

```powershell
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a local `.env` file using `.env.example` as a template. Set valid local values for the variables required by the application. Never commit the real `.env` file.

### 5. Start the backend

From the repository root, run the project's entry-point script (it starts `backend.app.main:app` through Uvicorn):

```powershell
python start.py
```

The local API is normally available at `http://127.0.0.1:8000`; Swagger is at `http://127.0.0.1:8000/docs`.

### 6. Start the frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local frontend URL in the terminal. Open that URL in a browser.

## Environment Variables

The application uses environment variables for sensitive configuration. Depending on the enabled features, `.env.example` may include entries for:

- `MONGO_URI`
- `JWT_SECRET`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `FRONTEND_URL`
- Password-reset/email configuration
- `ADMIN_WITHDRAWAL_KEY` for protected administrative withdrawal review, if enabled

Use the exact variable names and requirements in the repository's `.env.example` and backend settings code. Never put real credentials in the README, source code, Postman collection, screenshots, or public repository. Use a strong, unique `JWT_SECRET`; configure deployment secrets in Render's Environment settings.

## Project Structure

```text
VELoop-Rewards/
├── backend/
│   └── app/
│       ├── auth_service.py
│       ├── collections.py
│       ├── database.py
│       ├── jwt_service.py
│       ├── main.py
│       ├── reward_service.py
│       ├── wallet_service.py
│       └── models/
│           ├── audit_log.py
│           ├── auth.py
│           ├── payout_option.py
│           ├── user.py
│           ├── wallet.py
│           ├── wallet_transaction.py
│           └── withdrawal.py
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       └── ...
├── README.md
├── API_DOCUMENTATION.md
├── TEST_CASES.md
├── docs/
│   ├── AUDIT_REPORT.md
│   ├── CHANGE_REPORT.md
│   └── FINAL_AUDIT.md
├── start.py
├── requirements.txt
├── .gitignore
├── .env.example
└── VELOOP_Rewards_Postman_Collection.json
```

This is a high-level view; exact files can change as the project evolves.

## Tests and Build Checks

Run these checks from the repository root after installing dependencies.

### Backend tests

```powershell
python -m unittest discover -s tests -v
```

### Frontend production build

```powershell
npm run build --prefix frontend
```

Also verify the API and database connection locally:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/payout-options | ConvertTo-Json -Depth 8
```

The test suite and build output reflect the code and environment at the time they are run. Re-run them after changing source files or configuration; a successful local check alone does not prove that the deployed service has the same configuration.

## Suggested Demo Flow

1. Open the live frontend.
2. Register or sign in with a test account.
3. Show the wallet balances.
4. Open transaction history.
5. Open the withdrawal interface.
6. Show payout methods and denominations loaded from the API.
7. Enter valid destination details.
8. Review and submit a withdrawal only with a suitable test account and balance.
9. Show the resulting pending withdrawal and transaction history.
10. Open Swagger to explain the API routes and server-side validation.

Do not use real sensitive banking details or expose credentials during a recording or screen share.

## Operational Notes and Limitations

- **Demonstration project:** This repository demonstrates wallet and payout workflow patterns; it is not a regulated payment processor.
- **Gift-card fulfilment:** Amazon and Google Play gift-card requests are manually fulfilled. No external gift-card provider integration is included.
- **Payout rates:** Runtime rates come from active backend configuration. The table above documents the project task mapping; keep documentation aligned with any approved database changes.
- **Administrative review:** If the administrative withdrawal-review route is enabled, protect it with a strong secret stored only in deployment environment settings. Do not expose that secret to the frontend or commit it to source control.
- **Rate limiting:** In-process throttling, if configured, does not coordinate limits across multiple API instances. A scaled deployment needs a shared limiter or gateway.
- **Multi-document consistency:** Review MongoDB transaction support and error recovery carefully before treating the system as production-ready.
- **Production readiness:** Perform security review, monitoring, backup/recovery planning, reconciliation, and end-to-end testing before handling real funds or sensitive financial data.

## Future Production Improvements

A production-grade wallet would typically need additional work, including:

- MongoDB transactions or another robust consistency strategy for multi-document operations.
- A durable, append-oriented ledger and reconciliation process.
- Unique indexes and tested idempotency constraints.
- Centralized rate limiting, structured logs, metrics, and alerting.
- Withdrawal risk rules, velocity checks, and fraud monitoring.
- Background workers or queues for external payout processing.
- A real provider integration with secure callbacks and reconciliation, where applicable.
- Automated integration tests for concurrent withdrawals and failure recovery.
- Formal secrets rotation and operational access controls.

---

## Project Summary

VELOOP Rewards combines a React/Vite frontend with a Python/FastAPI backend and MongoDB Atlas. Its main focus is authenticated wallet access, server-controlled payout configuration, withdrawal validation, balance protection, and transaction traceability.

- **Frontend:** https://veloop-rewards-frontend-ggzf.onrender.com
- **Backend:** https://veloop-rewards-jj94.onrender.com
- **Swagger:** https://veloop-rewards-jj94.onrender.com/docs
- **Repository:** https://github.com/samarth306/VELoop-Rewards
