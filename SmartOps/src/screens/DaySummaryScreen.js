import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDaySummary } from '../database/actions';
import { colors, spacing, radius, font } from '../theme';

export default function DaySummaryScreen({ navigation }) {
    const [summary, setSummary] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        setSummary(await getDaySummary());
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const s0 = summary || { orderCount: 0, revenue: 0, byMode: { cash: 0, upi: 0, credit: 0 }, itemsSold: 0, wastageUnits: 0, creditGiven: 0, repaid: 0 };
    const avgTicket = s0.orderCount > 0 ? s0.revenue / s0.orderCount : 0;

    return (
        <View style={s.root}>
            <ScrollView
                contentContainerStyle={s.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={s.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={s.back}>‹ Back</Text>
                    </TouchableOpacity>
                    <Text style={s.title}>Day Summary</Text>
                    <View style={{ width: 40 }} />
                </View>

                <Text style={s.dateLabel}>{today}</Text>

                {/* Revenue headline */}
                <View style={s.revenueCard}>
                    <Text style={s.revenueLabel}>TOTAL COLLECTED</Text>
                    <Text style={s.revenueValue}>₹{s0.revenue.toFixed(0)}</Text>
                    <Text style={s.revenueSub}>{s0.orderCount} orders · {s0.itemsSold} items · avg ₹{avgTicket.toFixed(0)}/order</Text>
                </View>

                {/* Payment breakdown */}
                <Text style={s.sectionLabel}>PAYMENTS</Text>
                <View style={s.card}>
                    <PayRow label="Cash" value={s0.byMode.cash} color={colors.teal} total={s0.revenue} />
                    <PayRow label="UPI" value={s0.byMode.upi} color={colors.blue} total={s0.revenue} />
                    <PayRow label="Credit (khata)" value={s0.byMode.credit} color={colors.amber} total={s0.revenue} />
                </View>

                {/* Khata movement */}
                <Text style={s.sectionLabel}>KHATA TODAY</Text>
                <View style={s.card}>
                    <View style={s.statRow}>
                        <Text style={s.statLabel}>Credit given</Text>
                        <Text style={[s.statValue, { color: colors.amber }]}>₹{s0.creditGiven.toFixed(0)}</Text>
                    </View>
                    <View style={s.statRow}>
                        <Text style={s.statLabel}>Repayments received</Text>
                        <Text style={[s.statValue, { color: colors.teal }]}>₹{s0.repaid.toFixed(0)}</Text>
                    </View>
                </View>

                {/* Losses */}
                <Text style={s.sectionLabel}>STOCK</Text>
                <View style={s.card}>
                    <View style={s.statRow}>
                        <Text style={s.statLabel}>Units written off (wastage)</Text>
                        <Text style={[s.statValue, { color: s0.wastageUnits > 0 ? colors.red : colors.textPrimary }]}>
                            {s0.wastageUnits}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={s.historyBtn} onPress={() => navigation.navigate('OrderHistory')} activeOpacity={0.8}>
                    <Text style={s.historyBtnText}>View today&apos;s orders ›</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

function PayRow({ label, value, color, total }) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <View style={s.payRow}>
            <View style={s.payTop}>
                <View style={s.payLabelWrap}>
                    <View style={[s.payDot, { backgroundColor: color }]} />
                    <Text style={s.payLabel}>{label}</Text>
                </View>
                <Text style={s.payValue}>₹{value.toFixed(0)}</Text>
            </View>
            <View style={s.payBarTrack}>
                <View style={[s.payBarFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: 100 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl, marginBottom: spacing.xs,
    },
    back: { color: colors.teal, fontSize: font.md, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },
    dateLabel: { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.lg, textAlign: 'center' },

    revenueCard: {
        backgroundColor: colors.bgCard,
        borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight,
        padding: spacing.xl, marginBottom: spacing.xl,
    },
    revenueLabel: { color: colors.textSecondary, fontSize: font.xs, fontWeight: '700', letterSpacing: 1.5, marginBottom: spacing.xs },
    revenueValue: { color: colors.white, fontSize: 44, fontWeight: '800', letterSpacing: -1 },
    revenueSub: { color: colors.textMuted, fontSize: font.sm, marginTop: 6 },

    sectionLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
    card: {
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.md,
    },

    payRow: { marginBottom: spacing.md },
    payTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    payLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    payDot: { width: 8, height: 8, borderRadius: 4 },
    payLabel: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '600' },
    payValue: { color: colors.textPrimary, fontSize: font.md, fontWeight: '700' },
    payBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bgInput, overflow: 'hidden' },
    payBarFill: { height: 6, borderRadius: 3 },

    statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
    statLabel: { color: colors.textSecondary, fontSize: font.sm },
    statValue: { fontSize: font.md, fontWeight: '700' },

    historyBtn: {
        marginTop: spacing.lg,
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, alignItems: 'center',
    },
    historyBtnText: { color: colors.teal, fontSize: font.md, fontWeight: '700' },
});
