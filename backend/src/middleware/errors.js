const { validationResult } = require('express-validator');

// Validate express-validator results and return 422 if any errors
function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            error: 'Validation failed',
            fields: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }
    next();
}

// Global error handler — must be registered last in Express
function errorHandler(err, req, res, next) {
    console.error(`[ERROR] ${req.method} ${req.path}`, err.message);

    if (err.code === '23505') {   // PostgreSQL unique violation
        return res.status(409).json({ error: 'Duplicate entry — record already exists' });
    }
    if (err.code === '23503') {   // Foreign key violation
        return res.status(422).json({ error: 'Referenced record does not exist' });
    }

    const status = err.status || 500;
    res.status(status).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}

// Async wrapper — catches promise rejections and forwards to errorHandler
function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { validate, errorHandler, asyncHandler };