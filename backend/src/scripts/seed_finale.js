// Final demo seed — a fresh business with hand-tuned data so every screen has
// something real to show: low stock, near-expiry, an already-expired batch
// (for a live "mark wasted" demo), a slow mover with margin (markdown demo),
// khata customers in different states, and all four customer segments.
//
// Deliberately NOT randomized — every line below is explicit and easy to
// read/tweak the night before a demo, unlike seed_showcase.js's generator.
//
// Run with: node src/scripts/seed_finale.js [--reset]

require('dotenv').config({ path: __dirname + '/../../.env' });

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/pool');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const shouldReset = process.argv.includes('--reset') || process.env.SEED_RESET === 'true';

// ── Business ──────────────────────────────────────────────────────────────────
const BUSINESS = {
    name: 'Shree Ganesh General Store',
    phone: '9123456780',
    password: 'demo1234',
    type: 'kirana',
};

// ── Customers ─────────────────────────────────────────────────────────────────
// Segments are computed live by the backend from actual order history — these
// labels are just the intended outcome, driven by the order dates below.
const CUSTOMERS = [
    { key: 'ramesh', name: 'Ramesh Yadav', phone: '9000011111' },   // regular, owes khata, no repayment yet
    { key: 'sunita', name: 'Sunita Devi', phone: '9000022222' },    // regular, khata + partial repayment
    { key: 'amit', name: 'Amit Verma', phone: '9000033333' },       // dormant, khata fully repaid (₹0 due)
    { key: 'priya', name: 'Priya Sharma', phone: '9000044444' },    // regular, cash/UPI only, top spender
    { key: 'deepak', name: 'Deepak Joshi', phone: '9000055555' },   // occasional
    { key: 'meena', name: 'Meena Kumari', phone: '9000066666' },    // dormant, old orders only
    { key: 'rahul', name: 'Rahul Singh', phone: '9000077777' },     // new — no purchase yet
];

// ── Products ──────────────────────────────────────────────────────────────────
const PRODUCTS = [
    { key: 'atta', name: 'Aashirvaad Atta 5kg', brand: 'Aashirvaad', barcode: '8901030893346', category: 'Grocery', unit: 'pcs', sellingPrice: 265, costPrice: 230, reorderLevel: 10, receivedQty: 40, expiryDays: 200, receivedDaysAgo: 33 },
    { key: 'salt', name: 'Tata Salt 1kg', brand: 'Tata Salt', barcode: '8901058000015', category: 'Grocery', unit: 'pcs', sellingPrice: 28, costPrice: 22, reorderLevel: 20, receivedQty: 60, expiryDays: 300, receivedDaysAgo: 33 },
    { key: 'biscuit', name: 'Parle-G Original 800g', brand: 'Parle', barcode: '8901719112195', category: 'Snack', unit: 'pcs', sellingPrice: 65, costPrice: 55, reorderLevel: 20, receivedQty: 50, expiryDays: 100, receivedDaysAgo: 31 },
    { key: 'chips', name: "Lay's Classic Salted 52g", brand: "Lay's", barcode: '8901491105157', category: 'Snack', unit: 'pcs', sellingPrice: 20, costPrice: 15, reorderLevel: 25, receivedQty: 60, expiryDays: 70, receivedDaysAgo: 28 },
    { key: 'juice', name: 'Tropicana Orange 1L', brand: 'Tropicana', barcode: '8901491100015', category: 'Beverage', unit: 'pcs', sellingPrice: 130, costPrice: 112, reorderLevel: 8, receivedQty: 20, expiryDays: 12, receivedDaysAgo: 22 },
    { key: 'butter', name: 'Amul Butter 500g', brand: 'Amul', barcode: '8901233000504', category: 'Dairy', unit: 'pcs', sellingPrice: 245, costPrice: 214, reorderLevel: 8, receivedQty: 16, expiryDays: 4, receivedDaysAgo: 18 },
    { key: 'cheese', name: 'Amul Cheese Slices 750g', brand: 'Amul', barcode: '8901233010268', category: 'Dairy', unit: 'pcs', sellingPrice: 385, costPrice: 336, reorderLevel: 5, receivedQty: 10, expiryDays: -3, receivedDaysAgo: 25 },
    { key: 'ghee', name: 'Amul Ghee 1L', brand: 'Amul', barcode: '8901233001007', category: 'Dairy', unit: 'pcs', sellingPrice: 699, costPrice: 550, reorderLevel: 6, receivedQty: 14, expiryDays: 220, receivedDaysAgo: 40 },
    { key: 'toothpaste', name: 'Colgate Strong Teeth 200g', brand: 'Colgate', barcode: '8901314006443', category: 'Personal Care', unit: 'pcs', sellingPrice: 95, costPrice: 78, reorderLevel: 15, receivedQty: 30, expiryDays: 300, receivedDaysAgo: 30 },
    { key: 'detergent', name: 'Surf Excel Easy Wash 1kg', brand: 'Surf Excel', barcode: '8901030838313', category: 'Household', unit: 'pcs', sellingPrice: 155, costPrice: 132, reorderLevel: 12, receivedQty: 25, expiryDays: 300, receivedDaysAgo: 28 },
    { key: 'dolo', name: 'Dolo 650 Tablets (15s)', brand: 'Micro Labs', barcode: '8901138500156', category: 'Medicine', unit: 'pack', sellingPrice: 32, costPrice: 24, reorderLevel: 20, receivedQty: 45, expiryDays: 400, receivedDaysAgo: 24, scheduleH: false },
];

