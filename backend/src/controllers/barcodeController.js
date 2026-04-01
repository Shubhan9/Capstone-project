const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/errors');

// GET /api/barcode/:code
// 1. Check products already in this business
// 2. Check barcode_catalog (OFF India seed)
// 3. Hit live OpenFoodFacts API
// 4. Return 404 → mobile shows manual entry

const lookup = asyncHandler(async (req, res) => {
    const { code } = req.params;
    const businessId = req.business.id;

    // ── 1. Already in this business's products? ───────────────────────────────
    const own = await query(
        `SELECT id, name, category, barcode, brand, unit, selling_price, reorder_level
     FROM products WHERE business_id = $1 AND barcode = $2`,
        [businessId, code]
    );
    if (own.rows.length > 0) {
        return res.json({ source: 'own_inventory', product: own.rows[0] });
    }

    // ── 2. Barcode catalog (your 21K India OFF dump) ──────────────────────────
    const cat = await query(
        'SELECT barcode, name, brand, category, quantity FROM barcode_catalog WHERE barcode = $1',
        [code]
    );
    if (cat.rows.length > 0) {
        return res.json({ source: 'catalog', suggestion: cat.rows[0] });
    }

    // ── 3. Live OpenFoodFacts API ─────────────────────────────────────────────
    try {
        const fields = 'code,product_name,brands,categories_tags_en,quantity,countries_tags';
        const offRes = await fetch(
            `https://world.openfoodfacts.org/api/v2/product/${code}?fields=${fields}`,
            { headers: { 'User-Agent': 'BizOps/1.0 (bizops@example.com)' }, signal: AbortSignal.timeout(4000) }
        );
        const offData = await offRes.json();
        if (offData.status === 1) {
            const p = offData.product;
            const suggestion = {
                barcode: p.code,
                name: p.product_name || null,
                brand: p.brands || null,
                category: p.categories_tags_en?.[0] || null,
                quantity: p.quantity || null,
            };
            // Cache it in catalog for next time
            await query(
                `INSERT INTO barcode_catalog (barcode, name, brand, category, quantity, source)
         VALUES ($1,$2,$3,$4,$5,'openfoodfacts_live')
         ON CONFLICT (barcode) DO NOTHING`,
                [suggestion.barcode, suggestion.name, suggestion.brand, suggestion.category, suggestion.quantity]
            ).catch(() => { }); // non-fatal if cache write fails

            return res.json({ source: 'openfoodfacts', suggestion });
        }
    } catch (err) {
        // OFF timeout or network error — fall through to 404
        console.warn('[barcode] OFF lookup failed:', err.message);
    }

    res.status(404).json({ error: 'Barcode not found', code });
});

// GET /api/barcode/search?q=parle  — fuzzy name search in catalog
const search = asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });

    const { rows } = await query(
        `SELECT barcode, name, brand, category, quantity
     FROM barcode_catalog
     WHERE to_tsvector('english', coalesce(name,'')) @@ plainto_tsquery('english', $1)
        OR name ILIKE $2
     LIMIT 20`,
        [q, `%${q}%`]
    );
    res.json({ results: rows });
});

module.exports = { lookup, search };