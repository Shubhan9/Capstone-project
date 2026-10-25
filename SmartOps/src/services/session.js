import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The shop profile (name, type, UPI ID, address — printed on bills and used in
// payment links) and who is logged in (owner or staff). Cached on the device
// so bills and permission checks work offline; refreshed from the server on
// login and whenever the profile is edited.
const KEY = '@smartops_session';

let _session = { business: null, role: 'owner', staff: null };
const listeners = new Set();

function emit() {
    listeners.forEach(fn => fn(_session));
}

export async function loadSession() {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) _session = { ..._session, ...JSON.parse(raw) };
    } catch {
        // corrupt/missing cache — fall back to defaults, the next login rewrites it
    }
    emit();
    return _session;
}

export async function saveSession(patch) {
    _session = { ..._session, ...patch };
    emit();
    await AsyncStorage.setItem(KEY, JSON.stringify(_session));
}

export async function clearSession() {
    _session = { business: null, role: 'owner', staff: null };
    emit();
    await AsyncStorage.removeItem(KEY);
}

export function getSession() {
    return _session;
}

export function isOwner() {
    return _session.role !== 'staff';
}

// Requires batch number + expiry on stock-in only where they really exist.
export function shopNeedsBatchTracking(type = _session.business?.type) {
    return type === 'pharmacy';
}

export function useSession() {
    const [session, setSession] = useState(_session);
    useEffect(() => {
        listeners.add(setSession);
        setSession(_session);
        return () => listeners.delete(setSession);
    }, []);
    return session;
}
