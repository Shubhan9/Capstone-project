import React, { useState, useCallback } from 'react';
import {
    View, Text, SectionList, TouchableOpacity,
    StyleSheet, RefreshControl, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Q } from '@nozbe/watermelondb';
import database from '../database';
import { getBusinessId } from '../sync/syncEngine';
import { Badge, EmptyState } from '../../components/UI';
import { colors, spacing, radius, font } from '../theme';

const DATE_FILTERS = ['today', 'week', 'month', 'all'];
const PAYMENT_FILTERS = ['all', 'cash', 'upi', 'credit'];

export default function OrderHistoryScreen({ navigation }) {
    const [orders, setOrders] = useState([]);
    const [selected, setSelected] = useState(null);
    const [items, setItems] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingItems, setLoadingItems] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('week');

    const load = useCallback(async (range) => {
        const bId = getBusinessId();
        const clauses = [
            Q.where('business_id', bId),
            Q.sortBy('sale_at', Q.desc),
        ];

        const startAt = getRangeStart(range);
        if (startAt !== null) {
            clauses.push(Q.where('sale_at', Q.gte(startAt)));
        }

        const rows = await database.get('sale_orders')
            .query(...clauses)
            .fetch();

        setOrders(rows);
    }, []);

    useFocusEffect(useCallback(() => {
        load(dateFilter);
    }, [dateFilter, load]));

    async function onRefresh() {
        setRefreshing(true);
        await load(dateFilter);
        setRefreshing(false);
    }

    async function openOrder(order) {
        setLoadingItems(true);
        setSelected(order);
        setItems([]);

        try {
            const orderItems = await database.get('sale_items')
                .query(Q.where('order_id', order.id))
                .fetch();

            const productIds = [...new Set(orderItems.map(item => item.productId).filter(Boolean))];
            const products = productIds.length === 0
                ? []
                : await database.get('products')
                    .query(Q.where('id', Q.oneOf(productIds)))
                    .fetch();

            const productMap = new Map(products.map(product => [product.id, product.name]));

            setItems(orderItems.map(item => ({
                id: item.id,
                productId: item.productId,
                batchId: item.batchId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                updatedAt: item.updatedAt,
                productName: productMap.get(item.productId) ?? 'Unknown product',
            })));
        } finally {
            setLoadingItems(false);
        }
    }

    function formatTime(ms) {
        return new Date(ms).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    }

    function formatDate(ms) {
        const d = new Date(ms);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = d.toDateString() === yesterday.toDateString();

        if (isToday) return 'Today';
        if (isYesterday) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    function paymentColor(mode) {
        if (mode === 'upi') return colors.blue;
        if (mode === 'credit') return colors.amber;
        return colors.teal;
    }

    const filteredOrders = orders.filter(order => (
        paymentFilter === 'all' || order.paymentMode === paymentFilter
    ));

    const grouped = filteredOrders.reduce((acc, order) => {
        const label = formatDate(order.saleAt);
        if (!acc[label]) acc[label] = [];
        acc[label].push(order);
        return acc;
    }, {});

    const sections = Object.entries(grouped).map(([title, data]) => ({
        title,
        data,
        total: data.reduce((sum, order) => sum + order.totalAmount, 0),
    }));

    const visibleRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const visibleCount = filteredOrders.length;

    return (
        <View style={s.root}>
            <SectionList
                sections={sections}
                keyExtractor={item => item.id}
                contentContainerStyle={s.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={7}
                ListHeaderComponent={(
                    <View>
                        <View style={s.header}>
                            <TouchableOpacity onPress={() => navigation.goBack()}>
                                <Text style={s.back}>Back</Text>
                            </TouchableOpacity>
                            <Text style={s.title}>Order History</Text>
                            <View style={{ width: 50 }} />
                        </View>

                        <View style={s.summaryCard}>
                            <View style={s.summaryLeft}>
                                <Text style={s.summaryLabel}>VISIBLE TOTAL</Text>
                                <Text style={s.summaryValue}>Rs.{visibleRevenue.toFixed(0)}</Text>
                            </View>
                            <View style={s.summaryRight}>
                                <Text style={s.summaryCount}>{visibleCount}</Text>
                                <Text style={s.summaryCountLabel}>orders</Text>
                            </View>
                        </View>

                        <Text style={s.filterLabel}>Date range</Text>
                        <View style={s.filterRow}>
                            {DATE_FILTERS.map(filter => (
                                <TouchableOpacity
                                    key={filter}
                                    style={[s.filterChip, dateFilter === filter && s.filterChipActive]}
                                    onPress={() => setDateFilter(filter)}
                                >
                                    <Text style={[s.filterText, dateFilter === filter && s.filterTextActive]}>
                                        {dateFilterLabel(filter)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={s.filterLabel}>Payment mode</Text>
                        <View style={[s.filterRow, s.filterRowBottom]}>
                            {PAYMENT_FILTERS.map(filter => (
                                <TouchableOpacity
                                    key={filter}
                                    style={[s.filterChip, paymentFilter === filter && s.filterChipActive]}
                                    onPress={() => setPaymentFilter(filter)}
                                >
                                    <Text style={[s.filterText, paymentFilter === filter && s.filterTextActive]}>
                                        {filter.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
                ListEmptyComponent={(
                    <EmptyState
                        icon="OK"
                        title="No orders found"
                        subtitle="Try a wider date range or complete a sale to see it here"
                    />
                )}
                renderSectionHeader={({ section }) => (
                    <View style={s.dateHeader}>
                        <Text style={s.dateLabel}>{section.title}</Text>
                        <Text style={s.dateSub}>
                            Rs.{section.total.toFixed(0)} . {section.data.length} orders
                        </Text>
                    </View>
                )}
                renderItem={({ item: order }) => (
                    <TouchableOpacity
                        style={s.orderRow}
                        onPress={() => openOrder(order)}
                        activeOpacity={0.75}
                    >
                        <View style={[s.paymentStripe, { backgroundColor: paymentColor(order.paymentMode) }]} />
                        <View style={s.orderMain}>
                            <View style={s.orderTop}>
                                <Text style={s.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                                <Text style={s.orderAmount}>Rs.{order.totalAmount.toFixed(2)}</Text>
                            </View>
                            <View style={s.orderBottom}>
                                <Text style={s.orderTime}>{formatTime(order.saleAt)}</Text>
                                <Badge
                                    label={order.paymentMode.toUpperCase()}
                                    color={paymentColor(order.paymentMode)}
                                />
                            </View>
                        </View>
                        <Text style={s.chevron}>{'>'}</Text>
                    </TouchableOpacity>
                )}
            />

            <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
                <View style={s.modalOverlay}>
                    <View style={s.modalBox}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>
                                Order #{selected?.id.slice(-6).toUpperCase()}
                            </Text>
                            <TouchableOpacity onPress={() => setSelected(null)}>
                                <Text style={s.modalClose}>X</Text>
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

                        {loadingItems ? (
                            <View style={s.loadingState}>
                                <ActivityIndicator color={colors.teal} />
                                <Text style={s.loadingText}>Loading order details...</Text>
                            </View>
                        ) : (
                            <ScrollView style={s.itemsList} showsVerticalScrollIndicator={false}>
                                {items.map(item => (
                                    <View key={item.id} style={s.itemRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.itemName}>{item.productName}</Text>
                                            <Text style={s.itemMeta}>Rs.{item.unitPrice} x {item.quantity}</Text>
                                        </View>
                                        <Text style={s.itemTotal}>
                                            Rs.{(item.unitPrice * item.quantity).toFixed(2)}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        <View style={s.modalTotal}>
                            <Text style={s.modalTotalLabel}>Total</Text>
                            <Text style={s.modalTotalValue}>Rs.{selected?.totalAmount.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function getRangeStart(filter) {
    const now = new Date();

    if (filter === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
    }

    if (filter === 'week') {
        const start = new Date(now);
        const day = start.getDay();
        const diff = day === 0 ? 6 : day - 1;
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
    }

    if (filter === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
    }

    return null;
}

function dateFilterLabel(filter) {
    if (filter === 'today') return 'Today';
    if (filter === 'week') return 'This Week';
    if (filter === 'month') return 'This Month';
    return 'All';
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

    filterLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', marginBottom: spacing.sm, letterSpacing: 0.6 },
    filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
    filterRowBottom: { marginBottom: spacing.lg },
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

    loadingState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
    loadingText: { color: colors.textMuted, fontSize: font.sm, marginTop: spacing.sm },

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
