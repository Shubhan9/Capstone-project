import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, RefreshControl, StatusBar, Alert, Modal, ActivityIndicator
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { getLowStockProducts, getNearExpiryBatches, getTodaySales, getBatchQuantities, getOutstandingCustomers } from '../database/actions';
import { syncWithServer } from '../sync/syncEngine';
import { SectionHeader } from '../../components/UI';
import { colors, spacing, radius, font } from '../theme';

export default function HomeScreen({ navigation, onLogout, name }) {
    const [stats, setStats] = useState({ sales: 0, revenue: 0, lowStock: 0, expiry: 0, khataDue: 0, khataCount: 0 });
    const [refreshing, setRefreshing] = useState(false);
    const [online, setOnline] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Reflect real device connectivity in the status dot (was hardcoded green).
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            // isInternetReachable can be null while probing — treat only an
            // explicit false as offline so we don't flash "offline" on launch.
            setOnline(state.isConnected !== false && state.isInternetReachable !== false);
        });
        return unsubscribe;
    }, []);

    async function load() {
        const [lowStock, expiry, todaySales, outstanding] = await Promise.all([
            getLowStockProducts(),
            getNearExpiryBatches(7),
            getTodaySales(),
            getOutstandingCustomers(),
        ]);

        // Count near-expiry batches that still have stock left — one query, not one per batch.
        const expiryQtys = await getBatchQuantities(expiry);
        const actionableExpiry = expiry.filter(batch => (expiryQtys[batch.id] ?? 0) > 0);

        setStats({
            lowStock: lowStock.length,
            expiry: actionableExpiry.length,
            sales: todaySales.count,
            revenue: todaySales.total,
            khataDue: outstanding.reduce((sum, row) => sum + row.balance, 0),
            khataCount: outstanding.length,
        });
    }

    useFocusEffect(useCallback(() => { load(); }, []));

    async function onRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    async function handleSyncNow() {
        setSyncing(true);
        try {
            await syncWithServer();
            await load();
        } finally {
            setSyncing(false);
        }
    }

    function confirmLogout() {
        setMenuOpen(false);
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: onLogout },
        ]);
    }

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <ScrollView
                contentContainerStyle={s.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={s.header}>
                    <View style={s.headerLeft}>
                        <Text style={s.greeting}>Good {getGreeting()} 👋</Text>
                        <Text style={s.shopName} numberOfLines={1}>{name}</Text>
                        <View style={s.statusRow}>
                            <View style={[s.statusDot, { backgroundColor: online ? colors.teal : colors.textMuted }]} />
                        </View>
                    </View>
                    <TouchableOpacity
                        style={s.profileAvatar}
                        activeOpacity={0.7}
                        onPress={() => setMenuOpen(true)}
                    >
                        <Text style={s.profileInitial}>{name.charAt(0).toUpperCase()}</Text>
                        <View style={[s.onlineDot, { backgroundColor: online ? colors.teal : colors.textMuted }]} />
                    </TouchableOpacity>
                </View>

                {/* Main Revenue Card */}
                <View style={s.revenueCard}>
                    <View style={s.revenueHeaderRow}>
                        <Text style={s.revenueLabel}>TODAY&apos;S REVENUE</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('DaySummary')} activeOpacity={0.7}>
                            <Text style={s.daySummaryLink}>Day summary ›</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={s.revenueValue}>₹{stats.revenue.toFixed(0)}</Text>

                    <View style={s.revenueStatsRow}>
                        <TouchableOpacity style={s.revStat} onPress={() => navigation.navigate('OrderHistory')}>
                            <Text style={s.revStatValue}>{stats.sales}</Text>
                            <Text style={s.revStatLabel}>Orders ›</Text>
                        </TouchableOpacity>
                        <View style={s.revStatDivider} />
                        <View style={s.revStat}>
                            <Text style={[s.revStatValue, stats.lowStock > 0 && { color: colors.amber }]}>
                                {stats.lowStock}
                            </Text>
                            <Text style={s.revStatLabel}>Low stock</Text>
                        </View>
                    </View>
                </View>

                {/* Alerts banner */}
                {(stats.lowStock > 0 || stats.expiry > 0) && (
                    <TouchableOpacity style={s.alertBanner} onPress={() => navigation.navigate('Alerts')} activeOpacity={0.8}>
                        <View style={s.alertIconWrapper}>
                            <Text style={s.alertIcon}>⚠️</Text>
                        </View>
                        <View style={s.alertTextContainer}>
                            <Text style={s.alertTitle}>Action Required</Text>
                            <Text style={s.alertText}>
                                {[
                                    stats.lowStock > 0 && `${stats.lowStock} low stock`,
                                    stats.expiry > 0 && `${stats.expiry} expiring soon`,
                                ].filter(Boolean).join(' · ')}
                            </Text>
                        </View>
                        <Text style={s.alertArrow}>›</Text>
                    </TouchableOpacity>
                )}

                <SectionHeader title="QUICK ACTIONS" />

                {/* Primary Action Call-To-Action */}
                <TouchableOpacity
                    style={s.primaryActionCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('NewOrder')}
                >
                    <View style={s.primaryActionLeft}>
                        <Text style={s.primaryActionTitle}>New Order</Text>
                        <Text style={s.primaryActionSub}>Scan barcodes & checkout</Text>
                    </View>
                </TouchableOpacity>

                {/* Secondary Actions Grid */}
                <View style={s.secondaryActionsGrid}>
                    <TouchableOpacity style={s.secondaryActionCard} onPress={() => navigation.navigate('StockIn')} activeOpacity={0.75}>
                        <View style={[s.secIconWrapper, { backgroundColor: colors.blue + '15' }]}>
                            <Text style={s.secIcon}>📦</Text>
                        </View>
                        <Text style={s.secTitle}>Stock In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={s.secondaryActionCard} onPress={() => navigation.navigate('ProductRegistration')} activeOpacity={0.75}>
                        <View style={[s.secIconWrapper, { backgroundColor: colors.blue + '15' }]}>
                            <Text style={s.secIcon}>➕</Text>
                        </View>
                        <Text style={s.secTitle}>Add Product</Text>
                    </TouchableOpacity>
                </View>

                {/* Tertiary Actions */}
                <TouchableOpacity style={[s.tertiaryActionCard, { marginBottom: spacing.md }]} onPress={() => navigation.navigate('Reorder')} activeOpacity={0.75}>
                    <Text style={s.tertiaryIcon}>🛒</Text>
                    <Text style={s.tertiaryTitle}>Smart Restock</Text>
                    <Text style={s.alertArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.tertiaryActionCard, { marginBottom: spacing.md }]} onPress={() => navigation.navigate('Inventory')} activeOpacity={0.75}>
                    <Text style={s.tertiaryIcon}>📦</Text>
                    <Text style={s.tertiaryTitle}>View Full Inventory</Text>
                    <Text style={s.alertArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.tertiaryActionCard, { marginBottom: spacing.md }]} onPress={() => navigation.navigate('Khata')} activeOpacity={0.75}>
                    <Text style={s.tertiaryIcon}>📒</Text>
                    <Text style={s.tertiaryTitle}>Khata · Credit</Text>
                    {stats.khataDue > 0 ? (
                        <View style={s.khataDueBadge}>
                            <Text style={s.khataDueText}>₹{stats.khataDue.toFixed(0)} due</Text>
                        </View>
                    ) : (
                        <Text style={s.alertArrow}>›</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={s.tertiaryActionCard} onPress={() => navigation.navigate('OrderHistory')} activeOpacity={0.75}>
                    <Text style={s.tertiaryIcon}>🧾</Text>
                    <Text style={s.tertiaryTitle}>View Order History</Text>
                    <Text style={s.alertArrow}>›</Text>
                </TouchableOpacity>

            </ScrollView>

            {/* Account / quick-actions menu (opened from the avatar) */}
            <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
                <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
                    <View style={s.menuSheet}>
                        <View style={s.menuHeader}>
                            <View style={s.menuAvatar}>
                                <Text style={s.profileInitial}>{name.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.menuShopName} numberOfLines={1}>{name}</Text>
                                <Text style={s.menuStatus}>{online ? 'Online · synced' : 'Offline · saved on device'}</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={s.menuRow} onPress={handleSyncNow} disabled={syncing} activeOpacity={0.7}>
                            <Text style={s.menuIcon}>🔄</Text>
                            <Text style={s.menuLabel}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
                            {syncing && <ActivityIndicator size="small" color={colors.teal} />}
                        </TouchableOpacity>

                        <TouchableOpacity style={s.menuRow} onPress={() => { setMenuOpen(false); navigation.navigate('Khata'); }} activeOpacity={0.7}>
                            <Text style={s.menuIcon}>📒</Text>
                            <Text style={s.menuLabel}>Khata</Text>
                            {stats.khataDue > 0 && <Text style={s.menuMeta}>₹{stats.khataDue.toFixed(0)} due</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={s.menuRow} onPress={() => { setMenuOpen(false); navigation.navigate('Alerts'); }} activeOpacity={0.7}>
                            <Text style={s.menuIcon}>⚠️</Text>
                            <Text style={s.menuLabel}>Alerts</Text>
                            {(stats.lowStock + stats.expiry) > 0 && <Text style={s.menuMeta}>{stats.lowStock + stats.expiry}</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={s.menuRow} onPress={() => { setMenuOpen(false); navigation.navigate('Customers'); }} activeOpacity={0.7}>
                            <Text style={s.menuIcon}>👥</Text>
                            <Text style={s.menuLabel}>Customers</Text>
                        </TouchableOpacity>

                        <View style={s.menuDivider} />

                        <TouchableOpacity style={s.menuRow} onPress={confirmLogout} activeOpacity={0.7}>
                            <Text style={s.menuIcon}>🚪</Text>
                            <Text style={[s.menuLabel, { color: colors.red }]}>Log out</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0B0D13' }, // slightly darker bg for premium contrast
    scroll: { padding: spacing.lg, paddingBottom: 100 },

    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: spacing.xl,
        paddingTop: spacing.xl,
    },
    greeting: { color: colors.textSecondary, fontSize: font.sm, marginBottom: 4, letterSpacing: 0.5 },
    headerLeft: { flex: 1, marginRight: spacing.md },
    shopName: { color: colors.white, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    profileAvatar: {
        width: 44, height: 44, borderRadius: 22,
        flexShrink: 0,
        backgroundColor: colors.bgInput,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.borderLight,
    },
    profileInitial: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },
    onlineDot: {
        position: 'absolute', bottom: 0, right: 0,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: colors.teal,
        borderWidth: 2, borderColor: colors.bg,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },

    revenueCard: {
        backgroundColor: colors.bgCard,
        borderRadius: radius.xl,
        padding: spacing.xl,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: colors.teal,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 5,
    },
    revenueHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    revenueLabel: { color: colors.textSecondary, fontSize: font.xs, fontWeight: '700', letterSpacing: 1.5 },
    daySummaryLink: { color: colors.teal, fontSize: font.xs, fontWeight: '700' },
    revenueValue: { color: colors.white, fontSize: 44, fontWeight: '800', marginBottom: spacing.xl, letterSpacing: -1 },

    revenueStatsRow: { flexDirection: 'row', backgroundColor: colors.bgInput, borderRadius: radius.lg, padding: spacing.md },
    revStat: { flex: 1, paddingLeft: spacing.sm },
    revStatValue: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700', marginBottom: 2 },
    revStatLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '600' },
    revStatDivider: { width: 1, backgroundColor: colors.borderLight, marginHorizontal: spacing.sm },

    alertBanner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.amber + '10',
        borderWidth: 1, borderColor: colors.amber + '40',
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.xl,
    },
    alertIconWrapper: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.amber + '20',
        alignItems: 'center', justifyContent: 'center',
        marginRight: spacing.md,
    },
    alertIcon: { fontSize: 16 },
    alertTextContainer: { flex: 1 },
    alertTitle: { color: colors.amber, fontSize: font.sm, fontWeight: '700', marginBottom: 2 },
    alertText: { color: colors.amber, fontSize: font.xs, opacity: 0.9 },
    alertArrow: { color: colors.textMuted, fontSize: 24, fontWeight: '400', paddingHorizontal: spacing.xs },

    primaryActionCard: {
        backgroundColor: colors.teal,
        borderRadius: radius.xl,
        padding: spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
        shadowColor: colors.teal,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    primaryActionLeft: { flex: 1 },
    primaryActionTitle: { color: colors.bg, fontSize: 22, fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 },
    primaryActionSub: { color: colors.bg, fontSize: font.sm, opacity: 0.85, fontWeight: '600' },
    primaryActionIconBg: { backgroundColor: colors.white, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    primaryActionIcon: { fontSize: 26, marginLeft: -2 }, // adjust emoji centering

    secondaryActionsGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    secondaryActionCard: {
        flex: 1,
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
        alignItems: 'flex-start',
    },
    secIconWrapper: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
    secIcon: { fontSize: 22 },
    secTitle: { color: colors.textPrimary, fontSize: font.md, fontWeight: '700' },

    tertiaryActionCard: {
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg,
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginBottom: spacing.xxl,
    },
    tertiaryIcon: { fontSize: 22, marginRight: spacing.md },
    tertiaryTitle: { flex: 1, color: colors.textPrimary, fontSize: font.md, fontWeight: '600' },
    khataDueBadge: {
        backgroundColor: colors.amber + '20',
        borderWidth: 1, borderColor: colors.amber + '40',
        borderRadius: radius.full,
        paddingHorizontal: spacing.md, paddingVertical: 4,
    },
    khataDueText: { color: colors.amber, fontSize: font.xs, fontWeight: '700' },

    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    menuSheet: {
        backgroundColor: colors.bgCard,
        borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
        borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, paddingBottom: 40,
    },
    menuHeader: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingBottom: spacing.lg, marginBottom: spacing.sm,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    menuAvatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.bgInput,
        alignItems: 'center', justifyContent: 'center',
    },
    menuShopName: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },
    menuStatus: { color: colors.textMuted, fontSize: font.xs, marginTop: 2 },
    menuRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.md,
    },
    menuIcon: { fontSize: 18, width: 24, textAlign: 'center' },
    menuLabel: { flex: 1, color: colors.textPrimary, fontSize: font.md, fontWeight: '600' },
    menuMeta: { color: colors.amber, fontSize: font.sm, fontWeight: '700' },
    menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
