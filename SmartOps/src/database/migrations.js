import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

// WatermelonDB applies these steps in order to bring an existing on-device
// database up to the current schema version WITHOUT destroying local data.
// Each `toVersion` block runs only on devices currently below that version.
export default schemaMigrations({
    migrations: [
        {
            // v2 -> v3: introduce the khata (customer credit) ledger.
            toVersion: 3,
            steps: [
                createTable({
                    name: 'ledger_entries',
                    columns: [
                        { name: 'business_id', type: 'string', isIndexed: true },
                        { name: 'customer_id', type: 'string', isIndexed: true },
                        { name: 'order_id', type: 'string', isOptional: true },
                        { name: 'type', type: 'string' },
                        { name: 'amount', type: 'number' },
                        { name: 'note', type: 'string', isOptional: true },
                        { name: 'entry_at', type: 'number' },
                        { name: 'sync_status', type: 'string' },
                        { name: 'updated_at', type: 'number' },
                    ],
                }),
            ],
        },
        {
            // v3 -> v4: customer address (also doubles as the search disambiguator),
            // and phone becomes optional (enforced in app logic, not schema — a
            // cash/UPI-only customer no longer needs a phone number on file).
            toVersion: 4,
            steps: [
                addColumns({
                    table: 'customers',
                    columns: [
                        { name: 'address', type: 'string', isOptional: true },
                    ],
                }),
            ],
        },
    ],
});
