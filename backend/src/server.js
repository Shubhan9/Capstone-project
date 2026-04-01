require('dotenv').config();
const app = require('./app');
const { pool } = require('./db/pool');

const PORT = process.env.PORT || 3000;

async function start() {
    // Verify DB connection before accepting traffic
    try {
        await pool.query('SELECT 1');
        console.log('✓ Database connected');
    } catch (err) {
        console.error('✗ Database connection failed:', err.message);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`✓ BizOps API running on port ${PORT}`);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`  Health: http://localhost:${PORT}/api/health`);
    });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received — shutting down gracefully');
    await pool.end();
    process.exit(0);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});

start();