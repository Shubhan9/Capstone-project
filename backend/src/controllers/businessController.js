const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/errors');

// ── Shop profile (shown on bills, used for UPI payment links) ─────────────────
const getProfile = asyncHandler(async (req, res) => {
    const { rows } = await query(
        'SELECT id, name, phone, type, upi_id, address, gstin FROM businesses WHERE id = $1',
        [req.business.id]
    );
    res.json({ business: rows[0], role: req.role, staff: req.staff || null });
});

const profileValidation = [
    body('name').optional().trim().notEmpty(),
    // VPA format: handle@bank (e.g. ramesh@okaxis)
    body('upi_id').optional({ values: 'falsy' }).trim().matches(/^[\w.-]{2,}@[a-zA-Z]{2,}$/)
        .withMessage('UPI ID looks like name@bank'),
    body('address').optional({ values: 'null' }).trim(),
    body('gstin').optional({ values: 'falsy' }).trim().isLength({ min: 15, max: 15 })
        .withMessage('GSTIN is 15 characters'),
];

const updateProfile = asyncHandler(async (req, res) => {
    const fields = ['name', 'upi_id', 'address', 'gstin'].filter(f => req.body[f] !== undefined);
    if (fields.length === 0) return getProfile(req, res);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const { rows } = await query(
        `UPDATE businesses SET ${sets}, updated_at = NOW() WHERE id = $1
     RETURNING id, name, phone, type, upi_id, address, gstin`,
        [req.business.id, ...fields.map(f => req.body[f] || null)]
    );
    res.json({ business: rows[0] });
});

// ── Staff management (owner only) ─────────────────────────────────────────────
const staffValidation = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().isMobilePhone().withMessage('Valid phone number required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const listStaff = asyncHandler(async (req, res) => {
    const { rows } = await query(
        `SELECT id, name, phone, created_at FROM staff
      WHERE business_id = $1 AND active ORDER BY created_at`,
        [req.business.id]
    );
    res.json({ staff: rows });
});

const addStaff = asyncHandler(async (req, res) => {
    const { name, phone, password } = req.body;
    const taken = await query(
        'SELECT 1 FROM businesses WHERE phone = $1 UNION SELECT 1 FROM staff WHERE phone = $1',
        [phone]
    );
    if (taken.rows.length > 0) {
        return res.status(409).json({ error: 'Phone number already registered' });
    }
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
        `INSERT INTO staff (business_id, name, phone, password_hash)
     VALUES ($1, $2, $3, $4) RETURNING id, name, phone, created_at`,
        [req.business.id, name, phone, hash]
    );
    res.status(201).json({ staff: rows[0] });
});

// Soft-remove: the row stays (history), the login stops working at once.
// The phone is suffixed so the same number can be registered again later.
const removeStaff = asyncHandler(async (req, res) => {
    const { rowCount } = await query(
        `UPDATE staff SET active = FALSE, phone = phone || '#removed-' || id
      WHERE id = $1 AND business_id = $2 AND active`,
        [req.params.id, req.business.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ success: true });
});

module.exports = {
    getProfile, updateProfile, profileValidation,
    listStaff, addStaff, removeStaff, staffValidation,
};
