const { Pool } = require('pg');
const pg = require('pg');

// Tell pg to return int8 (BIGINT) and numeric as JS numbers, not strings
pg.types.setTypeParser(20, val => parseFloat(val));   // int8 / BIGINT
pg.types.setTypeParser(1700, val => parseFloat(val)); // NUMERIC / DECIMAL

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('DB pool error:', err.message);
});

async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
        console.log(`[SQL ${Date.now() - start}ms] ${text.slice(0, 100).replace(/\s+/g, ' ')}`);
    }
    return result;
}

async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, withTransaction };