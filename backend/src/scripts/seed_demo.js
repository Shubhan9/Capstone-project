// ─────────────────────────────────────────────────────────────────────────────
// DEMO SEED SCRIPT (FAST TEST VERSION)
// Run: node seed_demo.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: __dirname + '/../../.env' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pg = require('pg');
pg.types.setTypeParser(20, val => parseFloat(val));
pg.types.setTypeParser(1700, val => parseFloat(val));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const now = Date.now();
const DAY = 86400000;

// ⚡ LIMIT TO 20 PRODUCTS
const PRODUCTS = [
    // ── Staples ──
    { name: 'Aashirvaad Atta 5kg', brand: 'Aashirvaad', barcode: '8901030893346', category: 'Atta & Flour', unit: 'pcs', sellingPrice: 265, costPrice: 230, reorderLevel: 10 },
    { name: 'Fortune Chakki Fresh Atta 5kg', brand: 'Fortune', barcode: '8901462100014', category: 'Atta & Flour', unit: 'pcs', sellingPrice: 255, costPrice: 222, reorderLevel: 10 },
    { name: 'India Gate Basmati Rice 5kg', brand: 'India Gate', barcode: '8901072002476', category: 'Rice', unit: 'pcs', sellingPrice: 699, costPrice: 610, reorderLevel: 8 },
    { name: 'Daawat Rozana Basmati 5kg', brand: 'Daawat', barcode: '8906009570032', category: 'Rice', unit: 'pcs', sellingPrice: 549, costPrice: 480, reorderLevel: 8 },
    { name: 'Tata Salt 1kg', brand: 'Tata Salt', barcode: '8901058000015', category: 'Salt & Sugar', unit: 'pcs', sellingPrice: 28, costPrice: 22, reorderLevel: 20 },
    { name: 'Tata Sampann Chana Dal 1kg', brand: 'Tata Sampann', barcode: '8901288004522', category: 'Dal & Pulses', unit: 'pcs', sellingPrice: 115, costPrice: 98, reorderLevel: 12 },
    { name: 'Tata Sampann Toor Dal 1kg', brand: 'Tata Sampann', barcode: '8901288004539', category: 'Dal & Pulses', unit: 'pcs', sellingPrice: 185, costPrice: 162, reorderLevel: 12 },

    // ── Oils ──
    { name: 'Fortune Sunflower Oil 1L', brand: 'Fortune', barcode: '8901462106016', category: 'Oils', unit: 'pcs', sellingPrice: 185, costPrice: 162, reorderLevel: 15 },
    { name: 'Saffola Gold Oil 1L', brand: 'Saffola', barcode: '8901022022016', category: 'Oils', unit: 'pcs', sellingPrice: 225, costPrice: 196, reorderLevel: 10 },
    { name: 'Patanjali Mustard Oil 1L', brand: 'Patanjali', barcode: '8906003780017', category: 'Oils', unit: 'pcs', sellingPrice: 165, costPrice: 142, reorderLevel: 10 },

    // ── Spices ──
    { name: 'MDH Garam Masala 100g', brand: 'MDH', barcode: '8904031600011', category: 'Spices', unit: 'pcs', sellingPrice: 75, costPrice: 62, reorderLevel: 15 },
    { name: 'Everest Kitchen King 100g', brand: 'Everest', barcode: '8906000600012', category: 'Spices', unit: 'pcs', sellingPrice: 68, costPrice: 56, reorderLevel: 12 },
    { name: 'Catch Turmeric Powder 200g', brand: 'Catch', barcode: '8906004690100', category: 'Spices', unit: 'pcs', sellingPrice: 72, costPrice: 60, reorderLevel: 12 },

    // ── Beverages ──
    { name: 'Tata Tea Premium 500g', brand: 'Tata Tea', barcode: '8901058004013', category: 'Tea & Coffee', unit: 'pcs', sellingPrice: 275, costPrice: 240, reorderLevel: 10 },
    { name: 'Nescafe Classic 50g', brand: 'Nescafe', barcode: '8901058008011', category: 'Tea & Coffee', unit: 'pcs', sellingPrice: 145, costPrice: 122, reorderLevel: 8 },
    { name: 'Bournvita 500g', brand: 'Cadbury', barcode: '8901017000131', category: 'Health Drinks', unit: 'pcs', sellingPrice: 355, costPrice: 308, reorderLevel: 6 },
    { name: 'Horlicks Original 500g', brand: 'Horlicks', barcode: '8901571000133', category: 'Health Drinks', unit: 'pcs', sellingPrice: 325, costPrice: 282, reorderLevel: 6 },

    // ── Biscuits & Snacks ──
    { name: 'Parle-G Original Gluco 800g', brand: 'Parle', barcode: '8901719112195', category: 'Biscuits', unit: 'pcs', sellingPrice: 65, costPrice: 55, reorderLevel: 20 },
    { name: 'Britannia Good Day Butter 200g', brand: 'Britannia', barcode: '8901063040087', category: 'Biscuits', unit: 'pcs', sellingPrice: 40, costPrice: 33, reorderLevel: 20 },
    { name: 'Lay\'s Classic Salted 78g', brand: 'Lay\'s', barcode: '8901491105157', category: 'Snacks', unit: 'pcs', sellingPrice: 20, costPrice: 16, reorderLevel: 25 },
    { name: 'Kurkure Masala Munch 90g', brand: 'Kurkure', barcode: '8901491115156', category: 'Snacks', unit: 'pcs', sellingPrice: 20, costPrice: 16, reorderLevel: 25 },
    { name: 'Haldirams Aloo Bhujia 200g', brand: 'Haldirams', barcode: '8902519100014', category: 'Snacks', unit: 'pcs', sellingPrice: 85, costPrice: 72, reorderLevel: 15 },
    { name: 'Maggi 2-Min Noodles 420g', brand: 'Nestle', barcode: '8901058817021', category: 'Noodles', unit: 'pcs', sellingPrice: 80, costPrice: 68, reorderLevel: 20 },
    { name: 'Dairy Milk Silk 60g', brand: 'Cadbury', barcode: '8901017002043', category: 'Chocolate', unit: 'pcs', sellingPrice: 60, costPrice: 50, reorderLevel: 20 },

    // ── Dairy ──
    { name: 'Amul Butter 500g', brand: 'Amul', barcode: '8901233000504', category: 'Dairy', unit: 'pcs', sellingPrice: 245, costPrice: 214, reorderLevel: 8 },
    { name: 'Amul Cheese Slices 750g', brand: 'Amul', barcode: '8901233010268', category: 'Dairy', unit: 'pcs', sellingPrice: 385, costPrice: 336, reorderLevel: 5 },
    { name: 'Amul Ghee 1L', brand: 'Amul', barcode: '8901233001007', category: 'Dairy', unit: 'pcs', sellingPrice: 699, costPrice: 612, reorderLevel: 6 },

    // ── Personal Care ──
    { name: 'Colgate Strong Teeth 300g', brand: 'Colgate', barcode: '8901314006443', category: 'Personal Care', unit: 'pcs', sellingPrice: 110, costPrice: 92, reorderLevel: 15 },
    { name: 'Lifebuoy Total 10 125g', brand: 'Lifebuoy', barcode: '8901030542214', category: 'Personal Care', unit: 'pcs', sellingPrice: 52, costPrice: 43, reorderLevel: 20 },
    { name: 'Dettol Original Soap 125g', brand: 'Dettol', barcode: '8901396026311', category: 'Personal Care', unit: 'pcs', sellingPrice: 58, costPrice: 48, reorderLevel: 20 },
    { name: 'Head & Shoulders 340ml', brand: 'H&S', barcode: '8001090124548', category: 'Personal Care', unit: 'pcs', sellingPrice: 345, costPrice: 298, reorderLevel: 8 },
    { name: 'Parachute Coconut Oil 500ml', brand: 'Parachute', barcode: '8901030542316', category: 'Personal Care', unit: 'pcs', sellingPrice: 195, costPrice: 168, reorderLevel: 12 },

    // ── Household ──
    { name: 'Surf Excel Easy Wash 1kg', brand: 'Surf Excel', barcode: '8901030838313', category: 'Detergent', unit: 'pcs', sellingPrice: 155, costPrice: 132, reorderLevel: 15 },
    { name: 'Ariel Matic 1kg', brand: 'Ariel', barcode: '8001841001975', category: 'Detergent', unit: 'pcs', sellingPrice: 265, costPrice: 228, reorderLevel: 10 },
    { name: 'Vim Dishwash Gel 500ml', brand: 'Vim', barcode: '8901030838412', category: 'Household', unit: 'pcs', sellingPrice: 105, costPrice: 88, reorderLevel: 12 },
    { name: 'Harpic Power Plus 500ml', brand: 'Harpic', barcode: '8901396100004', category: 'Household', unit: 'pcs', sellingPrice: 128, costPrice: 108, reorderLevel: 8 },
    { name: 'Good Knight Liquid Refill 45ml', brand: 'Good Knight', barcode: '8901212025014', category: 'Household', unit: 'pcs', sellingPrice: 75, costPrice: 62, reorderLevel: 15 },

    // ── Packaged Food / Sauces ──
    { name: 'Kissan Tomato Ketchup 500g', brand: 'Kissan', barcode: '8901030838511', category: 'Sauces', unit: 'pcs', sellingPrice: 125, costPrice: 108, reorderLevel: 10 },
    { name: 'Tropicana Orange 1L', brand: 'Tropicana', barcode: '8901491100015', category: 'Juices', unit: 'pcs', sellingPrice: 130, costPrice: 112, reorderLevel: 10 },
];

