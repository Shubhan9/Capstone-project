import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import schema from './schema';
import Product from '../models/Product';
import StockBatch from '../models/StockBatch';
import StockTransaction from '../models/StockTransaction';
import SaleOrder from '../models/SaleOrder';
import SaleItem from '../models/SaleItem';
import Customer from '../models/Customer';

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
setGenerator(() => uuidv4());

const STORAGE_KEY = '@bizops_lokijs_db';

const lokiStorageAdapter = {
    loadDatabase(dbname, callback) {
        AsyncStorage.getItem(STORAGE_KEY)
            .then(serialized => callback(serialized ?? null))
            .catch(() => callback(null));
    },
    saveDatabase(dbname, serialized, callback) {
        AsyncStorage.setItem(STORAGE_KEY, serialized)
            .then(() => callback(null))
            .catch(err => callback(err));
    },
    deleteDatabase(dbname, callback) {
        AsyncStorage.removeItem(STORAGE_KEY)
            .then(() => callback(null))
            .catch(err => callback(err));
    },
};

const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    dbName: 'bizops',
    lokiOptions: {
        adapter: lokiStorageAdapter,  // ← THIS IS THE KEY LINE
        autosave: true,
        autosaveInterval: 1000,
    },
});

const database = new Database({
    adapter,
    modelClasses: [Product, StockBatch, StockTransaction, SaleOrder, SaleItem, Customer],
});

export default database;
export { Product, StockBatch, StockTransaction, SaleOrder, SaleItem, Customer };