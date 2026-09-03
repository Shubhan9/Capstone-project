import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncWithServer } from '../sync/syncEngine';
import { AppIcon } from '../theme/icons';
import { colors, spacing, radius, font } from '../theme';

export default function ProfileScreen({ navigation, name, onLogout }) {
    const [online, setOnline] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setOnline(state.isConnected !== false && state.isInternetReachable !== false);
        });
        return unsubscribe;
    }, []);

    async function handleSyncNow() {
        setSyncing(true);
        try {
            await syncWithServer();
        } finally {
            setSyncing(false);
        }
    }

    function confirmLogout() {
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: onLogout },
        ]);
    }

    return (
        <View style={s.root}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={s.back}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={s.title}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={s.identityCard}>
                <View style={s.avatar}>
                    <Text style={s.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={s.shopName} numberOfLines={1}>{name}</Text>
                <View style={s.statusRow}>
                    <View style={[s.statusDot, { backgroundColor: online ? colors.teal : colors.textMuted }]} />
                    <Text style={s.statusText}>{online ? 'Online' : 'Offline · saved on device'}</Text>
                </View>
            </View>

            <TouchableOpacity style={s.row} onPress={handleSyncNow} disabled={syncing} activeOpacity={0.7}>
                <AppIcon name="sync" size="chip" />
                <Text style={s.rowLabel}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
                {syncing && <ActivityIndicator size="small" color={colors.teal} />}
            </TouchableOpacity>

            <TouchableOpacity style={s.row} onPress={confirmLogout} activeOpacity={0.7}>
                <AppIcon name="logout" size="chip" color={colors.red} />
                <Text style={[s.rowLabel, { color: colors.red }]}>Log out</Text>
            </TouchableOpacity>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl, marginBottom: spacing.xl,
    },
    back: { color: colors.teal, fontSize: font.md, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },

    identityCard: {
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight,
        padding: spacing.xxl, marginBottom: spacing.xl,
    },
    avatar: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: colors.bgInput,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.borderLight,
        marginBottom: spacing.md,
    },
    avatarInitial: { color: colors.textPrimary, fontSize: font.xxl, fontWeight: '700' },
    shopName: { color: colors.white, fontSize: font.xl, fontWeight: '800' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },

    row: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.sm,
    },
    rowLabel: { flex: 1, color: colors.textPrimary, fontSize: font.md, fontWeight: '600' },
});
