import { synchronize } from '@nozbe/watermelondb/sync';
import NetInfo from '@react-native-community/netinfo';
import database from '../database';

// ── Replace this with your deployed URL ──────────────────────────────────────
// Railway:  https://bizops-backend-production.up.railway.app
// Render:   https://bizops-backend.onrender.com
export const API_BASE = 'https://your-backend-url.com/api';

// ─────────────────────────────────────────────────────────────────────────────
// Token storage — kept in memory for now, swap for SecureStore in production
// ─────────────────────────────────────────────────────────────────────────────
let _token = null;
export function setAuthToken(token) { _token = token; }
export function getAuthToken() { return _token; }

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_token}`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core sync — called on reconnect and on app foreground
// ─────────────────────────────────────────────────────────────────────────────
let _syncing = false;

export async function syncWithServer() {
    if (!_token) { console.log('[sync] No token — skipping'); return; }
    if (_syncing) { console.log('[sync] Already in progress'); return; }
    _syncing = true;

    try {
        await synchronize({
            database,

            pullChanges: async ({ lastPulledAt }) => {
                const url = `${API_BASE}/sync/pull?last_pulled_at=${lastPulledAt ?? 0}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Pull failed ${res.status}`);
                }
                const { changes, timestamp } = await res.json();
                return { changes, timestamp };
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

            migrationsEnabledAtVersion: 1,
            sendCreatedAsUpdated: false,   // let server distinguish new vs updated
        });

        console.log('[sync] ✓ Complete at', new Date().toISOString());
    } catch (err) {
        // Non-fatal — data stays locally, retried on next reconnect
        console.warn('[sync] Failed (will retry on reconnect):', err.message);
    } finally {
        _syncing = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-sync whenever network comes back
// Call startAutoSync(token) after login, stopAutoSync() on logout
// ─────────────────────────────────────────────────────────────────────────────
let _unsubscribe = null;

export function startAutoSync(token) {
    setAuthToken(token);
    if (_unsubscribe) _unsubscribe();   // clear any existing listener

    // Sync immediately on start
    syncWithServer();

    // Then re-sync every time the phone reconnects
    _unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected && state.isInternetReachable) {
            syncWithServer();
        }
    });

    return _unsubscribe;
}

export function stopAutoSync() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    setAuthToken(null);
}