# VELOop Rewards

A full-stack digital rewards wallet and payout system built with Python FastAPI, MongoDB, and React.

## Live Demo

Frontend: https://veloop-rewards-frontend-ggzf.onrender.com

Backend API: https://veloop-rewards-jj94.onrender.com

API Documentation: https://veloop-rewards-jj94.onrender.com/docs

## Tech Stack

- Python
- FastAPI
- MongoDB
- React
- Vite
- JWT Authentication
- Render

## Core Features

- User registration and login
- JWT-based authentication
- Secure password hashing
- Wallet balance management
- VEs, SVEs, Gems, Tokens and Spins
- Reward transactions
- Transaction history
- Withdrawal requests
- Backend-controlled payout methods
- Payout denomination validation
- Withdrawal status tracking
- Balance validation
- Idempotent withdrawal requests
- Audit logging
- MongoDB persistence

## Wallet Flow

Login → Wallet → View Balance → Transactions → Select Withdrawal → Choose Payout Method → Enter Payout Details → Submit Withdrawal → Backend Validation → VEs Reserved → Withdrawal Status

## Backend

The FastAPI backend acts as the source of truth for wallet balances, transactions, rewards and withdrawals.

## Frontend

The React frontend provides the user interface for authentication, wallet balances, transaction history and withdrawal management.

## Deployment

The application is deployed using Render with MongoDB Atlas as the database.

## Repository

https://github.com/samarth306/VELoop-Rewards
