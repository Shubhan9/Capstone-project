import database from './index';
import { Q } from '@nozbe/watermelondb';
import { getBusinessId, syncAfterWrite } from '../sync/syncEngine';

const PENDING = 'pending';

// ── Products ──────────────────────────────────────────────────────────────────

export async function registerProduct({
    name, category, barcode, unit, reorderLevel,
    scheduleH, sellingPrice, businessId, brand,
}) {
    const bId = businessId || getBusinessId();
    const now = Date.now();

    const result = await database.write(async () => {
        return database.get('products').create(p => {
            p.name = name;
            p.category = category;
            p.barcode = barcode || '';
            p.brand = brand || '';
            p.unit = unit;
            p.reorderLevel = reorderLevel ?? 5;
            p.scheduleH = scheduleH ?? false;
            p.sellingPrice = sellingPrice ?? 0;
            p.businessId = bId;
            p.syncStatus = PENDING;
            p.updatedAt = now;
        });
    });

    syncAfterWrite();
    return result;
}

export async function updateProduct({ productId, sellingPrice, reorderLevel }) {
    const now = Date.now();

    const result = await database.write(async () => {
        const product = await database.get('products').find(productId);
        return product.update(p => {
            if (sellingPrice !== undefined) p.sellingPrice = sellingPrice;
            if (reorderLevel !== undefined) p.reorderLevel = reorderLevel;
            p.syncStatus = PENDING;
            p.updatedAt = now;
        });
    });

    syncAfterWrite();   // this write lands in the sync `updated` bucket
    return result;
}

export async function getProductByBarcode(barcode) {
    if (!barcode) return null;
    const rows = await database.get('products')
        .query(Q.where('barcode', barcode))
        .fetch();
    return rows[0] ?? null;
}

export async function getProductById(id) {
    if (!id) return null;
    try {
        return await database.get('products').find(id);
    } catch {
        return null;   // find() throws if the id doesn't exist
    }
}

export async function getAllProducts() {
    const bId = getBusinessId();
    return database.get('products')
        .query(Q.where('business_id', bId))
        .fetch();
}

// ── Stock In ──────────────────────────────────────────────────────────────────

export async function recordStockIn({ productId, quantity, batchNo, expiryDate, costPrice }) {
    const now = Date.now();

    const result = await database.write(async () => {
        const batch = await database.get('stock_batches').create(b => {
            b.productId = productId;
            b.quantity = quantity;
            b.batchNo = batchNo;
            b.expiryDate = expiryDate;
            b.costPrice = costPrice || 0;
            b.syncStatus = PENDING;
            b.createdAt = now;
            b.updatedAt = now;
        });

        await database.get('stock_transactions').create(t => {
            t.productId = productId;
            t.batchId = batch.id;
            t.type = 'stock_in';
            t.quantity = quantity;
            t.txnAt = now;
            t.syncStatus = PENDING;
            t.updatedAt = now;
        });

        return batch;
    });

    syncAfterWrite();
    return result;
}

