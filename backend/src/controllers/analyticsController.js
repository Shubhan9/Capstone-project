const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/errors');

// GET /api/analytics/sales?period=daily|weekly|monthly
const sales = asyncHandler(async (req, res) => {
    const businessId = req.business.id;
    const period = req.query.period || 'daily';

    const trunc = period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day';

    const { rows } = await query(
        `SELECT
       DATE_TRUNC($1, TO_TIMESTAMP(sale_at / 1000)) AS period,
       COUNT(*)                                      AS order_count,
       SUM(total_amount)                             AS revenue,
       SUM(CASE WHEN payment_mode='cash'   THEN total_amount ELSE 0 END) AS cash,
       SUM(CASE WHEN payment_mode='upi'    THEN total_amount ELSE 0 END) AS upi,
       SUM(CASE WHEN payment_mode='credit' THEN total_amount ELSE 0 END) AS credit
     FROM sale_orders
     WHERE business_id = $2
       AND TO_TIMESTAMP(sale_at / 1000) >= NOW() - INTERVAL '90 days'
     GROUP BY 1
     ORDER BY 1 DESC`,
        [trunc, businessId]
    );
    res.json({ period, data: rows });
});

// GET /api/analytics/top-products?limit=10
const topProducts = asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const { rows } = await query(
        `SELECT
       p.id, p.name, p.category, p.unit,
       SUM(si.quantity)              AS units_sold,
       SUM(si.quantity * si.unit_price) AS revenue
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sale_orders so ON so.id = si.order_id
     WHERE so.business_id = $1
       AND TO_TIMESTAMP(so.sale_at / 1000) >= NOW() - INTERVAL '30 days'
     GROUP BY p.id
     ORDER BY units_sold DESC
     LIMIT $2`,
        [req.business.id, limit]
    );
    res.json({ top_products: rows });
});

// GET /api/analytics/customers
const customerStats = asyncHandler(async (req, res) => {
    const businessId = req.business.id;

    // Segment by purchase frequency in last 30 days
    const { rows } = await query(
        `WITH customer_activity AS (
       SELECT
         c.id, c.name, c.phone,
         COUNT(so.id)         AS order_count_30d,
         SUM(so.total_amount) AS spend_30d,
         MAX(so.sale_at)      AS last_order_at
       FROM customers c
       LEFT JOIN sale_orders so
         ON so.customer_id = c.id
         AND TO_TIMESTAMP(so.sale_at / 1000) >= NOW() - INTERVAL '30 days'
       WHERE c.business_id = $1
       GROUP BY c.id
     )
     SELECT *,
       CASE
         WHEN order_count_30d >= 4 THEN 'regular'
         WHEN order_count_30d  > 0 THEN 'occasional'
         WHEN last_order_at IS NULL THEN 'new'
         ELSE 'dormant'
       END AS computed_segment
     FROM customer_activity
     ORDER BY spend_30d DESC NULLS LAST`,
        [businessId]
    );

    const summary = {
        total: rows.length,
        regular: rows.filter(r => r.computed_segment === 'regular').length,
        occasional: rows.filter(r => r.computed_segment === 'occasional').length,
        dormant: rows.filter(r => r.computed_segment === 'dormant').length,
        new: rows.filter(r => r.computed_segment === 'new').length,
    };

    res.json({ summary, customers: rows });
});

// GET /api/analytics/dashboard  — all summary data in one call for home screen
const dashboard = asyncHandler(async (req, res) => {
    const businessId = req.business.id;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const [todaySales, lowStock, nearExpiry, topProds] = await Promise.all([
        query(
            `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS revenue
       FROM sale_orders
       WHERE business_id = $1 AND sale_at >= $2`,
            [businessId, todayStart.getTime()]
        ),
        query(
            `SELECT COUNT(*) AS count FROM products p
       WHERE p.business_id = $1
       AND COALESCE((
         SELECT SUM(CASE WHEN type IN ('stock_in','return') THEN quantity ELSE -quantity END)
         FROM stock_transactions WHERE product_id = p.id
       ), 0) <= p.reorder_level`,
            [businessId]
        ),
        query(
            `SELECT COUNT(*) AS count FROM stock_batches sb
       JOIN products p ON p.id = sb.product_id
       WHERE p.business_id = $1 AND sb.expiry_date <= $2`,
            [businessId, Date.now() + 7 * 86400000]
        ),
        query(
            `SELECT p.name, SUM(si.quantity) AS units
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN sale_orders so ON so.id = si.order_id
       WHERE so.business_id = $1
         AND TO_TIMESTAMP(so.sale_at/1000) >= NOW() - INTERVAL '7 days'
       GROUP BY p.id ORDER BY units DESC LIMIT 5`,
            [businessId]
        ),
    ]);

    res.json({
        today: {
            orders: parseInt(todaySales.rows[0].count),
            revenue: parseFloat(todaySales.rows[0].revenue),
        },
        alerts: {
            low_stock: parseInt(lowStock.rows[0].count),
            near_expiry: parseInt(nearExpiry.rows[0].count),
        },
        top_products_week: topProds.rows,
    });
});

module.exports = { sales, topProducts, customerStats, dashboard };