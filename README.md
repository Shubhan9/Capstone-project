# SmartOps

SmartOps is a full-stack, offline-first inventory and sales management system for small Indian retail businesses such as kirana stores and pharmacies. It combines a React Native mobile app for shopkeepers, a Node.js + PostgreSQL backend, and a React web dashboard for business owners.

The mobile app is **offline-first**: it persists data locally with WatermelonDB, lets the shopkeeper keep working without connectivity, and synchronizes with the backend when the device reconnects. The backend is the durable system of record and also powers an analytics dashboard for owners.

The system is deployed and running end-to-end: a live API on AWS behind Nginx with HTTPS, and a hosted web dashboard.

---

## Applications

| App | Path | Stack | Purpose |
|-----|------|-------|---------|
| Mobile | `SmartOps/` | React Native + Expo + WatermelonDB | Shopkeeper's day-to-day tool (sales, stock, khata, alerts) |
| Backend | `backend/` | Node.js + Express + PostgreSQL | REST API, sync, analytics — system of record |
| Dashboard | `dashboard/` | React + Vite | Owner's analytics & inventory-intelligence view |

---

## Deployment

SmartOps runs as a production deployment (not just local dev):

- **Backend + database — AWS EC2 (Ubuntu).** The Express API is managed by **PM2** (auto-restart, wired into systemd so it survives reboots). **PostgreSQL** runs on the same instance and is **not** exposed to the public internet.
- **Reverse proxy + TLS — Nginx.** Nginx sits in front of the API, terminates **HTTPS** with a **Let's Encrypt** certificate (auto-renewed via Certbot), and is the only service exposed on ports 80/443. The Node process listens only on `localhost:3000`, so the application port is never directly reachable from the internet.
- **Domain.** A DuckDNS subdomain maps to the instance. The public API base is `https://smartops-app.duckdns.org/api`.
- **Dashboard — Vercel.** The React + Vite dashboard is built from this repository and deployed on Vercel, with the API base URL supplied as a build-time environment variable.
- **CORS.** The API restricts browser origins to an `ALLOWED_ORIGINS` allowlist. The mobile app sends no browser origin and is unaffected.

> The project was originally hosted on a managed platform (Railway) and later migrated to self-managed AWS EC2 for full control of the stack, a production-grade setup (own domain, HTTPS, process management), and hands-on cloud/DevOps experience.

---

## Features

### Authentication
- JWT-based business authentication with register and login flows
- Business-scoped access control enforced by backend middleware
- Multi-tenant data isolation using `business_id`

### Inventory Management
- Product catalog with barcode, category, brand, unit, reorder level, and selling price
- Stock batches with quantity, batch number, expiry date, and cost price
- Append-only stock transaction ledger (stock-in, sale, wastage, return) — current stock is **derived** from this ledger, never a stored column
- In-app **product editing** (fix selling price / reorder level), synced back to the server
- **Wastage / expiry write-off** — record spoiled or expired stock so inventory stays accurate
- Low-stock, near-expiry, and expired-stock alerts computed offline from batch movement history

### Sales & Customers
- Barcode-driven order entry with FEFO (first-expiry-first-out) batch selection
- **Discount at checkout** — override an item's price at the point of sale (e.g. to clear near-expiry stock)
- Line-item level tracking (product, batch, quantity, unit price); sale price is stored historically so later price edits never rewrite past revenue
- Customer records with purchase activity and segmentation
- Order history with date/payment filters, persisted locally for offline access

### Khata (Customer Credit)
- Append-only **credit ledger** (`credit_sale` / `repayment`) — a customer's outstanding balance is derived as `Σ credit_sale − Σ repayment`, so it is always auditable
- A credit sale automatically books the receivable in the same atomic write as the order
- Khata screen: outstanding-balance list, per-customer history, and repayment recording
- Credit sales require a customer so the debt can be attributed

### Offline-First Sync
- Local-first writes in the mobile app using WatermelonDB
- Pull/push synchronization with backend timestamp checkpoints
- Push processes both **created and updated** records (an earlier bug dropped updates); writes are idempotent upserts, immutable financial rows use conflict-safe inserts
- Business-scoped sync payloads for products, stock, sales, customers, and the credit ledger
- Reconnect-triggered sync, a live connectivity indicator, and a manual "Sync now" action

### Barcode & Lookup
- Barcode lookup against business inventory, a seeded catalog, and an OpenFoodFacts fallback
- Scanner **flashlight/torch toggle** and **manual barcode entry** for dim shops and damaged labels

### Analytics & Inventory Intelligence (backend)
- Dashboard summary, sales trends (daily/weekly/monthly), top products, customer activity & segments
- **Reorder suggestions** — what to reorder and how much, from blended sales velocity and stock cover
- **Stock-out risk**, **expiry risk**, and **dead-stock / slow-mover** detection with value-at-risk
- **Markdown suggestions** — a discount for slow stock that still clears a minimum margin over cost (never at a loss)
- **Product opportunities** — assortment/category growth signals
- A combined **inventory intelligence** endpoint that returns all of the above in one call

