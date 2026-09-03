// Single source of truth for the two numbers that used to be computed
// independently in three places (Home's revenue-card stat, Home's alert
// banner, and the avatar menu). Now there is exactly one place that fetches
// them (this provider, mounted once in App.js), and exactly two places that
// display them: the Inventory tab badge (stock alerts) and the Khata tab
// badge (amount due) — plus Home's single consolidated alert row, which
// reads the same numbers rather than re-fetching them.
//
// "Seen" alerts don't count. A shopkeeper who's already looked at Khata and
// knows who owes them can't make a customer pay on the spot — leaving the
// same debt on Home/the tab badge forever just buries the one new thing
// they haven't seen yet under noise they've already dealt with mentally.
// So each alert-worthy id (a low-stock product, a near-expiry batch, a
// customer with a balance) is compared against a persisted "seen" set for
// its category, and only unseen ids count toward the badge. The screen that
// actually shows that category in full — Inventory for low stock, Alerts
// for near-expiry, Khata for balances — marks its current ids as seen when
// it's viewed. If an id drops out of the alert set (restocked, paid off)
// it's dropped from "seen" too, so if it comes back later (goes low again,
// falls into debt again) it correctly counts as new again.
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getLowStockProducts, getNearExpiryBatches, getBatchQuantities, getOutstandingCustomers,
} from '../database/actions';

const POLL_MS = 30000;

const LOW_STOCK_SEEN_KEY = 'smartops_seen_low_stock_ids';
const NEAR_EXPIRY_SEEN_KEY = 'smartops_seen_near_expiry_ids';
const KHATA_SEEN_KEY = 'smartops_seen_khata_customer_ids';

const noop = () => {};

const AppBadgesContext = createContext({
    stockAlertCount: 0,
    khataDueTotal: 0,
    khataDueCount: 0,
    refresh: noop,
    markLowStockSeen: noop,
    markNearExpirySeen: noop,
    markKhataSeen: noop,
});

async function loadSeenSet(key) {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveSeenSet(key, set) {
    // Best-effort — worst case a resolved-then-reopened alert re-surfaces once.
    AsyncStorage.setItem(key, JSON.stringify([...set])).catch(() => {});
}

export function AppBadgesProvider({ children }) {
    const [stockAlertCount, setStockAlertCount] = useState(0);
    const [khataDueTotal, setKhataDueTotal] = useState(0);
    const [khataDueCount, setKhataDueCount] = useState(0);
    const mounted = useRef(true);

    // Current alert-worthy ids/balances, refreshed on poll/mutation.
    const lowStockIdsRef = useRef(new Set());
    const nearExpiryIdsRef = useRef(new Set());
    const khataBalanceRef = useRef(new Map()); // customerId -> balance

    // Persisted "already looked at this" sets, compared against the above.
    const lowStockSeenRef = useRef(new Set());
    const nearExpirySeenRef = useRef(new Set());
    const khataSeenRef = useRef(new Set());

    const recompute = useCallback(() => {
        const unseenLow = [...lowStockIdsRef.current].filter(id => !lowStockSeenRef.current.has(id));
        const unseenExpiry = [...nearExpiryIdsRef.current].filter(id => !nearExpirySeenRef.current.has(id));
        setStockAlertCount(unseenLow.length + unseenExpiry.length);

        const unseenKhata = [...khataBalanceRef.current.keys()].filter(id => !khataSeenRef.current.has(id));
        setKhataDueCount(unseenKhata.length);
        setKhataDueTotal(unseenKhata.reduce((sum, id) => sum + (khataBalanceRef.current.get(id) || 0), 0));
    }, []);

    const refresh = useCallback(async () => {
        const [lowStock, nearExpiry, outstanding] = await Promise.all([
            getLowStockProducts(),
            getNearExpiryBatches(7),
            getOutstandingCustomers(),
        ]);

        const expiryQtys = await getBatchQuantities(nearExpiry);
        const actionableExpiry = nearExpiry.filter(batch => (expiryQtys[batch.id] ?? 0) > 0);

        if (!mounted.current) return;

        lowStockIdsRef.current = new Set(lowStock.map(({ product }) => product.id));
        nearExpiryIdsRef.current = new Set(actionableExpiry.map(batch => batch.id));
        khataBalanceRef.current = new Map(outstanding.map(row => [row.customer.id, row.balance]));

        // Drop resolved ids from "seen" so a recurrence (low again, in debt
        // again) isn't silently swallowed as "already dealt with".
        let seenChanged = false;
        for (const id of lowStockSeenRef.current) {
            if (!lowStockIdsRef.current.has(id)) { lowStockSeenRef.current.delete(id); seenChanged = true; }
        }
        for (const id of nearExpirySeenRef.current) {
            if (!nearExpiryIdsRef.current.has(id)) { nearExpirySeenRef.current.delete(id); seenChanged = true; }
        }
        for (const id of khataSeenRef.current) {
            if (!khataBalanceRef.current.has(id)) { khataSeenRef.current.delete(id); seenChanged = true; }
        }
        if (seenChanged) {
            saveSeenSet(LOW_STOCK_SEEN_KEY, lowStockSeenRef.current);
            saveSeenSet(NEAR_EXPIRY_SEEN_KEY, nearExpirySeenRef.current);
            saveSeenSet(KHATA_SEEN_KEY, khataSeenRef.current);
        }

        recompute();
    }, [recompute]);

    const markLowStockSeen = useCallback((ids) => {
        ids.forEach(id => lowStockSeenRef.current.add(id));
        saveSeenSet(LOW_STOCK_SEEN_KEY, lowStockSeenRef.current);
        recompute();
    }, [recompute]);

    const markNearExpirySeen = useCallback((ids) => {
        ids.forEach(id => nearExpirySeenRef.current.add(id));
        saveSeenSet(NEAR_EXPIRY_SEEN_KEY, nearExpirySeenRef.current);
        recompute();
    }, [recompute]);

    const markKhataSeen = useCallback((ids) => {
        ids.forEach(id => khataSeenRef.current.add(id));
        saveSeenSet(KHATA_SEEN_KEY, khataSeenRef.current);
        recompute();
    }, [recompute]);

    useEffect(() => {
        mounted.current = true;
        (async () => {
            const [lowSeen, expirySeen, khataSeen] = await Promise.all([
                loadSeenSet(LOW_STOCK_SEEN_KEY),
                loadSeenSet(NEAR_EXPIRY_SEEN_KEY),
                loadSeenSet(KHATA_SEEN_KEY),
            ]);
            lowStockSeenRef.current = lowSeen;
            nearExpirySeenRef.current = expirySeen;
            khataSeenRef.current = khataSeen;
            await refresh();
        })();

        const timer = setInterval(refresh, POLL_MS);
        return () => { mounted.current = false; clearInterval(timer); };
    }, [refresh]);

    return (
        <AppBadgesContext.Provider value={{
            stockAlertCount, khataDueTotal, khataDueCount,
            refresh, markLowStockSeen, markNearExpirySeen, markKhataSeen,
        }}>
            {children}
        </AppBadgesContext.Provider>
    );
}

export function useAppBadges() {
    return useContext(AppBadgesContext);
}
