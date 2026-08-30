const { withTransaction, query } = require('../db/pool');
const { asyncHandler } = require('../middleware/errors');

// ─────────────────────────────────────────────────────────────────────────────
// PULL  GET /api/sync/pull?last_pulled_at=<unix_ms>
//
// Returns all rows modified after last_pulled_at for this business.
// Mobile calls this on reconnect to get server-side changes.
// ─────────────────────────────────────────────────────────────────────────────
const pull = asyncHandler(async (req, res) => {
    const businessId = req.business.id;
    const since = parseInt(req.query.last_pulled_at) || 0;
    const now = Date.now();

    const [products, batches, transactions, orders, items, customers] = await Promise.all([

        query(
            `SELECT id, business_id, name, category, barcode, brand, unit,
          reorder_level, schedule_h,
          selling_price::FLOAT  AS selling_price,
          sync_status,
          updated_at::FLOAT     AS updated_at
         FROM products
         WHERE business_id = $1 AND updated_at > $2`,
            [businessId, since]
        ),

        query(
            `SELECT sb.id, sb.product_id,
          sb.quantity,
          sb.batch_no,
          sb.expiry_date::FLOAT  AS expiry_date,
          sb.cost_price::FLOAT   AS cost_price,
          sb.sync_status,
          sb.created_at::FLOAT   AS created_at,
          sb.updated_at::FLOAT   AS updated_at
         FROM stock_batches sb
         JOIN products p ON p.id = sb.product_id
         WHERE p.business_id = $1 AND sb.updated_at > $2`,
            [businessId, since]
        ),

        query(
            `SELECT st.id, st.product_id, st.batch_id, st.type,
          st.quantity,
          st.txn_at::FLOAT      AS txn_at,
          st.sync_status,
          st.updated_at::FLOAT  AS updated_at
         FROM stock_transactions st
         JOIN products p ON p.id = st.product_id
         WHERE p.business_id = $1 AND st.updated_at > $2`,
            [businessId, since]
        ),

        query(
            `SELECT id, business_id, customer_id,
          total_amount::FLOAT  AS total_amount,
          payment_mode,
          sale_at::FLOAT       AS sale_at,
          sync_status,
          updated_at::FLOAT    AS updated_at
         FROM sale_orders
         WHERE business_id = $1 AND updated_at > $2`,
            [businessId, since]
        ),

        query(
            `SELECT si.id, si.order_id, si.product_id, si.batch_id,
          si.quantity,
          si.unit_price::FLOAT  AS unit_price,
          si.updated_at::FLOAT  AS updated_at
         FROM sale_items si
         JOIN sale_orders so ON so.id = si.order_id
         WHERE so.business_id = $1 AND si.updated_at > $2`,
            [businessId, since]
        ),

        query(
            `SELECT id, business_id, name, phone, segment,
          last_purchase_at::FLOAT  AS last_purchase_at,
          sync_status,
          updated_at::FLOAT        AS updated_at
         FROM customers
         WHERE business_id = $1 AND updated_at > $2`,
            [businessId, since]
        ),
    ]);

    res.json({
        timestamp: now,
        changes: {
            products: { created: products.rows, updated: [], deleted: [] },
            stock_batches: { created: batches.rows, updated: [], deleted: [] },
            stock_transactions: { created: transactions.rows, updated: [], deleted: [] },
            sale_orders: { created: orders.rows, updated: [], deleted: [] },
            sale_items: { created: items.rows, updated: [], deleted: [] },
            customers: { created: customers.rows, updated: [], deleted: [] },
        },
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUSH  POST /api/sync/push
//
// Receives batched local changes from mobile.
// Uses INSERT ... ON CONFLICT DO UPDATE (upsert) so re-pushes are idempotent.
// All tables processed in one transaction — atomic.
// ─────────────────────────────────────────────────────────────────────────────
const push = asyncHandler(async (req, res) => {
    const businessId = req.business.id;
    const { changes } = req.body;

    if (!changes) return res.status(422).json({ error: 'Missing changes payload' });

    const now = Date.now();

    // WatermelonDB splits local writes into created / updated / deleted buckets.
    // Every table below upserts (ON CONFLICT DO UPDATE) or safely no-ops
    // (ON CONFLICT DO NOTHING), so a created row and an updated row take the
    // exact same code path. We therefore process BOTH buckets together —
    // otherwise updates (e.g. a customer's last_purchase_at, an edited product
    // price) are silently discarded and never reach the server.
    const upserts = (tableChanges) => [
        ...(tableChanges?.created || []),
        ...(tableChanges?.updated || []),
    ];

    await withTransaction(async (client) => {

        // ── Products ─────────────────────────────────────────────────────────────
        for (const p of upserts(changes.products)) {
            await client.query(
                `INSERT INTO products
           (id, business_id, name, category, barcode, brand, unit,
            reorder_level, schedule_h, selling_price, sync_status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'synced',$11)
         ON CONFLICT (id) DO UPDATE SET
           name           = EXCLUDED.name,
           category       = EXCLUDED.category,
           barcode        = EXCLUDED.barcode,
           brand          = EXCLUDED.brand,
           unit           = EXCLUDED.unit,
           reorder_level  = EXCLUDED.reorder_level,
           schedule_h     = EXCLUDED.schedule_h,
           selling_price  = EXCLUDED.selling_price,
           sync_status    = 'synced',
           updated_at     = EXCLUDED.updated_at`,
                [p.id, businessId, p.name, p.category, p.barcode || null, p.brand || null,
                p.unit, p.reorder_level ?? 5, p.schedule_h ?? false,
                p.selling_price ?? 0, p.updated_at ?? now]
            );
        }

        // ── Stock batches ─────────────────────────────────────────────────────────
        for (const b of upserts(changes.stock_batches)) {
            await client.query(
                `INSERT INTO stock_batches
           (id, product_id, quantity, batch_no, expiry_date, cost_price, sync_status, updated_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'synced',$7,$7)
         ON CONFLICT (id) DO UPDATE SET
           quantity     = EXCLUDED.quantity,
           sync_status  = 'synced',
           updated_at   = EXCLUDED.updated_at`,
                [b.id, b.product_id, b.quantity, b.batch_no,
                b.expiry_date, b.cost_price ?? 0, b.updated_at ?? now]
            );
        }

        // ── Stock transactions (append-only — ON CONFLICT DO NOTHING) ─────────────
        for (const t of upserts(changes.stock_transactions)) {
            await client.query(
                `INSERT INTO stock_transactions
           (id, product_id, batch_id, type, quantity, txn_at, sync_status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'synced',$7)
         ON CONFLICT (id) DO NOTHING`,   // truly append-only
                [t.id, t.product_id, t.batch_id || null,
                t.type, t.quantity, t.txn_at, t.updated_at ?? now]
            );
        }

        // ── Customers ─────────────────────────────────────────────────────────────
        for (const c of upserts(changes.customers)) {
            await client.query(
                `INSERT INTO customers
           (id, business_id, name, phone, segment, last_purchase_at, sync_status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'synced',$7)
         ON CONFLICT (id) DO UPDATE SET
           name             = EXCLUDED.name,
           segment          = EXCLUDED.segment,
           last_purchase_at = EXCLUDED.last_purchase_at,
           sync_status      = 'synced',
           updated_at       = EXCLUDED.updated_at`,
                [c.id, businessId, c.name, c.phone, c.segment || 'new',
                c.last_purchase_at || null, c.updated_at ?? now]
            );
        }

        // ── Sale orders ───────────────────────────────────────────────────────────
        for (const o of upserts(changes.sale_orders)) {
            await client.query(
                `INSERT INTO sale_orders
           (id, business_id, customer_id, total_amount, payment_mode, sale_at, sync_status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'synced',$7)
         ON CONFLICT (id) DO NOTHING`,  // orders are immutable once created
                [o.id, businessId, o.customer_id || null,
                o.total_amount, o.payment_mode || 'cash', o.sale_at, o.updated_at ?? now]
            );
        }

        // ── Sale items ────────────────────────────────────────────────────────────
        for (const si of upserts(changes.sale_items)) {
            await client.query(
                `INSERT INTO sale_items
           (id, order_id, product_id, batch_id, quantity, unit_price, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
                [si.id, si.order_id, si.product_id, si.batch_id || null,
                si.quantity, si.unit_price, si.updated_at ?? now]
            );
        }

        // NOTE: the `deleted` bucket is intentionally not processed. The app has
        // no hard-delete flows, and sales/transactions are immutable financial
        // records. Deletions (e.g. deactivating a product) should be modelled as
        // soft-deletes (an is_active flag synced via updated) rather than
        // destructive DELETEs. Revisit here if/when a delete flow is added.
    });

    res.json({ success: true, synced_at: now });
});

module.exports = { pull, push };