// helpers
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(d) { return now - d * DAY; }

async function seed() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const bRes = await client.query('SELECT id FROM businesses LIMIT 1');
        const BUSINESS_ID = bRes.rows[0].id;

        console.log("🌱 Seeding...");

        const productIds = [];

        // ── PRODUCTS ──
        for (const p of PRODUCTS) {
            const id = uuidv4();
            productIds.push({ id, ...p });

            await client.query(
                `INSERT INTO products
                (id, business_id, name, category, barcode, brand, unit,
                 reorder_level, schedule_h, selling_price, sync_status, updated_at, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'synced',$11,NOW())`,
                [
                    id, BUSINESS_ID, p.name, p.category,
                    p.barcode, p.brand, p.unit,
                    p.reorderLevel, false,
                    p.sellingPrice, now
                ]
            );
        }

        // ── STOCK ──
        const batchMap = {};

        for (const p of productIds) {
            batchMap[p.id] = [];

            const batchId = uuidv4();
            const qty = randInt(20, 50);
            const createdTs = daysAgo(randInt(10, 30));
            const updatedNow = Date.now();

            await client.query(
                `INSERT INTO stock_batches
                (id, product_id, quantity, batch_no, expiry_date,
                 cost_price, sync_status, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,'synced',$7,$8)`,
                [batchId, p.id, qty, "B1", now + 1000000000, p.costPrice, createdTs, updatedNow]
            );

            await client.query(
                `INSERT INTO stock_transactions
                (id, product_id, batch_id, type, quantity,
                 txn_at, sync_status, updated_at)
                 VALUES ($1,$2,$3,'stock_in',$4,$5,'synced',$6)`,
                [uuidv4(), p.id, batchId, qty, createdTs, updatedNow]
            );

            batchMap[p.id].push({ batchId });
        }

        // ── SALES (ONLY 5 DAYS) ──
        for (let day = 5; day >= 0; day--) {
            const ordersToday = randInt(1, 3);

            for (let o = 0; o < ordersToday; o++) {
                const orderId = uuidv4();
                const saleTs = daysAgo(day);
                const updatedNow = Date.now();

                const prod = randFrom(productIds);
                const batch = batchMap[prod.id][0];
                const qty = randInt(1, 3);
                const totalAmount = qty * prod.sellingPrice;

                await client.query(
                    `INSERT INTO sale_orders
                    (id, business_id, total_amount, payment_mode,
                     sale_at, sync_status, updated_at)
                     VALUES ($1,$2,$3,'cash',$4,'synced',$5)`,
                    [orderId, BUSINESS_ID, totalAmount, saleTs, updatedNow]
                );

                await client.query(
                    `INSERT INTO sale_items
                    (id, order_id, product_id, batch_id, quantity, unit_price, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [uuidv4(), orderId, prod.id, batch.batchId, qty, prod.sellingPrice, updatedNow]
                );

                await client.query(
                    `INSERT INTO stock_transactions
                    (id, product_id, batch_id, type, quantity,
                     txn_at, sync_status, updated_at)
                     VALUES ($1,$2,$3,'sale',$4,$5,'synced',$6)`,
                    [uuidv4(), prod.id, batch.batchId, qty, saleTs, updatedNow]
                );
            }
        }

        await client.query('COMMIT');
        console.log("✅ DONE - FAST SEED");

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

seed();