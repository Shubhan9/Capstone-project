// Migrates the throwaway test database before the suite runs. Refuses to run
// against anything that isn't explicitly marked as a test database, so a
// stray DATABASE_URL can never point the tests at production.
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !/test/i.test(new URL(url).pathname)) {
        throw new Error('Set TEST_DATABASE_URL to a database whose name contains "test"');
    }
    execFileSync('node', [path.join(__dirname, '../src/db/migrate.js')], {
        env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' },
        stdio: 'ignore',
    });
};
