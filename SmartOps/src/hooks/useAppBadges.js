// Single source of truth for the two numbers that used to be computed
// independently in three places (Home's revenue-card stat, Home's alert
// banner, and the avatar menu). Now there is exactly one place that fetches
// them (this provider, mounted once in App.js), and exactly two places that
// display them: the Inventory tab badge (stock alerts) and the Khata tab
// badge (amount due) — plus Home's single consolidated alert row, which
// reads the same numbers rather than re-fetching them.
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    getLowStockProducts, getNearExpiryBatches, getBatchQuantities, getOutstandingCustomers,
} from '../database/actions';

const POLL_MS = 30000;

const AppBadgesContext = createContext({
    stockAlertCount: 0,
    khataDueTotal: 0,
    khataDueCount: 0,
    refresh: () => {},
});

export function AppBadgesProvider({ children }) {
    const [stockAlertCount, setStockAlertCount] = useState(0);
    const [khataDueTotal, setKhataDueTotal] = useState(0);
    const [khataDueCount, setKhataDueCount] = useState(0);
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        const [lowStock, nearExpiry, outstanding] = await Promise.all([
            getLowStockProducts(),
            getNearExpiryBatches(7),
            getOutstandingCustomers(),
        ]);

        const expiryQtys = await getBatchQuantities(nearExpiry);
        const actionableExpiry = nearExpiry.filter(batch => (expiryQtys[batch.id] ?? 0) > 0);

        if (!mounted.current) return;
        setStockAlertCount(lowStock.length + actionableExpiry.length);
        setKhataDueTotal(outstanding.reduce((sum, row) => sum + row.balance, 0));
        setKhataDueCount(outstanding.length);
    }, []);

    useEffect(() => {
        mounted.current = true;
        refresh();
        const timer = setInterval(refresh, POLL_MS);
        return () => { mounted.current = false; clearInterval(timer); };
    }, [refresh]);

    return (
        <AppBadgesContext.Provider value={{ stockAlertCount, khataDueTotal, khataDueCount, refresh }}>
            {children}
        </AppBadgesContext.Provider>
    );
}

export function useAppBadges() {
    return useContext(AppBadgesContext);
}
