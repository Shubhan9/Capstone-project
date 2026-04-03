import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, RefreshControl, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Q } from '@nozbe/watermelondb';
import database from '../database';
import { getBusinessId } from '../sync/syncEngine';
import { Badge, EmptyState } from '../../components/UI';
import { colors, spacing, radius, font } from '../theme';

export default function OrderHistoryScreen({ navigation }) {
    const [orders, setOrders] = useState([]);
    const [selected, setSelected] = useState(null);  // order detail modal
    const [items, setItems] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all'|'cash'|'upi'|'credit'

    async function load() {
        const bId = getBusinessId();
        const rows = await database.get('sale_orders')
            .query(
                Q.where('business_id', bId),
                Q.sortBy('sale_at', Q.desc),
            )
            .fetch();
        setOrders(rows);
    }

    useFocusEffect(useCallback(() => { load(); }, []));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    async function openOrder(order) {
        const orderItems = await database.get('sale_items')
            .query(Q.where('order_id', order.id))
            .fetch();

        // Enrich with product names
        const enriched = await Promise.all(orderItems.map(async si => {
            const product = await database.get('products').find(si.productId).catch(() => null);
            return {
                id: si.id,
                productId: si.productId,
                batchId: si.batchId,
                quantity: si.quantity,
                unitPrice: si.unitPrice,        // ← explicit, not spread
                updatedAt: si.updatedAt,
                productName: product?.name ?? 'Unknown product',
            };
        }));

        setItems(enriched);
        setSelected(order);
    }

    function formatTime(ms) {
        const d = new Date(ms);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    function formatDate(ms) {
        const d = new Date(ms);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const isYesterday = d.toDateString() === new Date(now - 86400000).toDateString();
        if (isToday) return 'Today';
        if (isYesterday) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    function paymentColor(mode) {
        if (mode === 'upi') return colors.blue;
        if (mode === 'credit') return colors.amber;
        return colors.teal;
    }

    // Group by date label
    const filtered = orders.filter(o => filter === 'all' || o.paymentMode === filter);

    const grouped = filtered.reduce((acc, o) => {
        const label = formatDate(o.saleAt);
        if (!acc[label]) acc[label] = [];
        acc[label].push(o);
        return acc;
    }, {});

    const todayRevenue = orders
        .filter(o => formatDate(o.saleAt) === 'Today')
        .reduce((s, o) => s + o.totalAmount, 0);

    return (
        <View style={s.root}>
            <ScrollView
                contentContainerStyle={s.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={s.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={s.back}>‹ Back</Text>
                    </TouchableOpacity>
                    <Text style={s.title}>Order History</Text>
                    <View style={{ width: 50 }} />
                </View>

                {/* Today summary */}
                <View style={s.summaryCard}>
                    <View style={s.summaryLeft}>
                        <Text style={s.summaryLabel}>TODAY'S TOTAL</Text>
                        <Text style={s.summaryValue}>
                            ₹{todayRevenue.toFixed(0)}
                        </Text>
                    </View>
                    <View style={s.summaryRight}>
                        <Text style={s.summaryCount}>
                            {orders.filter(o => formatDate(o.saleAt) === 'Today').length}
                        </Text>
                        <Text style={s.summaryCountLabel}>orders</Text>
                    </View>
                </View>

                {/* Filter by payment */}
                <View style={s.filterRow}>
                    {['all', 'cash', 'upi', 'credit'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[s.filterChip, filter === f && s.filterChipActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
                                {f.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Grouped orders */}
                {Object.keys(grouped).length === 0
                    ? <EmptyState icon="🧾" title="No orders yet" subtitle="Complete a sale to see it here" />
                    : Object.entries(grouped).map(([dateLabel, dayOrders]) => (
                        <View key={dateLabel}>
                            <View style={s.dateHeader}>
                                <Text style={s.dateLabel}>{dateLabel}</Text>
                                <Text style={s.dateSub}>
                                    ₹{dayOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(0)} · {dayOrders.length} orders
                                </Text>
                            </View>
                            {dayOrders.map(order => (
                                <TouchableOpacity
                                    key={order.id}
                                    style={s.orderRow}
                                    onPress={() => openOrder(order)}
                                    activeOpacity={0.75}
                                >
                                    <View style={[s.paymentStripe, { backgroundColor: paymentColor(order.paymentMode) }]} />
                                    <View style={s.orderMain}>
                                        <View style={s.orderTop}>
                                            <Text style={s.orderId}>
                                                #{order.id.slice(-6).toUpperCase()}
                                            </Text>
                                            <Text style={s.orderAmount}>₹{order.totalAmount.toFixed(2)}</Text>
                                        </View>
                                        <View style={s.orderBottom}>
                                            <Text style={s.orderTime}>{formatTime(order.saleAt)}</Text>
                                            <Badge
                                                label={order.paymentMode.toUpperCase()}
                                                color={paymentColor(order.paymentMode)}
                                            />
                                        </View>
                                    </View>
                                    <Text style={s.chevron}>›</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))
                }
            </ScrollView>

            {/* Order detail modal */}
            <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
                <View style={s.modalOverlay}>
                    <View style={s.modalBox}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>
                                Order #{selected?.id.slice(-6).toUpperCase()}
                            </Text>
                            <TouchableOpacity onPress={() => setSelected(null)}>
                                <Text style={s.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.modalMeta}>
                            <Text style={s.modalMetaText}>
                                {selected && new Date(selected.saleAt).toLocaleString('en-IN')}
                            </Text>
                            <Badge
                                label={selected?.paymentMode?.toUpperCase()}
                                color={paymentColor(selected?.paymentMode)}
                            />
                        </View>

                        <ScrollView style={s.itemsList} showsVerticalScrollIndicator={false}>
                            {items.map((item, i) => (
                                <View key={i} style={s.itemRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.itemName}>{item.productName}</Text>
                                        <Text style={s.itemMeta}>₹{item.unitPrice} × {item.quantity}</Text>
                                    </View>
                                    <Text style={s.itemTotal}>
                                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={s.modalTotal}>
                            <Text style={s.modalTotalLabel}>Total</Text>
                            <Text style={s.modalTotalValue}>₹{selected?.totalAmount.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: 80 },

    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.xl, marginBottom: spacing.xl,
    },
    back: { color: colors.teal, fontSize: font.md, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },

    summaryCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.xl, marginBottom: spacing.lg,
    },
    summaryLeft: {},
    summaryLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
    summaryValue: { color: colors.textPrimary, fontSize: 36, fontWeight: '800' },
    summaryRight: { alignItems: 'center' },
    summaryCount: { color: colors.teal, fontSize: 32, fontWeight: '800' },
    summaryCountLabel: { color: colors.textMuted, fontSize: font.xs },

    filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: radius.full, borderWidth: 1,
        borderColor: colors.border, backgroundColor: colors.bgInput,
    },
    filterChipActive: { borderColor: colors.teal, backgroundColor: colors.teal + '20' },
    filterText: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700' },
    filterTextActive: { color: colors.teal },

    dateHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.md,
    },
    dateLabel: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '700' },
    dateSub: { color: colors.textMuted, fontSize: font.xs },

    orderRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        marginBottom: spacing.sm, overflow: 'hidden',
    },
    paymentStripe: { width: 4, alignSelf: 'stretch' },
    orderMain: { flex: 1, padding: spacing.md },
    orderTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    orderId: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '700' },
    orderAmount: { color: colors.textPrimary, fontSize: font.md, fontWeight: '700' },
    orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderTime: { color: colors.textMuted, fontSize: font.xs },
    chevron: { color: colors.textMuted, fontSize: 22, paddingHorizontal: spacing.sm },

    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: colors.bgCard,
        borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
        borderWidth: 1, borderColor: colors.border,
        padding: spacing.xl, paddingBottom: 40,
        maxHeight: '75%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: spacing.md,
    },
    modalTitle: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },
    modalClose: { color: colors.textMuted, fontSize: font.lg, padding: 4 },
    modalMeta: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: spacing.lg,
    },
    modalMetaText: { color: colors.textMuted, fontSize: font.sm },

    itemsList: { maxHeight: 300 },
    itemRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    itemName: { color: colors.textPrimary, fontSize: font.sm, fontWeight: '600', marginBottom: 2 },
    itemMeta: { color: colors.textMuted, fontSize: font.xs },
    itemTotal: { color: colors.teal, fontSize: font.md, fontWeight: '700' },

    modalTotal: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingTop: spacing.lg,
    },
    modalTotalLabel: { color: colors.textSecondary, fontSize: font.lg },
    modalTotalValue: { color: colors.textPrimary, fontSize: font.xxl, fontWeight: '800' },
});