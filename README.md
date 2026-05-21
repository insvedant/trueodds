# TrueOdds — Sports Betting Tools Platform

OddsJam-style platform with real-time arbitrage finder, +EV bets, live odds comparison, and bet tracker. Built with Next.js 14 + Node.js/Express/MongoDB.

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`) OR MongoDB Atlas URI

### 1. Backend

```powershell
cd trueodds\backend
npm install
```

Edit `.env` if needed (defaults work for local MongoDB):
```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/trueodds
JWT_SECRET=trueodds_super_secret_change_in_production
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

Seed test data (creates admin + 4 test users with bets):
```powershell
npm run seed
```

Start backend:
```powershell
npm run dev
```
→ Backend running at http://localhost:4000

---

### 2. Frontend

```powershell
cd trueodds\frontend
npm install
npm run dev
```
→ Frontend running at http://localhost:3000

---

## Login Credentials (after seed)

| Email | Password | Role | Plan |
|---|---|---|---|
| admin@trueodds.com | admin123 | Admin | Platinum |
| test@trueodds.com | password123 | User | Gold |
| john@test.com | password123 | User | Gold |
| sarah@test.com | password123 | User | Platinum |
| mike@test.com | password123 | User | Free |

---

## Features

### User Dashboard (`/dashboard`)
- **Sidebar** with 5 sections: Home, Arbitrage, +EV Bets, Bet Tracker, Live Odds
- **Home** — Stats grid, monthly P&L bar chart, 30-day daily chart, upgrade banners
- **Arbitrage** (`/dashboard/arbitrage`) — Full arb table with sport tabs, min-profit filter, book filter, alert toggle, live toast notifications, hot-bet indicators (🔥)
- **+EV Bets** (`/dashboard/positive-ev`) — EV% table with fair odds, probability, Kelly bet size, book badges; locked for free plan
- **Bet Tracker** (`/dashboard/tracker`) — Full CRUD bet entry form, result dropdowns, 3 tabs (Bets / Stats / Charts), P&L by sport and by book, profit bar charts
- **Live Odds** (`/dashboard/odds`) — Multi-sportsbook comparison table, best odds highlighted green, search + sport/market filters

### Alert System
- Animated pulsing banner on every page with new arb alerts
- Auto-dismissing toast notifications (8s) when hot arbs fire
- Toggle alerts on/off in top bar

### Admin Dashboard (`/admin`)
- **Overview** — 6 KPI cards, 12-month revenue/user bar chart toggle, donut plan distribution chart, MRR calculator
- **Users** (`/admin/users`) — Searchable table, click-to-expand detail panel, edit plan/status/active, delete
- **Revenue** (`/admin/revenue`) — Revenue bar chart, progress bars by plan, transactions table
- **All Bets** (`/admin/bets`) — Platform-wide bet table with search and sport filter
- **Settings** (`/admin/settings`) — Profile edit, integrations guide (Stripe, TheOddsAPI, SendGrid), .env reference

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/profile | Update name/password |

### Subscriptions
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/subscriptions/plans | List plans |
| GET | /api/subscriptions/me | My subscription |
| POST | /api/subscriptions/subscribe | Subscribe to plan |
| POST | /api/subscriptions/cancel | Cancel subscription |

### Tools (require auth)
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/odds?sport=NFL | Live odds (plan-gated) |
| GET | /api/arbitrage?minProfit=1 | Arb bets |
| GET | /api/ev?minEV=2&sport=NHL | +EV bets (Gold/Platinum only) |

### Bets (require auth)
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/bets | List my bets |
| GET | /api/bets/stats | My betting stats |
| POST | /api/bets | Add a bet |
| PUT | /api/bets/:id | Update (result, etc.) |
| DELETE | /api/bets/:id | Delete a bet |

### Analytics (require auth)
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/analytics/overview?period=30d | P&L overview + daily chart |

### Admin (admin role only)
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/admin/overview | Platform stats |
| GET | /api/admin/users | All users |
| GET | /api/admin/users/:id | User detail + bets |
| PUT | /api/admin/users/:id | Edit user plan/status |
| DELETE | /api/admin/users/:id | Delete user |
| GET | /api/admin/revenue | Revenue analytics |
| GET | /api/admin/bets | All platform bets |

---

## Project Structure

```
trueodds/
├── frontend/                    Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       Root layout with AuthProvider
│   │   │   ├── globals.css      Dark theme CSS variables
│   │   │   ├── page.tsx         Public landing page
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── pricing/
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx   Sidebar layout (collapsible)
│   │   │   │   ├── page.tsx     Home dashboard
│   │   │   │   ├── arbitrage/   ⚡ Arb finder
│   │   │   │   ├── positive-ev/ 📈 +EV bets
│   │   │   │   ├── tracker/     📋 Bet tracker
│   │   │   │   └── odds/        📊 Live odds comparison
│   │   │   └── admin/
│   │   │       ├── layout.tsx   Admin sidebar
│   │   │       ├── page.tsx     KPI overview
│   │   │       ├── users/
│   │   │       ├── revenue/
│   │   │       ├── bets/
│   │   │       └── settings/
│   │   ├── lib/
│   │   │   ├── auth.tsx         AuthProvider, useAuth, axios instance
│   │   │   └── mockData.ts      All hardcoded data (swap with APIs later)
│   └── ...config files
│
└── backend/                     Node.js + Express + MongoDB
    ├── src/
    │   ├── index.js             Entry + Socket.io
    │   ├── seed.js              Create test data
    │   ├── models/
    │   │   ├── User.js          User schema + bcrypt
    │   │   └── Bet.js           Bet schema + auto profit calc
    │   ├── middleware/
    │   │   └── auth.js          protect, adminOnly, requirePlan
    │   ├── routes/
    │   │   ├── auth.js
    │   │   ├── subscriptions.js
    │   │   ├── odds.js          + arbitrage + ev
    │   │   ├── bets.js
    │   │   ├── admin.js
    │   │   └── analytics.js
    │   └── data/
    │       └── mockData.js      Backend mock generators
    └── .env
```

---

## Connecting Real APIs (next steps)

### 1. TheOddsAPI (live odds)
Add to `.env`:
```
THEODDSAPI_KEY=your_key_from_the-odds-api.com
```
In `backend/src/routes/odds.js`, replace `generateOdds()` with:
```javascript
const resp = await fetch(
  `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${process.env.THEODDSAPI_KEY}&regions=us&markets=h2h,spreads,totals`
)
const data = await resp.json()
```

### 2. Stripe (payments)
Add to `.env`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
Update `subscriptions.js` subscribe route to create Stripe Checkout session.

### 3. Swap frontend mock data
In `frontend/src/lib/mockData.ts`, each export has a `TODO:` comment with the exact API endpoint to call.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, React 19, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, MongoDB, Mongoose |
| Auth | JWT (bcryptjs passwords) |
| Real-time | Socket.io (live odds push) |
| State | React Context (AuthProvider) |
| HTTP client | Axios |
