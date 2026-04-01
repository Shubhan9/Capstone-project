require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { pool } = require('../src/db/pool');

// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//   1. Download from https://world.openfoodfacts.org/data
//      Select: countries = India, export CSV
//   2. Place the file at: scripts/data/off_india.csv
//   3. Run: node scripts/seedOpenFoodFacts.js
// ─────────────────────────────────────────────────────────────────────────────

const CSV_PATH = path.join(__dirname, 'data', 'off_india.csv');

function mapCategory(raw) {
    if (!raw) return 'Other';
    const t = raw.toLowerCase();
    if (t.includes('beverage') || t.includes('drink') || t.includes('juice')) return 'Beverage';
    if (t.includes('snack') || t.includes('chip') || t.includes('biscuit')) return 'Snack';
    if (t.includes('dairy') || t.includes('milk') || t.includes('cheese')) return 'Dairy';
    if (t.includes('medicine') || t.includes('drug') || t.includes('pharma')) return 'Medicine';
    if (t.includes('personal') || t.includes('hygiene') || t.includes('soap')) return 'Personal Care';
    if (t.includes('household') || t.includes('clean')) return 'Household';
    if (t.includes('grocery') || t.includes('grain') || t.includes('rice')) return 'Grocery';
    return 'Other';
}

async function seed() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`CSV not found at ${CSV_PATH}`);
        console.error('Download from: https://world.openfoodfacts.org/data');
        process.exit(1);
    }

    console.log('Reading CSV...');
    const raw = fs.readFileSync(CSV_PATH);
    const rows = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
    });
    console.log(`  Parsed ${rows.length} rows`);

    const valid = rows.filter(r => r.code && r.code.trim() && r.product_name && r.product_name.trim());
    console.log(`  Valid rows (have barcode + name): ${valid.length}`);

    const client = await pool.connect();
    let inserted = 0;
    let skipped = 0;

    try {
        await client.query('BEGIN');

        for (const row of valid) {
            const category = mapCategory(row.categories_tags_en || row.categories || '');

            const res = await client.query(
                `INSERT INTO barcode_catalog (barcode, name, brand, category, quantity, source)
         VALUES ($1, $2, $3, $4, $5, 'openfoodfacts')
         ON CONFLICT (barcode) DO NOTHING`,
                [
                    row.code.trim(),
                    row.product_name.trim().slice(0, 255),
                    (row.brands || '').trim().slice(0, 100) || null,
                    category,
                    (row.quantity || '').trim().slice(0, 50) || null,
                ]
            );
            if (res.rowCount > 0) inserted++;
            else skipped++;

            if ((inserted + skipped) % 1000 === 0) {
                process.stdout.write(`  Progress: ${inserted + skipped}/${valid.length}\r`);
            }
        }

        await client.query('COMMIT');
        console.log(`\n✓ Done. Inserted: ${inserted}  Skipped (duplicates): ${skipped}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seed failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();