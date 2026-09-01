import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

export default class LedgerEntry extends Model {
    static table = 'ledger_entries';

    static associations = {
        customers: { type: 'belongs_to', key: 'customer_id' },
        sale_orders: { type: 'belongs_to', key: 'order_id' },
    };

    @field('business_id') businessId;
    @field('customer_id') customerId;
    @field('order_id') orderId;
    @field('type') type;              // 'credit_sale' | 'repayment'
    @field('amount') amount;
    @field('note') note;
    @field('entry_at') entryAt;       // unix ms — plain @field, NOT @date
    @field('sync_status') syncStatus;
    @field('updated_at') updatedAt;

    @relation('customers', 'customer_id') customer;
    @relation('sale_orders', 'order_id') order;

    // Signed effect on the customer's outstanding balance:
    // a credit sale increases what they owe; a repayment reduces it.
    get signedAmount() {
        return this.type === 'repayment' ? -this.amount : this.amount;
    }
}