// ── Sales ─────────────────────────────────────────────────────────────────────
// { productKey, qty, daysAgo, customerKey (null = walk-in), mode }
// `credit` lines automatically create a matching ledger_entries row.
const SALES = [
    // Aashirvaad Atta — steady seller, ends healthy (~18 left, reorder 10)
    { p: 'atta', qty: 6, daysAgo: 28, c: null, mode: 'upi' },
    { p: 'atta', qty: 5, daysAgo: 20, c: null, mode: 'cash' },
    { p: 'atta', qty: 3, daysAgo: 7, c: null, mode: 'cash' },
    { p: 'atta', qty: 2, daysAgo: 1, c: null, mode: 'upi' },
    { p: 'atta', qty: 2, daysAgo: 18, c: 'priya', mode: 'upi' },
    { p: 'atta', qty: 2, daysAgo: 14, c: 'ramesh', mode: 'credit' },
    { p: 'atta', qty: 2, daysAgo: 50, c: 'meena', mode: 'cash' },

    // Tata Salt — high velocity, ends just below reorder level (medium urgency)
    { p: 'salt', qty: 10, daysAgo: 30, c: null, mode: 'cash' },
    { p: 'salt', qty: 9, daysAgo: 24, c: null, mode: 'upi' },
    { p: 'salt', qty: 8, daysAgo: 18, c: null, mode: 'cash' },
    { p: 'salt', qty: 7, daysAgo: 12, c: null, mode: 'upi' },
    { p: 'salt', qty: 6, daysAgo: 6, c: null, mode: 'cash' },
    { p: 'salt', qty: 4, daysAgo: 2, c: null, mode: 'upi' },
    { p: 'salt', qty: 2, daysAgo: 0, c: null, mode: 'cash' }, // a little revenue already "today"

    // Parle-G — sold hard, ends critically low (well below reorder 20)
    { p: 'biscuit', qty: 9, daysAgo: 29, c: null, mode: 'cash' },
    { p: 'biscuit', qty: 9, daysAgo: 17, c: null, mode: 'cash' },
    { p: 'biscuit', qty: 7, daysAgo: 5, c: null, mode: 'cash' },
    { p: 'biscuit', qty: 5, daysAgo: 1, c: null, mode: 'upi' },
    { p: 'biscuit', qty: 8, daysAgo: 23, c: 'priya', mode: 'upi' },
    { p: 'biscuit', qty: 3, daysAgo: 12, c: 'priya', mode: 'cash' },
    { p: 'biscuit', qty: 2, daysAgo: 11, c: 'deepak', mode: 'upi' },

    // Lay's chips — healthy, filler volume
    { p: 'chips', qty: 6, daysAgo: 26, c: null, mode: 'cash' },
    { p: 'chips', qty: 5, daysAgo: 19, c: null, mode: 'upi' },
    { p: 'chips', qty: 6, daysAgo: 13, c: null, mode: 'cash' },
    { p: 'chips', qty: 5, daysAgo: 8, c: null, mode: 'upi' },
    { p: 'chips', qty: 6, daysAgo: 3, c: null, mode: 'cash' },
    { p: 'chips', qty: 1, daysAgo: 3, c: 'deepak', mode: 'cash' },
    { p: 'chips', qty: 3, daysAgo: 22, c: 'ramesh', mode: 'upi' },

    // Tropicana Juice — near-expiry in 12 days, way more stock than can sell through
    { p: 'juice', qty: 3, daysAgo: 20, c: null, mode: 'upi' },
    { p: 'juice', qty: 3, daysAgo: 9, c: null, mode: 'cash' },
    { p: 'juice', qty: 2, daysAgo: 2, c: null, mode: 'upi' },
    { p: 'juice', qty: 1, daysAgo: 24, c: 'sunita', mode: 'credit' },

    // Amul Butter — expires in 4 days, plenty left unsold (strong expiry-risk item)
    { p: 'butter', qty: 2, daysAgo: 15, c: null, mode: 'cash' },
    { p: 'butter', qty: 1, daysAgo: 2, c: null, mode: 'cash' },
    { p: 'butter', qty: 2, daysAgo: 7, c: 'sunita', mode: 'upi' },
    { p: 'butter', qty: 1, daysAgo: 24, c: 'sunita', mode: 'cash' },
    { p: 'butter', qty: 1, daysAgo: 3, c: 'priya', mode: 'cash' },

    // Amul Cheese — NOTHING sold, batch already expired 3 days ago.
    // Left untouched on purpose: mark this wasted LIVE during the demo.

    // Amul Ghee — DO NOT add more sales here; tuned to land exactly on "slow mover"
    { p: 'ghee', qty: 2, daysAgo: 25, c: null, mode: 'cash' },

    // Colgate — ends right at reorder level (shows up as low stock too)
    { p: 'toothpaste', qty: 4, daysAgo: 27, c: null, mode: 'cash' },
    { p: 'toothpaste', qty: 4, daysAgo: 19, c: null, mode: 'upi' },
    { p: 'toothpaste', qty: 3, daysAgo: 10, c: null, mode: 'cash' },
    { p: 'toothpaste', qty: 3, daysAgo: 3, c: null, mode: 'upi' },
    { p: 'toothpaste', qty: 4, daysAgo: 18, c: 'sunita', mode: 'credit' },
    { p: 'toothpaste', qty: 3, daysAgo: 42, c: 'amit', mode: 'credit' },

    // Surf Excel — healthy
    { p: 'detergent', qty: 3, daysAgo: 24, c: null, mode: 'upi' },
    { p: 'detergent', qty: 3, daysAgo: 15, c: null, mode: 'cash' },
    { p: 'detergent', qty: 1, daysAgo: 40, c: 'meena', mode: 'upi' },
    { p: 'detergent', qty: 2, daysAgo: 6, c: 'ramesh', mode: 'credit' },

    // Dolo 650 — healthy
    { p: 'dolo', qty: 5, daysAgo: 22, c: null, mode: 'cash' },
    { p: 'dolo', qty: 5, daysAgo: 14, c: null, mode: 'upi' },
    { p: 'dolo', qty: 4, daysAgo: 7, c: null, mode: 'cash' },
    { p: 'dolo', qty: 4, daysAgo: 1, c: null, mode: 'upi' },
    { p: 'dolo', qty: 1, daysAgo: 2, c: 'ramesh', mode: 'cash' },
    { p: 'dolo', qty: 1, daysAgo: 4, c: 'sunita', mode: 'cash' },
    { p: 'dolo', qty: 2, daysAgo: 9, c: 'priya', mode: 'upi' },
];

