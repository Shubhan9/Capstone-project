import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTodaySales, getRecentOrders } from '../database/actions';
import { useAppBadges } from '../hooks/useAppBadges';
import { AppIcon } from '../theme/icons';
import { colors, spacing, radius, font } from '../theme';

// A glance screen only: greeting, today's number, one consolidated alert row,
// recent activity. Everything else now lives in a tab or a sub-screen of one —
// see the Inventory/Khata/Records tabs and their header actions.
export default function HomeScreen({ navigation, name }) {
    const { stockAlertCount, khataDueTotal } = useAppBadges();
    const [todaySales, setTodaySales] = useState({ count: 0, total: 0 });
    const [recentOrders, setRecentOrders] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    async function load() {
        const [sales, recent] = await Promise.all([
            getTodaySales(),
            getRecentOrders(4),
        ]);
        setTodaySales(sales);
        setRecentOrders(recent);
    }

    useFocusEffect(useCallback(() => { load(); }, []));

    async function onRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    function paymentColor(mode) {
        if (mode === 'upi') return colors.blue;
        if (mode === 'credit') return colors.amber;
        return colors.teal;
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
                    </View>
                    <TouchableOpacity
                        style={s.profileBtn}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <Text style={s.profileInitial}>{name.charAt(0).toUpperCase()}</Text>
                    </TouchableOpacity>
                </View>

                {/* Today's number */}
                <View style={s.revenueCard}>
                    <View style={s.revenueHeaderRow}>
                        <Text style={s.revenueLabel}>TODAY&apos;S REVENUE</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('DaySummary')} activeOpacity={0.7}>
                            <Text style={s.daySummaryLink}>Day summary ›</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={s.revenueValue}>₹{todaySales.total.toFixed(0)}</Text>
                    <Text style={s.revenueSub}>{todaySales.count} orders today</Text>
                </View>

                {/* One consolidated alert row — each number lives on the tab it
                    belongs to; this is a link into that tab, not a restated count. */}
                {(stockAlertCount > 0 || khataDueTotal > 0) && (
                    <View style={s.alertRow}>
                        {stockAlertCount > 0 && (
                            <TouchableOpacity
                                style={s.alertChip}
                                onPress={() => navigation.navigate('Inventory')}
                                activeOpacity={0.8}
                            >
                                <AppIcon name="alerts" size="chip" color={colors.amber} />
                                <Text style={s.alertChipText}>{stockAlertCount} stock alert{stockAlertCount === 1 ? '' : 's'}</Text>
                                <AppIcon name="chevron" size="inline" color={colors.amber} />
                            </TouchableOpacity>
                        )}
                        {khataDueTotal > 0 && (
                            <TouchableOpacity
                                style={s.alertChip}
                                onPress={() => navigation.navigate('Khata')}
                                activeOpacity={0.8}
                            >
                                <AppIcon name="khata" size="chip" color={colors.amber} />
                                <Text style={s.alertChipText}>₹{khataDueTotal.toFixed(0)} due</Text>
                                <AppIcon name="chevron" size="inline" color={colors.amber} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Recent activity */}
                <View style={s.sectionHeaderRow}>
                    <Text style={s.sectionTitle}>RECENT ACTIVITY</Text>
                    {recentOrders.length > 0 && (
                        <TouchableOpacity onPress={() => navigation.navigate('OrderHistory')}>
                            <Text style={s.sectionAction}>View all ›</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {recentOrders.length === 0 ? (
                    <View style={s.emptyActivity}>
                        <AppIcon name="allClear" size={28} color={colors.textMuted} />
                        <Text style={s.emptyActivityText}>No orders yet — tap + to make your first sale</Text>
                    </View>
                ) : (
                    recentOrders.map(order => (
                        <TouchableOpacity
                            key={order.id}
                            style={s.activityRow}
                            onPress={() => navigation.navigate('OrderHistory')}
                            activeOpacity={0.75}
                        >
                            <View style={[s.activityStripe, { backgroundColor: paymentColor(order.paymentMode) }]} />
                            <View style={s.activityMain}>
                                <Text style={s.activityId}>#{order.id.slice(-6).toUpperCase()}</Text>
                                <Text style={s.activityTime}>{formatTime(order.saleAt)}</Text>
                            </View>
                            <Text style={s.activityAmount}>₹{order.totalAmount.toFixed(0)}</Text>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

function formatTime(ms) {
    return new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: 40 },

    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: spacing.xl,
        paddingTop: spacing.xl,
    },
    greeting: { color: colors.textSecondary, fontSize: font.sm, marginBottom: 4, letterSpacing: 0.5 },
    headerLeft: { flex: 1, marginRight: spacing.md },
    shopName: { color: colors.white, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    profileBtn: {
        width: 44, height: 44, borderRadius: 22,
        flexShrink: 0,
        backgroundColor: colors.bgInput,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.borderLight,
    },
    profileInitial: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },

    revenueCard: {
        backgroundColor: colors.bgCard,
        borderRadius: radius.xl,
        padding: spacing.xl,
        marginBottom: spacing.lg,
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
    revenueValue: { color: colors.white, fontSize: 44, fontWeight: '800', letterSpacing: -1 },
    revenueSub: { color: colors.textMuted, fontSize: font.sm, marginTop: spacing.xs },

    alertRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    alertChip: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: colors.amber + '10',
        borderWidth: 1, borderColor: colors.amber + '40',
        borderRadius: radius.lg,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    },
    alertChipText: { flex: 1, color: colors.amber, fontSize: font.xs, fontWeight: '700' },

    sectionHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.md, marginTop: spacing.sm,
    },
    sectionTitle: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '600', letterSpacing: 0.8 },
    sectionAction: { color: colors.teal, fontSize: font.sm, fontWeight: '600' },

    emptyActivity: {
        alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.xxl,
    },
    emptyActivityText: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center' },

    activityRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        marginBottom: spacing.sm, overflow: 'hidden',
    },
    activityStripe: { width: 4, alignSelf: 'stretch' },
    activityMain: { flex: 1, padding: spacing.md },
    activityId: { color: colors.textPrimary, fontSize: font.sm, fontWeight: '700', marginBottom: 2 },
    activityTime: { color: colors.textMuted, fontSize: font.xs },
    activityAmount: { color: colors.textPrimary, fontSize: font.md, fontWeight: '700', paddingRight: spacing.md },
});
