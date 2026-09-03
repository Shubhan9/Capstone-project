import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AnalyticsAPI } from '../services/api';
import { Badge, EmptyState } from '../../components/UI';
import { AppIcon } from '../theme/icons';
import { colors, spacing, radius, font } from '../theme';

const URGENCY_COLORS = {
    critical: colors.red,
    high: colors.amber,
    medium: colors.blue,
    safe: colors.teal,
};

export default function ReorderScreen({ navigation }) {
    const [state, setState] = useState({ loading: true, items: [], summary: null, error: '' });
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await AnalyticsAPI.reorder(30);
            setState({ loading: false, items: data.items || [], summary: data.summary || null, error: '' });
        } catch (e) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: e.status
                    ? 'Could not load suggestions. Please try again.'
                    : 'You are offline. Reorder suggestions need a connection.',
            }));
        }
    }, []);

    useFocusEffect(useCallback(() => { setState(p => ({ ...p, loading: true })); load(); }, [load]));

    async function onRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

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
                    <Text style={s.title}>Smart Restock</Text>
                    <View style={{ width: 40 }} />
                </View>

                {state.summary && (
                    <View style={s.summaryCard}>
                        <View style={s.summaryItem}>
                            <Text style={[s.summaryNum, { color: colors.red }]}>{state.summary.critical_count ?? 0}</Text>
                            <Text style={s.summaryLabel}>critical</Text>
                        </View>
                        <View style={s.summaryDivider} />
                        <View style={s.summaryItem}>
                            <Text style={[s.summaryNum, { color: colors.amber }]}>{state.summary.high_count ?? 0}</Text>
                            <Text style={s.summaryLabel}>high</Text>
                        </View>
                        <View style={s.summaryDivider} />
                        <View style={s.summaryItem}>
                            <Text style={s.summaryNum}>₹{Math.round(state.summary.estimated_purchase_value ?? 0)}</Text>
                            <Text style={s.summaryLabel}>est. spend</Text>
                        </View>
                    </View>
                )}

                {state.loading ? (
                    <View style={s.loadingState}>
                        <ActivityIndicator color={colors.teal} />
                        <Text style={s.loadingText}>Analysing sales & stock…</Text>
                    </View>
                ) : state.error ? (
                    <EmptyState icon={<AppIcon name="offline" size={40} color={colors.textMuted} />} title="Can't load suggestions" subtitle={state.error} />
                ) : state.items.length === 0 ? (
                    <EmptyState icon={<AppIcon name="allClear" size={40} color={colors.teal} />} title="Nothing to reorder" subtitle="Stock cover looks healthy across your products." />
                ) : (
                    state.items.map(item => {
                        const color = URGENCY_COLORS[item.urgency] || colors.teal;
                        return (
                            <TouchableOpacity
                                key={item.product_id}
                                style={[s.itemCard, { borderLeftColor: color, borderLeftWidth: 3 }]}
                                activeOpacity={0.8}
                                onPress={() => navigation.navigate('StockIn', { productId: item.product_id })}
                            >
                                <View style={s.itemTop}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.itemName}>{item.name}</Text>
                                        <Text style={s.itemSub}>
                                            {item.category} · {item.current_stock} {item.unit} left
                                            {item.days_of_cover != null ? ` · ~${item.days_of_cover}d cover` : ''}
                                        </Text>
                                    </View>
                                    <Badge label={item.urgency} color={color} />
                                </View>

                                <View style={s.qtyRow}>
                                    <Text style={s.qtyLabel}>Suggested order</Text>
                                    <Text style={s.qtyValue}>{item.suggested_reorder_qty} {item.unit}</Text>
                                </View>

                                {Array.isArray(item.reasons) && item.reasons.length > 0 && (
                                    <Text style={s.reason}>{item.reasons[0]}</Text>
                                )}

                                <Text style={s.action}>Tap to record stock-in ›</Text>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: 100 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl, marginBottom: spacing.xl,
    },
    back: { color: colors.teal, fontSize: font.md, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },

    summaryCard: {
        flexDirection: 'row',
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.lg,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryNum: { color: colors.textPrimary, fontSize: font.xl, fontWeight: '800', marginBottom: 2 },
    summaryLabel: { color: colors.textMuted, fontSize: font.xs },
    summaryDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },

    loadingState: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
    loadingText: { color: colors.textMuted, fontSize: font.sm },

    itemCard: {
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.sm,
    },
    itemTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
    itemName: { color: colors.textPrimary, fontSize: font.md, fontWeight: '700', marginBottom: 2 },
    itemSub: { color: colors.textMuted, fontSize: font.xs },

    qtyRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.bgInput, borderRadius: radius.md,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    qtyLabel: { color: colors.textSecondary, fontSize: font.sm },
    qtyValue: { color: colors.teal, fontSize: font.md, fontWeight: '800' },

    reason: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.sm },
    action: { color: colors.teal, fontSize: font.xs, fontWeight: '600', marginTop: spacing.sm },
});
