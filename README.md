# Refrix — Referral Earnings Platform

A full-stack referral-based platform with M-Pesa Daraja integration, multi-level commission tracking, anti-fraud protection, and admin controls.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, Tailwind CSS, Zustand |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Payments | Safaricom M-Pesa Daraja API (STK Push) |
| Auth | JWT + bcrypt |

---

## Project Structure

```
refrix/
├── backend/
│   ├── src/
│   │   ├── config/         # DB config
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth, error handler
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routes
│   │   ├── services/       # M-Pesa, commissions
│   │   └── utils/          # Logger, seed admin
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── app/                # Next.js App Router pages
    │   ├── page.js         # Landing page
    │   ├── auth/           # Login & Register
    │   ├── dashboard/      # User dashboard
    │   ├── referrals/      # Referral stats
    │   ├── withdraw/       # Withdrawal page
    │   └── admin/          # Admin panel
    ├── components/         # Sidebar, shared UI
    ├── lib/                # API client, Zustand store
    └── package.json
```

---

## Business Rules

| Rule | Value |
|------|-------|
| Registration Fee | KES 500 |
| Direct Referral (L1) | KES 300 |
| 2nd Level (L2) | KES 100 |
| Min Withdrawal Balance | KES 1,500 |
| Min Qualified Referrals | 3 |
| Max Commission Depth | 2 levels |

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/yourname/refrix.git
cd refrix
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

### 3. Seed admin account

```bash
node src/utils/seedAdmin.js
```

### 4. Frontend setup

```bash
cd ../frontend
cp .env.local.example .env.local
# Edit .env.local
npm install
npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:5000

---

## M-Pesa Setup

1. Create account at https://developer.safaricom.co.ke
2. Create an app and get **Consumer Key** and **Consumer Secret**
3. Get your **Lipa Na M-Pesa Passkey** from the test credentials
4. For sandbox, use shortcode `174379`
5. Set `MPESA_ENV=sandbox` for testing, `MPESA_ENV=production` for live
6. Use **ngrok** for local callback URL testing:
   ```bash
   ngrok http 5000
   # Set MPESA_CALLBACK_URL=https://<ngrok-url>/api/payments/callback
   ```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/initiate` | Trigger STK Push |
| POST | `/api/payments/callback` | M-Pesa callback (webhook) |
| GET | `/api/payments/query/:id` | Poll payment status |
| GET | `/api/payments/my-transactions` | Transaction history |

### Referrals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/referrals/my-referrals` | My referrals + stats |
| GET | `/api/referrals/link` | Get referral link |

### Withdrawals
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/withdrawals/request` | Request withdrawal |
| GET | `/api/withdrawals/my-withdrawals` | Withdrawal history |

### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Platform stats |
| GET | `/api/admin/users` | List users |
| PATCH | `/api/admin/users/:id/ban` | Ban user |
| PATCH | `/api/admin/users/:id/unban` | Unban user |
| GET | `/api/admin/withdrawals` | Pending withdrawals |
| PATCH | `/api/admin/withdrawals/:id/approve` | Approve withdrawal |
| PATCH | `/api/admin/withdrawals/:id/reject` | Reject + refund |
| GET | `/api/admin/transactions` | All transactions |
| GET | `/api/admin/logs` | Admin activity logs |

---

## Deployment

### Backend → Render or Railway

1. Create a new **Web Service** on Render
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `node src/server.js`
4. Add all environment variables from `.env.example`
5. After deploy, seed admin: `node src/utils/seedAdmin.js`

### Frontend → Vercel

1. Push to GitHub
2. Import on vercel.com
3. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = your backend URL + `/api`
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL
4. Deploy

### Database → MongoDB Atlas

1. Create free cluster at cloud.mongodb.com
2. Get connection string
3. Set as `MONGODB_URI` in backend env

---

## Anti-Fraud Features

- ✅ Phone number uniqueness enforced at DB level
- ✅ M-Pesa payment phone must match registered phone
- ✅ Duplicate M-Pesa receipts rejected
- ✅ Self-referral detection
- ✅ Device fingerprint + IP address logged
- ✅ Suspicious accounts flagged and visible in admin
- ✅ Only verified paid users can generate referrals
- ✅ Referral commissions require successful payment verification
- ✅ Atomic transactions using Mongoose sessions

---

## Security

- JWT auth with 7-day expiry
- bcrypt password hashing (12 rounds)
- Rate limiting (100 req/15min global, 10 req/15min on auth)
- Helmet.js security headers
- CORS restricted to frontend origin
- MongoDB sanitization (prevent NoSQL injection)
- Input validation via express-validator
- Environment variables for all secrets

---

## License

MIT
