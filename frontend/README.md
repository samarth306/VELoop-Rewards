# VELOOP Rewards Frontend

React + Vite demonstration interface for the VELOOP Rewards Wallet and Payout System.

## Features

- Dark premium wallet dashboard
- Authenticated wallet, transaction and withdrawal views
- Daily rewards with server-driven status
- Manual SVE / Token / Gem conversion
- Profile photo upload, camera capture and 30 illustrated avatar presets
- Client-side notification center with read state
- About VELOOP project page
- UPI QR scanning flow

## Local Development

```bash
npm install
npm run dev
```

Optional API override:

```text
VITE_API_URL=http://127.0.0.1:8000
```

For the deployed frontend, `VITE_API_URL` can point to the deployed FastAPI backend.
