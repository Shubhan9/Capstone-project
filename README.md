# SmartOps

SmartOps is an offline-first inventory management and business operations application tailored for small businesses and retail stores. Built with resilience in mind, it allows store owners to bill customers, manage stock, and view real-time operations completely offline, subsequently synchronizing data with the cloud when network connectivity is restored.

## Project Overview

**Key Features:**
- **Offline-First Resilience**: Full CRUD capability on local device using WatermelonDB.
- **Background Synchronization**: Robust sync engine pulls and pushes deltas intelligently without hampering the user experience.
- **Stock Management & Alerts**: Automatic low-stock notifications and granular stock batch/transaction tracking.
- **Point of Sale (POS)**: Capability to create new sale orders, apply barcodes, and handle simple customer CRMs.
- **Barcode Cataloging**: Integrating seeding functionality for an OpenFoodFacts-based product lookup system.

## Tech Stack

- **Frontend**: React Native, Expo, NativeWind (TailwindCSS framework), React Navigation.
- **Local Database**: WatermelonDB (SQLite wrapper optimized for React Native).
- **Backend Server**: Node.js, Express.js.
- **Cloud Database**: PostgreSQL.
- **Security & Utils**: Jsonwebtoken (JWT) for authentication, express-rate-limit, Helmet for standard security.

## Folder Structure

```text
capstone/
├── backend/
│   ├── src/
│   │   ├── controllers/   # Business logic (e.g., syncController, authController)
│   │   ├── db/            # PostgreSQL connection pool and simple SQL migrations
│   │   ├── middleware/    # Auth guards, error handlers, rate limiting
│   │   ├── routes/        # Router configuration mapped to controllers
│   │   ├── scripts/       # Auxiliary scripts (e.g., database seeding)
│   │   ├── app.js         # Top-level Express app configuration
│   │   └── server.js      # Server entry point and database connection hook
│   ├── package.json
│   └── .env               # Environment configuration (not committed)
└── SmartOps/
    ├── src/
    │   ├── components/    # Dumb/Reusable UI components
    │   ├── database/      # WatermelonDB schema, initializations, and actions
    │   ├── models/        # Application data models mapping to database tables
    │   ├── screens/       # Application views (Home, Login, Stack routes)
    │   ├── services/      # External API wrappers and service modules
    │   ├── sync/          # syncEngine.js (Background offline-first sync logic)
    │   └── theme/         # Shared style tokens and constants
    ├── App.js             # Root application navigation and context providers
    ├── package.json       # Expo / React Native dependency manifest
    └── tailwind.config.js # NativeWind style assignments
```

## Setup Instructions

### 1. Database & Backend Server Setup
1. Ensure you have **PostgreSQL** and **Node.js (>= 18.x)** installed.
2. Navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```
3. Create a `.env` file at the root of the `backend/` directory (see *Environment Variables* module).
4. Run migrations to provision the database tables:
   ```bash
   npm run migrate
   ```
5. Start the backend server:
   ```bash
   npm run dev
   # Production: npm start
   ```

### 2. Frontend / React Native Setup
1. Navigate to the frontend directory:
   ```bash
   cd SmartOps
   npm install
   ```
2. **Crucial**: Ensure `API_BASE` inside `SmartOps/src/sync/syncEngine.js` points to your backend instance URL. (If using Android emulator locally, you might need to point it at your machine's local IP address like `http://192.168.1.X:3000/api` rather than `localhost`).
3. Start the Expo bundler:
   ```bash
   npx expo start
   ```

## Environment Variables
Ensure the following are present in your `backend/.env` file:
- `DATABASE_URL`: Full Postgres string (e.g., `postgresql://postgres:password@localhost:5432/smartops`)
- `PORT`: Server port (Defaults to `3000`)
- `JWT_SECRET`: Crypto secret used for generating authentication tokens.
- `RATE_LIMIT_WINDOW_MS`: Limits time window config (e.g., `900000` for 15m)
- `RATE_LIMIT_MAX`: Limit of requests per IP globally in that window.

## API Overview
Data writes natively happen exclusively through the sync mechanism. Other endpoints exist for dashboards or peripheral functions.
- `POST /api/auth/register` & `POST /api/auth/login`: Handles onboarding and authentication handshakes.
- `GET /api/sync/pull` & `POST /api/sync/push`: Dedicated pipelines for WatermelonDB sync.
- `GET /api/barcode/search` & `/api/barcode/:code`: Auxiliary tools for barcode-based auto-filling utilizing the open database.
- `GET /api/products/*` & `GET /api/analytics/*`: Secondary read-only endpoints intended maybe for web-based dashboards or analytical views. 

## How Frontend Connects to Backend
A key paradigm of this app is that **the UI code generally DOES NOT fetch or post JSON data to the REST API for daily operations.** 
Instead:
1. React Native `screens/` save inserts/updates to the local **WatermelonDB**.
2. A network listener (`NetInfo` in `syncEngine.js`) detects connectivity.
3. Once online, `syncWithServer(authToken)` is triggered.
4. **Pull Mechanism**: Submits the parameter `last_pulled_at`. The Express backend compares this integer timestamp against records and serves rows heavily mutated since that date.
5. **Push Mechanism**: The frontend sends an array of `changes` encompassing newly created constraints or deleted rows. The server blindly processes these changes using Postgres SQL transactions (`transaction pooling` in `db/pool.js`).
