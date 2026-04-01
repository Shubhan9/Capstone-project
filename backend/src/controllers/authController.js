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

    const exists = await query('SELECT id FROM businesses WHERE phone = $1', [phone]);
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

    res.status(201).json({ token, business });
});

const login = asyncHandler(async (req, res) => {
    const { phone, password } = req.body;

    const { rows } = await query(
        'SELECT id, name, phone, type, password_hash FROM businesses WHERE phone = $1',
        [phone]
    );
    if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const business = rows[0];
    const valid = await bcrypt.compare(password, business.password_hash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const token = signToken(business.id);
    const { password_hash: _, ...safe } = business;

    res.json({ token, business: safe });
});

function signToken(businessId) {
    return jwt.sign({ businessId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });
}

module.exports = { register, login, registerValidation, loginValidation };