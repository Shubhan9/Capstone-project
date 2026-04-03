import { synchronize } from '@nozbe/watermelondb/sync';
import NetInfo from '@react-native-community/netinfo';
import database from '../database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'https://capstone-project-production-61cb.up.railway.app/api';

// ─────────────────────────────────────────────────────────────────────────────
// Auth state — in-memory, set on login, cleared on logout
// ─────────────────────────────────────────────────────────────────────────────
let _token = null;
let _businessId = null;

export async function setAuthToken(token) {
    _token = token;
    await AsyncStorage.setItem('authToken', token);
}

export async function setBusinessId(id) {
    _businessId = id;
    await AsyncStorage.setItem('businessId', id);
}

export function getAuthToken() { return _token; }
export function getBusinessId() { return _businessId; }

export async function restoreSession() {
    _token = await AsyncStorage.getItem('authToken');
    _businessId = await AsyncStorage.getItem('businessId');

    console.log('[session] restored:', {
        token: !!_token,
        businessId: _businessId,
    });
}

function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (_token) h['Authorization'] = `Bearer ${_token}`;
    return h;
}

function toFiniteNumber(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function toTimestampMs(value, fallback = 0) {
    const parsed = toFiniteNumber(value, fallback);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed < 1000000000000 ? parsed * 1000 : parsed;
}

function normalizeTableChanges(tableChanges, { numberFields = [], timestampFields = [] } = {}) {
    if (!tableChanges) return { created: [], updated: [], deleted: [] };

    const normalizeRow = row => {
        const normalized = { ...row };

        numberFields.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(normalized, field)) {
                normalized[field] = toFiniteNumber(normalized[field]);
            }
        });

        timestampFields.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(normalized, field)) {
                normalized[field] = toTimestampMs(normalized[field]);
            }
        });

        return normalized;
    };

    return {
        created: (tableChanges.created || []).map(normalizeRow),
        updated: (tableChanges.updated || []).map(normalizeRow),
        deleted: tableChanges.deleted || [],
    };
}

function firstSyncedRow(tableChanges) {
    return tableChanges?.created?.[0] || tableChanges?.updated?.[0] || null;
}

function pickSample(row, fields) {
    if (!row) return null;

    return fields.reduce((sample, field) => {
        sample[field] = row[field];
        return sample;
    }, { id: row.id });
}

function normalizePullChanges(changes) {
    return {
        ...changes,
        products: normalizeTableChanges(changes.products, {
            numberFields: ['reorder_level', 'selling_price'],
            timestampFields: ['updated_at'],
        }),
        stock_batches: normalizeTableChanges(changes.stock_batches, {
            numberFields: ['quantity', 'cost_price'],
            timestampFields: ['expiry_date', 'created_at', 'updated_at'],
        }),
        stock_transactions: normalizeTableChanges(changes.stock_transactions, {
            numberFields: ['quantity'],
            timestampFields: ['txn_at', 'updated_at'],
        }),
        sale_orders: normalizeTableChanges(changes.sale_orders, {
            numberFields: ['total_amount'],
            timestampFields: ['sale_at', 'updated_at'],
        }),
        sale_items: normalizeTableChanges(changes.sale_items, {
            numberFields: ['quantity', 'unit_price'],
            timestampFields: ['updated_at'],
        }),
        customers: normalizeTableChanges(changes.customers, {
            timestampFields: ['last_purchase_at', 'updated_at'],
        }),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core sync
// ─────────────────────────────────────────────────────────────────────────────
let _syncing = false;

export async function syncWithServer() {
    if (!_token || !_businessId) {
        console.log('[sync] 🔄 Skipped (Missing token or businessId)');
        return;
    }
    if (_syncing) {
        console.log('[sync] ⏳ Skipped (Already in progress)');
        return;
    }
    _syncing = true;
    console.log('[sync] 🚀 Started sync...');

    try {
        await synchronize({
            database,

            pullChanges: async ({ lastPulledAt }) => {
                const res = await fetch(
                    `${API_BASE}/sync/pull?last_pulled_at=${lastPulledAt ?? 0}`,
                    { headers: authHeaders() }
                );
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Pull failed ${res.status}`);
                }
                const { changes, timestamp } = await res.json();
                const normalizedChanges = normalizePullChanges(changes);

                console.log('[sync] PRODUCT SAMPLE', pickSample(
                    firstSyncedRow(normalizedChanges.products),
                    ['selling_price', 'updated_at']
                ));
                console.log('[sync] ORDER SAMPLE', pickSample(
                    firstSyncedRow(normalizedChanges.sale_orders),
                    ['sale_at', 'total_amount', 'updated_at']
                ));
                console.log('[sync] ITEM SAMPLE', pickSample(
                    firstSyncedRow(normalizedChanges.sale_items),
                    ['unit_price', 'quantity', 'updated_at']
                ));

                return { changes: normalizedChanges, timestamp };
            },

            pushChanges: async ({ changes, lastPulledAt }) => {
                const res = await fetch(`${API_BASE}/sync/push`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ changes, lastPulledAt }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Push failed ${res.status}`);
                }
            },
            sendCreatedAsUpdated: false,
        });

        console.log('✅ [sync] Complete at', new Date().toISOString());
    } catch (err) {
        console.warn('❌ [sync] Failed (will retry on next trigger):', err.message);
    } finally {
        _syncing = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-write sync — call this after any create/update action
// Debounced so rapid consecutive writes (e.g. multi-item order) only fire once
// ─────────────────────────────────────────────────────────────────────────────
let _syncTimer = null;

export function syncAfterWrite(delayMs = 1500) {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
        _syncTimer = null;
        syncWithServer();
    }, delayMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-sync on reconnect
// ─────────────────────────────────────────────────────────────────────────────
let _unsubscribe = null;

export function startAutoSync() {
    if (!_token || !_businessId) {
        console.log('[sync] 🔄 Skipped startAutoSync (Missing token or businessId)');
        return;
    }
    if (_unsubscribe) _unsubscribe();

    // Sync immediately on login
    syncWithServer();

    // Re-sync every time network comes back
    _unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected && state.isInternetReachable) {
            syncWithServer();
        }
    });

    return _unsubscribe;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout — ALWAYS do a final sync push before clearing credentials
// This ensures any writes made just before logout reach the server
// ─────────────────────────────────────────────────────────────────────────────
export async function logoutAndSync() {
    if (_syncTimer) {
        clearTimeout(_syncTimer);
        _syncTimer = null;
    }

    // Final push — wait for it to complete before wiping token
    console.log('[sync] Final sync before logout...');
    await syncWithServer();

    // Now safe to clear credentials
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    setAuthToken(null);
    setBusinessId(null);

    console.log('[sync] Logged out cleanly.');
}

// Keep stopAutoSync for backwards compat but it now does a final sync too
export async function stopAutoSync() {
    await logoutAndSync();
}
