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

export async function getProductByBarcode(barcode) {
    if (!barcode) return null;
    const rows = await database.get('products')
        .query(Q.where('barcode', barcode))
        .fetch();
    return rows[0] ?? null;
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
