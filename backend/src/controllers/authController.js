const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/errors');

const registerValidation = [
    body('name').trim().notEmpty().withMessage('Shop name is required'),
    body('phone').trim().isMobilePhone().withMessage('Valid phone number required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('type').optional().isIn(['kirana', 'pharmacy', 'cloud_kitchen', 'stationary', 'other']),
];

const loginValidation = [
    body('phone').trim().notEmpty(),
    body('password').notEmpty(),
];

const register = asyncHandler(async (req, res) => {
    const { name, phone, password, type = 'kirana' } = req.body;

    const exists = await query(
        'SELECT id FROM businesses WHERE phone = $1 UNION SELECT id FROM staff WHERE phone = $1',
        [phone]
    );
    if (exists.rows.length > 0) {
        return res.status(409).json({ error: 'Phone number already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
        `INSERT INTO businesses (name, phone, password_hash, type)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, phone, type, created_at`,
        [name, phone, hash, type]
    );

    const business = rows[0];
    const token = signToken(business.id);

    res.status(201).json({ token, business, role: 'owner' });
});

const login = asyncHandler(async (req, res) => {
    const { phone, password } = req.body;

    const { rows } = await query(
        'SELECT id, name, phone, type, upi_id, address, gstin, password_hash FROM businesses WHERE phone = $1',
        [phone]
    );
    if (rows.length === 0) return staffLogin(req, res);

    const business = rows[0];
    const valid = await bcrypt.compare(password, business.password_hash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const token = signToken(business.id);
    const { password_hash: _, ...safe } = business;

    res.json({ token, business: safe, role: 'owner' });
});

// A phone that isn't an owner login may be a staff login. Staff get the
// business they work for, plus role/staff so the app can restrict itself.
async function staffLogin(req, res) {
    const { phone, password } = req.body;
    const { rows } = await query(
        `SELECT s.id AS staff_id, s.name AS staff_name, s.password_hash,
            b.id, b.name, b.phone, b.type, b.upi_id, b.address, b.gstin
       FROM staff s JOIN businesses b ON b.id = s.business_id
      WHERE s.phone = $1 AND s.active`,
        [phone]
    );
    if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password_hash))) {
        return res.status(401).json({ error: 'Invalid phone or password' });
    }
    const { staff_id, staff_name, password_hash: _, ...business } = rows[0];
    const token = signToken(business.id, staff_id);
    res.json({ token, business, role: 'staff', staff: { id: staff_id, name: staff_name } });
}

function signToken(businessId, staffId) {
    const payload = staffId ? { businessId, staffId } : { businessId };
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });
}

module.exports = { register, login, registerValidation, loginValidation };