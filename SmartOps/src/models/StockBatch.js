import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

export default class StockBatch extends Model {
    static table = 'stock_batches';

    static associations = {
        products: { type: 'belongs_to', key: 'product_id' },
        stock_transactions: { type: 'has_many', foreignKey: 'batch_id' },
        sale_items: { type: 'has_many', foreignKey: 'batch_id' },
    };

    @field('product_id') productId;
    @field('quantity') quantity;
    @field('batch_no') batchNo;
    @field('expiry_date') expiryDate;   // unix ms — plain @field, NOT @date
    @field('cost_price') costPrice;
    @field('sync_status') syncStatus;
    @field('created_at') createdAt;   // plain @field, NOT @date
    @field('updated_at') updatedAt;

    @relation('products', 'product_id') product;

    // expiry_date is raw unix ms — math works correctly now
    get daysUntilExpiry() {
        return Math.floor((this.expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
    }

    get isNearExpiry() { return this.daysUntilExpiry <= 30 && this.daysUntilExpiry >= 0; }
    get isExpired() { return this.daysUntilExpiry < 0; }
}