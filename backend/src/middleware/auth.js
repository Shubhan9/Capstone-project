const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

// Tokens carry { businessId } for the owner (every token issued before staff
// existed looks like this, so those sessions keep working unchanged) or
// { businessId, staffId } for a staff login.
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
    req.role = 'owner';

    if (payload.staffId) {
        // Looked up on every request so removing a staff member locks them out
        // immediately, same reasoning as the business lookup above.
        const staff = await query(
            'SELECT id, name FROM staff WHERE id = $1 AND business_id = $2 AND active',
            [payload.staffId, payload.businessId]
        );
        if (staff.rows.length === 0) {
            return res.status(401).json({ error: 'Staff account removed' });
        }
        req.staff = staff.rows[0];
        req.role = 'staff';
    }

    next();
}

function requireOwner(req, res, next) {
    if (req.role !== 'owner') {
        return res.status(403).json({ error: 'Only the shop owner can do this' });
    }
    next();
}

module.exports = { authenticate, requireOwner };