### Mobile "Smart Restock" & Daily Summary
- **Smart Restock** surfaces the backend reorder engine on the phone; tapping a suggestion opens Stock In pre-filled
- **Daily closing summary** — an offline end-of-day view: total collected, payment split, khata given vs repaid, and units written off

### Web Dashboard (owner)
- **Business Overview** tab: KPI cards, a sales trend chart, payment mix, top products, and customer intelligence
- **Inventory Intelligence** tab: reorder, stock-out risk, expiry risk, dead stock, opportunities, and markdown suggestions

---

## Architecture Overview

### Mobile app
Operational data lives in WatermelonDB and is the primary source of truth for UI interactions. Screens read from local collections and write through database actions. A dedicated sync engine reconciles local changes with the backend.

### Backend API
Express REST endpoints for auth, sync, barcode lookup, read-only product views, and analytics. PostgreSQL is the system of record, partitioned by `business_id`, with JWT middleware on protected routes.

### Dashboard
A React + Vite SPA that authenticates against the same API and renders analytics from the backend's dashboard and inventory-intelligence endpoints.

### Data flow
1. The shopkeeper performs an action in the mobile app.
2. The app writes to WatermelonDB immediately; the UI updates without a network round-trip.
3. When online, the sync engine pushes local changes and pulls server-side changes since `lastPulledAt`.
4. The backend persists changes to PostgreSQL inside a transaction and returns the delta.
5. The owner's dashboard reads analytics computed from that same PostgreSQL data.

---

## Tech Stack

**Mobile:** React Native, Expo, React Navigation, WatermelonDB (LokiJS adapter), AsyncStorage, NetInfo, expo-camera

**Backend:** Node.js, Express, PostgreSQL (`pg`), JSON Web Tokens, bcryptjs, express-validator, helmet, cors, compression, express-rate-limit, morgan

**Dashboard:** React, Vite, React Router

**Infrastructure:** AWS EC2 (Ubuntu), Nginx (reverse proxy + TLS), Let's Encrypt / Certbot, PM2 + systemd, DuckDNS, Vercel (dashboard)

**Other:** OpenFoodFacts API (barcode fallback), Nodemon, ESLint, Prettier

---

## Monorepo Structure

```text
capstone/
├── README.md
├── backend/                     # Node.js + Express API
│   └── src/
│       ├── app.js               # middleware chain (helmet, CORS allowlist, rate limit)
│       ├── server.js
│       ├── controllers/         # auth, barcode, products, sync, analytics
│       ├── db/                  # pool.js, migrate.js
│       ├── middleware/          # auth.js, errors.js
│       ├── routes/index.js
│       └── scripts/            # seed_demo, seed_showcase, seedOpenFoodFacts
├── dashboard/                   # React + Vite analytics dashboard
│   └── src/
│       ├── main.jsx, App.jsx
│       ├── pages/              # LoginPage, DashboardPage
│       ├── components/         # Shell, Panel, KpiCard, SegmentedControl,
│       │                       #   SalesChart, PaymentDonut, StatusBlock
│       ├── lib/                # api.js, format.js, session.js
│       └── styles.css
└── SmartOps/                    # React Native + Expo mobile app
    ├── App.js
    ├── components/             # UI.js, BarcodeScanner.js
    └── src/
        ├── database/           # index, schema, migrations, actions, appInit
        ├── models/            # Product, StockBatch, StockTransaction,
        │                       #   SaleOrder, SaleItem, Customer, LedgerEntry
        ├── screens/           # Login, Home, NewOrder, StockIn,
        │                       #   ProductRegistration, Alerts, Inventory,
        │                       #   OrderHistory, Khata, DaySummary, Reorder
        ├── services/api.js
        ├── sync/syncEngine.js
        └── theme/
```

---

## Setup Instructions

### Backend

```bash
cd backend
npm install
# create backend/.env (see Environment Variables), configure PostgreSQL
npm run migrate      # create/upgrade tables (idempotent)
npm run dev          # development (nodemon)
# npm start          # production
```

Optional demo data (after at least one business exists):

```bash
npm run seed:demo
npm run seed:demo -- --reset   # replace the target business's operational data
```

### Dashboard

```bash
cd dashboard
npm install
npm run dev          # http://localhost:5174 (set VITE_API_BASE_URL to your API)
npm run build        # production build
```

### Mobile app

```bash
cd SmartOps
npm install
npm run start        # Expo dev server
npm run android      # or: npm run ios
```

The mobile API base URL is set in `SmartOps/src/sync/syncEngine.js` (`API_BASE`). It points at the live server by default.

---

## Environment Variables

### Backend (`backend/.env`)
Required:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret used to sign JWTs