// Standalone khata repayments (not tied to a specific sale).
const REPAYMENTS = [
    { c: 'sunita', amount: 300, daysAgo: 10 },
    { c: 'amit', amount: 285, daysAgo: 33 }, // fully settles Amit's toothpaste credit sale
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveOrCreateBusiness(client) {
    const { rows } = await client.query('SELECT id, name, phone, type FROM businesses WHERE phone = $1', [BUSINESS.phone]);
    if (rows.length > 0) return rows[0];

    const passwordHash = await bcrypt.hash(BUSINESS.password, 12);
    const created = await client.query(
        `INSERT INTO businesses (id, name, phone, password_hash, type)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, name, phone, type`,
        [uuidv4(), BUSINESS.name, BUSINESS.phone, passwordHash, BUSINESS.type]
    );
    return created.rows[0];
}

async function resetBusinessData(client, businessId) {
    console.log(`[finale] Resetting existing data for business ${businessId}`);
    await client.query(`DELETE FROM ledger_entries WHERE business_id = $1`, [businessId]);
    await client.query(
        `DELETE FROM sale_items si USING sale_orders so WHERE si.order_id = so.id AND so.business_id = $1`,
        [businessId]
    );
    await client.query(
        `DELETE FROM stock_transactions st USING products p WHERE st.product_id = p.id AND p.business_id = $1`,
        [businessId]
    );
    await client.query(
        `DELETE FROM stock_batches sb USING products p WHERE sb.product_id = p.id AND p.business_id = $1`,
        [businessId]
    );
    await client.query(`DELETE FROM sale_orders WHERE business_id = $1`, [businessId]);
    await client.query(`DELETE FROM customers WHERE business_id = $1`, [businessId]);
    await client.query(`DELETE FROM products WHERE business_id = $1`, [businessId]);
}

async function seedCustomers(client, businessId) {
    const byKey = {};
    for (const c of CUSTOMERS) {
        const id = uuidv4();
        await client.query(
            `INSERT INTO customers (id, business_id, name, phone, segment, last_purchase_at, sync_status, updated_at)
             VALUES ($1,$2,$3,$4,'new',NULL,'synced',$5)`,
            [id, businessId, c.name, c.phone, now]
        );
        byKey[c.key] = { id, ...c };
    }
    return byKey;
}

async function seedProducts(client, businessId) {
    const byKey = {};
    for (const p of PRODUCTS) {
        const productId = uuidv4();
        await client.query(
            `INSERT INTO products
             (id, business_id, name, category, barcode, brand, unit, reorder_level, schedule_h, selling_price, sync_status, updated_at, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'synced',$11,NOW())`,
            [productId, businessId, p.name, p.category, p.barcode, p.brand, p.unit, p.reorderLevel, !!p.scheduleH, p.sellingPrice, now]
        );

        const batchId = uuidv4();
        const createdAt = now - p.receivedDaysAgo * DAY;
        const expiryDate = now + p.expiryDays * DAY;

        await client.query(
            `INSERT INTO stock_batches (id, product_id, quantity, batch_no, expiry_date, cost_price, sync_status, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,'synced',$7,$8)`,
            [batchId, productId, p.receivedQty, `${p.key.toUpperCase()}-01`, expiryDate, p.costPrice, createdAt, now]
        );

        await client.query(
            `INSERT INTO stock_transactions (id, product_id, batch_id, type, quantity, txn_at, sync_status, updated_at)
             VALUES ($1,$2,$3,'stock_in',$4,$5,'synced',$6)`,
            [uuidv4(), productId, batchId, p.receivedQty, createdAt, now]
        );

        byKey[p.key] = { id: productId, batchId, ...p };
    }
    return byKey;
}

async function seedSales(client, businessId, customersByKey, productsByKey) {
    const lastPurchaseAt = {};

    for (const s of SALES) {
        const product = productsByKey[s.p];
        const customer = s.c ? customersByKey[s.c] : null;
        const saleAt = now - s.daysAgo * DAY - Math.floor(Math.random() * 8 + 1) * 60 * 60 * 1000;
        const total = s.qty * product.sellingPrice;
        const orderId = uuidv4();

        await client.query(
            `INSERT INTO sale_orders (id, business_id, customer_id, total_amount, payment_mode, sale_at, sync_status, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,'synced',$7)`,
            [orderId, businessId, customer ? customer.id : null, total, s.mode === 'credit' ? 'credit' : s.mode, saleAt, now]
        );

        await client.query(
            `INSERT INTO sale_items (id, order_id, product_id, batch_id, quantity, unit_price, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [uuidv4(), orderId, product.id, product.batchId, s.qty, product.sellingPrice, now]
        );

        await client.query(
            `INSERT INTO stock_transactions (id, product_id, batch_id, type, quantity, txn_at, sync_status, updated_at)
             VALUES ($1,$2,$3,'sale',$4,$5,'synced',$6)`,
            [uuidv4(), product.id, product.batchId, s.qty, saleAt, now]
        );

        if (s.mode === 'credit' && customer) {
            await client.query(
                `INSERT INTO ledger_entries (id, business_id, customer_id, order_id, type, amount, note, entry_at, sync_status, updated_at)
                 VALUES ($1,$2,$3,$4,'credit_sale',$5,$6,$7,'synced',$8)`,
                [uuidv4(), businessId, customer.id, orderId, total, '', saleAt, now]
            );
        }

        if (customer) {
            lastPurchaseAt[customer.id] = Math.max(lastPurchaseAt[customer.id] || 0, saleAt);
        }
    }

    for (const c of Object.values(customersByKey)) {
        await client.query(
            `UPDATE customers SET last_purchase_at = $2, updated_at = $3 WHERE id = $1`,
            [c.id, lastPurchaseAt[c.id] || null, now]
        );
    }

    return SALES.length;
}

async function seedRepayments(client, businessId, customersByKey) {
    for (const r of REPAYMENTS) {
        const customer = customersByKey[r.c];
        const entryAt = now - r.daysAgo * DAY;
        await client.query(
            `INSERT INTO ledger_entries (id, business_id, customer_id, order_id, type, amount, note, entry_at, sync_status, updated_at)
             VALUES ($1,$2,$3,NULL,'repayment',$4,'',$5,'synced',$6)`,
            [uuidv4(), businessId, customer.id, r.amount, entryAt, now]
        );
    }
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const business = await resolveOrCreateBusiness(client);
        console.log(`[finale] Target business: ${business.name} (${business.phone})`);

        if (shouldReset) {
            await resetBusinessData(client, business.id);
        } else {
            console.log('[finale] Running without --reset — appending to any existing data for this business.');
        }

        const customersByKey = await seedCustomers(client, business.id);
        const productsByKey = await seedProducts(client, business.id);
        const orderCount = await seedSales(client, business.id, customersByKey, productsByKey);
        await seedRepayments(client, business.id, customersByKey);

        await client.query('COMMIT');

        console.log('\n[finale] Demo dataset ready.\n');
        console.log(`  Login phone:     ${business.phone}`);
        console.log(`  Login password:  ${BUSINESS.password}`);
        console.log(`  Orders seeded:   ${orderCount}`);
        console.log('\n  Live demo cues:');
        console.log('   - Khata: Ramesh Yadav owes ~₹840 (no repayment yet) — do a live repayment here');
        console.log('   - Khata: Sunita Devi owes ~₹210 (already has a partial repayment in her history)');
        console.log('   - Khata: Amit Verma is fully settled (₹0) — correctly absent from the outstanding list');
        console.log('   - Alerts: Amul Cheese Slices batch is already EXPIRED, untouched — mark it wasted live');
        console.log('   - Alerts / Home: Amul Butter expires in 4 days with 9+ units unsold — near-expiry risk');
        console.log('   - Reorder: Parle-G Original is critically low vs its reorder level');
        console.log('   - Inventory Intelligence: Amul Ghee 1L is the markdown/slow-mover suggestion');
        console.log('   - Customers: Priya (regular/top spender), Deepak (occasional), Meena (dormant), Rahul (new, zero purchases)');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[finale] Failed:', error);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
