require('dotenv').config();
const { pool } = require('./pool');

const migrations = [

    // ── 001: businesses ───────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS businesses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'kirana',
  phone       TEXT        UNIQUE NOT NULL,
  password_hash TEXT      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,

    // ── 002: products ─────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS products (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  category       TEXT        NOT NULL DEFAULT 'Other',
  barcode        TEXT,
  brand          TEXT,
  unit           TEXT        NOT NULL DEFAULT 'pcs',
  reorder_level  INTEGER     NOT NULL DEFAULT 5,
  schedule_h     BOOLEAN     NOT NULL DEFAULT FALSE,
  selling_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  sync_status    TEXT        NOT NULL DEFAULT 'synced',
  updated_at     BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
    `CREATE INDEX IF NOT EXISTS idx_products_business    ON products(business_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_barcode     ON products(barcode) WHERE barcode IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_products_updated_at  ON products(updated_at)`,

    // ── 003: stock_batches ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS stock_batches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity     INTEGER     NOT NULL CHECK (quantity >= 0),
  batch_no     TEXT        NOT NULL,
  expiry_date  BIGINT      NOT NULL,
  cost_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  sync_status  TEXT        NOT NULL DEFAULT 'synced',
  created_at   BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at   BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_product     ON stock_batches(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_expiry      ON stock_batches(expiry_date)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_updated_at  ON stock_batches(updated_at)`,

    // ── 004: stock_transactions ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS stock_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id     UUID        REFERENCES stock_batches(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL CHECK (type IN ('stock_in','sale','wastage','return')),
  quantity     INTEGER     NOT NULL CHECK (quantity > 0),
  txn_at       BIGINT      NOT NULL,
  sync_status  TEXT        NOT NULL DEFAULT 'synced',
  updated_at   BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
)`,
    `CREATE INDEX IF NOT EXISTS idx_txn_product     ON stock_transactions(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_txn_batch       ON stock_transactions(batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_txn_type        ON stock_transactions(type)`,
    `CREATE INDEX IF NOT EXISTS idx_txn_updated_at  ON stock_transactions(updated_at)`,

    // ── 005: customers ────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS customers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  phone            TEXT        NOT NULL,
  segment          TEXT        NOT NULL DEFAULT 'new',
  last_purchase_at BIGINT,
  sync_status      TEXT        NOT NULL DEFAULT 'synced',
  updated_at       BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, phone)
)`,
    `CREATE INDEX IF NOT EXISTS idx_customers_business    ON customers(business_id)`,
    `CREATE INDEX IF NOT EXISTS idx_customers_phone       ON customers(phone)`,
    `CREATE INDEX IF NOT EXISTS idx_customers_updated_at  ON customers(updated_at)`,

    // ── 006: sale_orders ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS sale_orders (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id   UUID        REFERENCES customers(id) ON DELETE SET NULL,
  total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_mode  TEXT        NOT NULL DEFAULT 'cash',
  sale_at       BIGINT      NOT NULL,
  sync_status   TEXT        NOT NULL DEFAULT 'synced',
  updated_at    BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_business    ON sale_orders(business_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_customer    ON sale_orders(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_sale_at     ON sale_orders(sale_at)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_updated_at  ON sale_orders(updated_at)`,

    // ── 007: sale_items ───────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS sale_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES products(id),
  batch_id     UUID        REFERENCES stock_batches(id) ON DELETE SET NULL,
  quantity     INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at   BIGINT      NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
)`,
    `CREATE INDEX IF NOT EXISTS idx_items_order       ON sale_items(order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_items_product     ON sale_items(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_items_updated_at  ON sale_items(updated_at)`,

    // ── 008: barcode_catalog (OpenFoodFacts India seed — read-only) ───────────────
    `CREATE TABLE IF NOT EXISTS barcode_catalog (
  barcode   TEXT PRIMARY KEY,
  name      TEXT,
  brand     TEXT,
  category  TEXT,
  quantity  TEXT,
  source    TEXT NOT NULL DEFAULT 'openfoodfacts'
)`,
    `CREATE INDEX IF NOT EXISTS idx_catalog_name ON barcode_catalog USING gin(to_tsvector('english', coalesce(name,'')))`,

];

async function migrate() {
    console.log('Running migrations...');
    for (const [i, sql] of migrations.entries()) {
        try {
            await pool.query(sql);
            const preview = sql.trim().slice(0, 60).replace(/\s+/g, ' ');
            console.log(`  ✓ [${String(i + 1).padStart(2, '0')}] ${preview}...`);
        } catch (err) {
            console.error(`  ✗ Migration ${i + 1} failed:`, err.message);
            process.exit(1);
        }
    }
    console.log('\nAll migrations complete.');
    await pool.end();
}

migrate();