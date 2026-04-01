const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = header.slice(7);
    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Token expired or invalid' });
    }

    // Confirm business still exists
    const { rows } = await query(
        'SELECT id, name, type FROM businesses WHERE id = $1',
        [payload.businessId]
    );
    if (rows.length === 0) {
        return res.status(401).json({ error: 'Business account not found' });
    }

    req.business = rows[0];
    next();
}

module.exports = { authenticate };