Optional:
- `PORT` (default `3000`), `NODE_ENV`, `JWT_EXPIRES_IN` (default `30d`)
- `ALLOWED_ORIGINS` — comma-separated browser origins allowed by CORS (defaults to `http://localhost:5173`)
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- `SEED_BUSINESS_ID`, `SEED_RESET`

### Dashboard
- `VITE_API_BASE_URL` — API base (e.g. `https://smartops-app.duckdns.org/api`); falls back to `http://localhost:3000/api`

### Mobile
- No `.env`; the API base lives in `SmartOps/src/sync/syncEngine.js`.

---

## Database

### Backend (PostgreSQL) tables
`businesses`, `products`, `stock_batches`, `stock_transactions`, `customers`, `sale_orders`, `sale_items`, `barcode_catalog`, `ledger_entries` (khata credit ledger).

### Schema notes
- Sync-critical timestamps are stored as `BIGINT` Unix milliseconds (`updated_at`, `sale_at`, `txn_at`, `expiry_date`, `last_purchase_at`, `entry_at`).
- Business data is partitioned by `business_id` for multi-tenant isolation.
- Current stock and customer balances are **derived** from append-only ledgers (stock transactions / credit entries), not stored columns.

### Mobile (WatermelonDB)
- Local schema is at **version 3**; a non-destructive migration adds the `ledger_entries` table for existing installs.
- Development uses the LokiJS adapter; a SQLite-backed adapter is the intended production storage path.

---

## Sync System

The sync engine follows WatermelonDB's pull/push model.

- **`GET /sync/pull?last_pulled_at=<unix_ms>`** — returns all rows changed after the checkpoint for the authenticated business, grouped by table.
- **`POST /sync/push`** — accepts a WatermelonDB change set and persists it inside a single PostgreSQL transaction. Both `created` and `updated` buckets are processed; upserts (`ON CONFLICT DO UPDATE`) make re-pushes idempotent, while immutable financial rows (orders, sale items, ledger entries) use conflict-safe inserts (`ON CONFLICT DO NOTHING`).
- **`lastPulledAt`** — the client checkpoint for the last successful pull.

### Conflict handling
- Master data (products, customers, batches) uses last-write-wins upserts.
- Sales, sale items, and ledger entries are append-only / immutable after creation.
- Deletions are not processed as destructive SQL deletes (soft-delete via an update is the intended path).

---

## API Overview

All routes are mounted under `/api`. Protected routes require `Authorization: Bearer <jwt>`.

### Auth
- `POST /auth/register` — register a business, returns a JWT + business metadata
- `POST /auth/login` — authenticate, returns a JWT + business metadata

```http
POST /api/auth/login
Content-Type: application/json

{ "phone": "9999999999", "password": "secret123" }
```

### Sync
- `GET /sync/pull?last_pulled_at=<unix_ms>`
- `POST /sync/push`

### Barcode
- `GET /barcode/:code` — inventory → seeded catalog → OpenFoodFacts fallback
- `GET /barcode/search?q=<query>` — name search in the catalog

### Products (read-only; writes happen via sync)
- `GET /products`, `GET /products/:id`
- `GET /products/low-stock`, `GET /products/near-expiry?days=30`

### Analytics
- `GET /analytics/dashboard` — today's orders/revenue, alert counts, top products
- `GET /analytics/sales?period=daily|weekly|monthly`
- `GET /analytics/top-products?limit=10`
- `GET /analytics/customers` — activity summary + per-customer segments

### Inventory Intelligence
- `GET /analytics/inventory/reorder-suggestions`
- `GET /analytics/inventory/stock-risk`
- `GET /analytics/inventory/expiry-risk`
- `GET /analytics/inventory/dead-stock`
- `GET /analytics/inventory/opportunities`
- `GET /analytics/inventory/markdowns` — still-profitable discount suggestions
- `GET /analytics/inventory/intelligence` — all of the above in one response

---

## Development Notes
- The mobile app uses the LokiJS WatermelonDB adapter in development; production persistence characteristics differ until a SQLite adapter is adopted.
- Sync requires a valid JWT and a restored `businessId` on the device before it will run.
- Alerts (low-stock / expiry) are computed from local records so they work offline.
- The demo seed script creates products, batches, sales, customers, returns, wastage, and low-stock / near-expiry / expired scenarios for testing and demos.

---

## Roadmap

Delivered since the initial version: AWS EC2 + Nginx + HTTPS deployment, the web analytics dashboard, inventory-intelligence modules (reorder, stock/expiry risk, dead stock, opportunities, markdowns), the khata credit ledger, wastage write-off, and various UX and reliability improvements.

Planned next:
- Migrate mobile storage from LokiJS to a SQLite-backed WatermelonDB adapter
- Automated test coverage (sync mapping and analytics math first)
- Stronger multi-device conflict resolution and background-sync retry/observability
- GST invoicing / receipts, supplier & purchase-order tracking, staff (cashier) accounts
- Push notifications for low-stock and expiry alerts
