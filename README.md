# Personal Finance Tracker - Backend API

Robust, lightweight Node.js/Express REST API powering the Personal Finance Tracker frontend.

## Features

- **Authentication**: JWT token generation and verification with bcryptjs hashed passwords.
- **Transactions**: Full CRUD operations with category filtering, date ranges, text search, and pagination.
- **Budget Tracking**: Monthly budget allocation per category (or overall `ALL`), calculating real-time spend and usage percentages.
- **Financial Statistics**:
  - Summary metrics: total income, total expenses, net balance.
  - Category breakdown: spending distribution with percentage shares.
  - Monthly cashflow: 12-month income vs expenses trends.
- **Persistent Data Store**: JSON file-based database (`backend/data/db.json`), requiring zero external database installations to run.

## Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```env
PORT=5000
JWT_SECRET=supersecret_finance_tracker_jwt_key_2026
NODE_ENV=development
```

### 3. Run the Server
```bash
# Production / Start
npm start

# Development mode (Node watch mode)
npm run dev
```

The API will be available at `http://localhost:5000`.
