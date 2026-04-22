const router = require('express').Router();
const { body } = require('express-validator');

const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/errors');

const auth = require('../controllers/authController');
const barcode = require('../controllers/barcodeController');
const sync = require('../controllers/syncController');
const products = require('../controllers/productsController');
const analytics = require('../controllers/analyticsController');

// ── Health check ──────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.json({ status: 'ok', ts: Date.now() });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/register', auth.registerValidation, validate, auth.register);
router.post('/auth/login', auth.loginValidation, validate, auth.login);

// ── All routes below require JWT ──────────────────────────────────────────────
router.use(authenticate);

// ── Barcode lookup ────────────────────────────────────────────────────────────
router.get('/barcode/search', barcode.search);   // ?q=parle
router.get('/barcode/:code', barcode.lookup);

// ── Sync (WatermelonDB push/pull) ─────────────────────────────────────────────
router.get('/sync/pull', sync.pull);             // ?last_pulled_at=<unix_ms>
router.post('/sync/push', sync.push);

// ── Products (read-only — writes happen via sync) ─────────────────────────────
router.get('/products', products.list);
router.get('/products/low-stock', products.lowStock);
router.get('/products/near-expiry', products.nearExpiry);   // ?days=30
router.get('/products/:id', products.get);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/dashboard', analytics.dashboard);
router.get('/analytics/sales', analytics.sales);         // ?period=daily|weekly|monthly
router.get('/analytics/top-products', analytics.topProducts);   // ?limit=10
router.get('/analytics/customers', analytics.customerStats);
router.get('/analytics/inventory/reorder-suggestions', analytics.reorderSuggestions);
router.get('/analytics/inventory/stock-risk', analytics.stockRisk);
router.get('/analytics/inventory/expiry-risk', analytics.expiryRisk);
router.get('/analytics/inventory/dead-stock', analytics.deadStock);
router.get('/analytics/inventory/opportunities', analytics.opportunities);
router.get('/analytics/inventory/intelligence', analytics.inventoryIntelligence);

module.exports = router;
