import database from './index';
import { restoreSession, startAutoSync } from '../sync/syncEngine';

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function initApp() {
    console.log('App init start');
    // 1. Restore auth + businessId
    await restoreSession();

    // 2. Force DB to initialize (IMPORTANT)
    try {
        await database.get('products').query().fetch();
        console.log('DB ready');
    } catch (err) {
        console.log('DB warmup error:', err.message);
    }

    // 3. Extra buffer (Watermelon internal setup)
    await wait(500);

    // 4. Start sync ONLY AFTER DB READY
    startAutoSync();

    console.log('App init complete');
}