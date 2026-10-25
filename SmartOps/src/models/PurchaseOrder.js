import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class PurchaseOrder extends Model {
    static table = 'purchase_orders';

    @field('business_id') businessId;
    @field('supplier_id') supplierId;
    @field('status') status;          // draft | sent | received | cancelled
    @field('items_json') itemsJson;
    @field('note') note;
    @field('ordered_at') orderedAt;
    @field('sync_status') syncStatus;
    @field('updated_at') updatedAt;

    // [{ product_id, name, quantity }]
    get items() {
        try { return JSON.parse(this.itemsJson || '[]'); } catch { return []; }
    }
}