// ── Wastage / write-off ─────────────────────────────────────────────────────────
// Records a 'wastage' transaction against a batch. Because stock is derived from
// the transaction ledger (stock_in/return add, everything else subtracts), this
// immediately removes the written-off units from available stock — no separate
// stock column to keep in sync.
export async function recordWastage({ productId, batchId, quantity }) {
    const now = Date.now();

    const result = await database.write(async () => {
        return database.get('stock_transactions').create(t => {
            t.productId = productId;
            t.batchId = batchId;
            t.type = 'wastage';
            t.quantity = quantity;
            t.txnAt = now;
            t.syncStatus = PENDING;
            t.updatedAt = now;
        });
    });

    syncAfterWrite();
    return result;
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export async function recordSale({ customerId, items, paymentMode }) {
    const bId = getBusinessId();
    const now = Date.now();

    const result = await database.write(async () => {
        const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

        const order = await database.get('sale_orders').create(o => {
            o.businessId = bId;
            o.customerId = customerId || null;
            o.totalAmount = total;
            o.paymentMode = paymentMode || 'cash';
            o.saleAt = now;
            o.syncStatus = PENDING;
            o.updatedAt = now;
        });

        for (const item of items) {
            await database.get('sale_items').create(si => {
                si.orderId = order.id;
                si.productId = item.productId;
                si.batchId = item.batchId;
                si.quantity = item.quantity;
                si.unitPrice = item.unitPrice;
                si.updatedAt = now;
            });

            await database.get('stock_transactions').create(t => {
                t.productId = item.productId;
                t.batchId = item.batchId;
                t.type = 'sale';
                t.quantity = item.quantity;
                t.txnAt = now;
                t.syncStatus = PENDING;
                t.updatedAt = now;
            });
        }

        // Credit ("khata") sale — book the receivable in the same transaction as
        // the order, so the sale and the debt can never diverge. Requires a
        // customer to attribute the debt to.
        if (paymentMode === 'credit' && customerId) {
            await database.get('ledger_entries').create(e => {
                e.businessId = bId;
                e.customerId = customerId;
                e.orderId = order.id;
                e.type = 'credit_sale';
                e.amount = total;
                e.note = '';
                e.entryAt = now;
                e.syncStatus = PENDING;
                e.updatedAt = now;
            });
        }

        if (customerId) {
            const customer = await database.get('customers').find(customerId);
            await customer.update(c => {
                c.lastPurchaseAt = now;
                c.syncStatus = PENDING;
                c.updatedAt = now;
            });
        }

        return order;
    });

    syncAfterWrite();
    return result;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function upsertCustomer({ name, phone }) {
    const bId = getBusinessId();
    const now = Date.now();

    const result = await database.write(async () => {
        const existing = await database.get('customers')
            .query(Q.where('phone', phone), Q.where('business_id', bId))
            .fetch();

        if (existing.length > 0) return existing[0];

        return database.get('customers').create(c => {
            c.businessId = bId;
            c.name = name || phone;
            c.phone = phone;
            c.segment = 'new';
            c.lastPurchaseAt = now;
            c.syncStatus = PENDING;
            c.updatedAt = now;
        });
    });

    syncAfterWrite();
    return result;
}

// Name-first customer lookup for order entry: search local customers by name,
// phone, or address substring (case-insensitive). Small per-shop dataset, so a
// full fetch + in-memory filter is simpler and safer than building LIKE-pattern
// queries — no wildcard-escaping edge cases to get wrong.
export async function searchCustomers(query) {
    const bId = getBusinessId();
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const all = await database.get('customers')
        .query(Q.where('business_id', bId))
        .fetch();

    return all
        .filter(c =>
            c.name?.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q) ||
            c.address?.toLowerCase().includes(q)
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .slice(0, 8);
}

// Explicit "this is a genuinely new person" create — used once the search above
// has already given the shopkeeper a chance to pick an existing match instead.
// Unlike upsertCustomer, this never dedupes by phone: the dedup decision already
// happened in the search UI.
export async function createCustomer({ name, phone, address }) {
    const bId = getBusinessId();
    const now = Date.now();

    const result = await database.write(async () => {
        return database.get('customers').create(c => {
            c.businessId = bId;
            c.name = name;
            c.phone = phone || null;
            c.address = address || null;
            c.segment = 'new';
            c.lastPurchaseAt = null;
            c.syncStatus = PENDING;
            c.updatedAt = now;
        });
    });

    syncAfterWrite();
    return result;
}

export async function updateCustomerDetails({ customerId, name, phone, address }) {
    const now = Date.now();

    const result = await database.write(async () => {
        const customer = await database.get('customers').find(customerId);
        return customer.update(c => {
            if (name !== undefined) c.name = name;
            if (phone !== undefined) c.phone = phone || null;
            if (address !== undefined) c.address = address || null;
            c.syncStatus = PENDING;
            c.updatedAt = now;
        });
    });

    syncAfterWrite();
    return result;
}

// Full customer list for the Customer Directory screen, sorted by name.
export async function getAllCustomersDirectory() {
    const bId = getBusinessId();
    const rows = await database.get('customers')
        .query(Q.where('business_id', bId))
        .fetch();
    return rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Lifetime order count + total spend for a customer's directory profile.
export async function getCustomerOrderSummary(customerId) {
    const orders = await database.get('sale_orders')
        .query(Q.where('customer_id', customerId))
        .fetch();
    return {
        orderCount: orders.length,
        totalSpend: orders.reduce((sum, o) => sum + o.totalAmount, 0),
    };
}

// ── Khata / Credit Ledger ───────────────────────────────────────────────────────
// A customer's outstanding balance is DERIVED from the append-only ledger:
//   balance = Σ credit_sale.amount − Σ repayment.amount   (positive ⇒ they owe us)

export async function recordRepayment({ customerId, amount, note }) {
    const bId = getBusinessId();
    const now = Date.now();

    const result = await database.write(async () => {
        return database.get('ledger_entries').create(e => {
            e.businessId = bId;
            e.customerId = customerId;
            e.orderId = null;               // repayments aren't tied to a single order
            e.type = 'repayment';
            e.amount = amount;
            e.note = note || '';
            e.entryAt = now;
            e.syncStatus = PENDING;
            e.updatedAt = now;
        });
    });

    syncAfterWrite();
    return result;
}

export async function getCustomerBalance(customerId) {
    const entries = await database.get('ledger_entries')
        .query(Q.where('customer_id', customerId))
        .fetch();
    return entries.reduce((bal, e) => bal + e.signedAmount, 0);
}

export async function getCustomersByIds(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (unique.length === 0) return new Map();
    const customers = await database.get('customers')
        .query(Q.where('id', Q.oneOf(unique)))
        .fetch();
    return new Map(customers.map(c => [c.id, c]));
}

// All customers with a positive outstanding balance, largest first.
// Two batched queries total, regardless of how many customers/entries exist.
export async function getOutstandingCustomers() {
    const bId = getBusinessId();
    const entries = await database.get('ledger_entries')
        .query(Q.where('business_id', bId))
        .fetch();
    if (entries.length === 0) return [];

    const balanceByCustomer = {};
    for (const e of entries) {
        balanceByCustomer[e.customerId] = (balanceByCustomer[e.customerId] || 0) + e.signedAmount;
    }

    // Guard against floating-point dust from NUMERIC round-trips (e.g. 0.0000001).
    const owing = Object.entries(balanceByCustomer).filter(([, bal]) => bal > 0.005);
    if (owing.length === 0) return [];

    const customerMap = await getCustomersByIds(owing.map(([id]) => id));
    return owing
        .map(([id, balance]) => ({ customer: customerMap.get(id), balance }))
        .filter(row => row.customer)
        .sort((a, b) => b.balance - a.balance);
}

export async function getCustomerByPhone(phone) {
    const bId = getBusinessId();
    if (!phone) return null;
    const rows = await database.get('customers')
        .query(Q.where('phone', phone), Q.where('business_id', bId))
        .fetch();
    return rows[0] ?? null;
}

// Full ledger history for one customer (newest first) plus the derived balance.
export async function getCustomerLedger(customerId) {
    const entries = await database.get('ledger_entries')
        .query(Q.where('customer_id', customerId), Q.sortBy('entry_at', Q.desc))
        .fetch();
    const balance = entries.reduce((bal, e) => bal + e.signedAmount, 0);
    return { entries, balance };
}

// ── Analytics ─────────────────────────────────────────────────────────────────

// Signed quantity for a transaction: stock_in/return add, everything else subtracts.
function signedQty(txn) {
    return (txn.type === 'stock_in' || txn.type === 'return') ? txn.quantity : -txn.quantity;
}

// Current stock for many products in ONE query (avoids N+1 of product.currentStock()).
// Returns { [productId]: number }.
export async function getStockLevels(products) {
    if (!products || products.length === 0) return {};
    const productIds = products.map(p => p.id);
    const txns = await database.get('stock_transactions')
        .query(Q.where('product_id', Q.oneOf(productIds)))
        .fetch();

    const stockByProduct = Object.fromEntries(productIds.map(id => [id, 0]));
    for (const t of txns) stockByProduct[t.productId] += signedQty(t);
    return stockByProduct;
}

// Remaining quantity for many batches in ONE query (avoids N+1 of batch.currentQuantity()).
// Returns { [batchId]: number }.
export async function getBatchQuantities(batches) {
    if (!batches || batches.length === 0) return {};
    const batchIds = batches.map(b => b.id);
    const txns = await database.get('stock_transactions')
        .query(Q.where('batch_id', Q.oneOf(batchIds)))
        .fetch();

    const qtyByBatch = Object.fromEntries(batchIds.map(id => [id, 0]));
    for (const t of txns) {
        if (t.batchId in qtyByBatch) qtyByBatch[t.batchId] += signedQty(t);
    }
    return qtyByBatch;
}

// Fetch many products by id in ONE query. Returns a Map<id, Product>.
export async function getProductsByIds(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (unique.length === 0) return new Map();
    const products = await database.get('products')
        .query(Q.where('id', Q.oneOf(unique)))
        .fetch();
    return new Map(products.map(p => [p.id, p]));
}

export async function getLowStockProducts() {
    const products = await getAllProducts();
    if (products.length === 0) return [];

    const stockByProduct = await getStockLevels(products);

    const results = [];
    for (const p of products) {
        const stock = stockByProduct[p.id] ?? 0;
        if (stock <= p.reorderLevel) results.push({ product: p, stock });
    }
    return results.sort((a, b) => a.stock - b.stock);
}

export async function getNearExpiryBatches(days = 30) {
    const bId = getBusinessId();
    const now = Date.now();
    const cutoff = now + days * 86400000;

    const products = await database.get('products')
        .query(Q.where('business_id', bId))
        .fetch();

    const productIds = products.map(product => product.id);
    if (productIds.length === 0) return [];

    return database.get('stock_batches')
        .query(
            Q.where('product_id', Q.oneOf(productIds)),
            Q.where('expiry_date', Q.lte(cutoff))
        )
        .fetch();
}

export async function getTodaySales() {
    const bId = getBusinessId();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const orders = await database.get('sale_orders')
        .query(
            Q.where('business_id', bId),
            Q.where('sale_at', Q.gte(startOfDay.getTime()))
        )
        .fetch();

    const total = orders.reduce((s, o) => s + o.totalAmount, 0);
    return { count: orders.length, total };
}

// End-of-day closing summary, computed entirely from the local DB (works offline).
export async function getDaySummary() {
    const bId = getBusinessId();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const start = startOfDay.getTime();

    const orders = await database.get('sale_orders')
        .query(Q.where('business_id', bId), Q.where('sale_at', Q.gte(start)))
        .fetch();

    const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const byMode = { cash: 0, upi: 0, credit: 0 };
    for (const o of orders) {
        const mode = byMode[o.paymentMode] !== undefined ? o.paymentMode : 'cash';
        byMode[mode] += o.totalAmount;
    }

    const orderIds = orders.map(o => o.id);
    let itemsSold = 0;
    if (orderIds.length > 0) {
        const items = await database.get('sale_items')
            .query(Q.where('order_id', Q.oneOf(orderIds)))
            .fetch();
        itemsSold = items.reduce((sum, it) => sum + it.quantity, 0);
    }

    const wastageTxns = await database.get('stock_transactions')
        .query(Q.where('type', 'wastage'), Q.where('txn_at', Q.gte(start)))
        .fetch();
    const wastageUnits = wastageTxns.reduce((sum, t) => sum + t.quantity, 0);

    const ledgerToday = await database.get('ledger_entries')
        .query(Q.where('business_id', bId), Q.where('entry_at', Q.gte(start)))
        .fetch();
    const creditGiven = ledgerToday.filter(e => e.type === 'credit_sale').reduce((sum, e) => sum + e.amount, 0);
    const repaid = ledgerToday.filter(e => e.type === 'repayment').reduce((sum, e) => sum + e.amount, 0);

    return { orderCount: orders.length, revenue, byMode, itemsSold, wastageUnits, creditGiven, repaid };
}
