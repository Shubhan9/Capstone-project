import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, RefreshControl, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllProducts } from '../database/actions';
import { Badge, EmptyState } from '../../components/UI';
import { colors, spacing, radius, font } from '../theme';

export default function InventoryScreen({ navigation }) {
    const [products, setProducts] = useState([]);
    const [stocks, setStocks] = useState({});  // { productId: number }
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // 'all' | 'low' | 'out'
    const [refreshing, setRefreshing] = useState(false);

    async function load() {
        const prods = await getAllProducts();
        const stockMap = {};
        for (const p of prods) {
            stockMap[p.id] = await p.currentStock();
        }
        setProducts(prods);
        setStocks(stockMap);
    }

    useFocusEffect(useCallback(() => { load(); }, []));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    const filtered = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.brand || '').toLowerCase().includes(search.toLowerCase());
        const stock = stocks[p.id] ?? 0;
        const matchFilter =
            filter === 'all' ? true :
                filter === 'out' ? stock === 0 :
                    filter === 'low' ? stock > 0 && stock <= p.reorderLevel :
                        true;
        return matchSearch && matchFilter;
    });

    const outCount = products.filter(p => (stocks[p.id] ?? 0) === 0).length;
    const lowCount = products.filter(p => {
        const s = stocks[p.id] ?? 0;
        return s > 0 && s <= p.reorderLevel;
    }).length;

    function stockBadge(stock, reorder) {
        if (stock === 0) return { label: 'OUT', color: colors.red };
        if (stock <= reorder) return { label: `${stock} left`, color: colors.amber };
        return { label: `${stock} left`, color: colors.teal };
    }

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
                    <Text style={s.title}>Inventory</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('ProductRegistration')}>
                        <Text style={s.addBtn}>+ Add</Text>
                    </TouchableOpacity>
                </View>

                {/* Summary strip */}
                <View style={s.stripRow}>
                    <View style={s.strip}>
                        <Text style={s.stripVal}>{products.length}</Text>
                        <Text style={s.stripLabel}>Products</Text>
                    </View>
                    <View style={s.stripDivider} />
                    <View style={s.strip}>
                        <Text style={[s.stripVal, lowCount > 0 && { color: colors.amber }]}>{lowCount}</Text>
                        <Text style={s.stripLabel}>Low stock</Text>
                    </View>
                    <View style={s.stripDivider} />
                    <View style={s.strip}>
                        <Text style={[s.stripVal, outCount > 0 && { color: colors.red }]}>{outCount}</Text>
                        <Text style={s.stripLabel}>Out of stock</Text>
                    </View>
                </View>

                {/* Search */}
                <TextInput
                    style={s.search}
                    placeholder="Search products or brands..."
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                />

                {/* Filter chips */}
                <View style={s.filterRow}>
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'low', label: `Low (${lowCount})` },
                        { key: 'out', label: `Out (${outCount})` },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[s.filterChip, filter === f.key && s.filterChipActive]}
                            onPress={() => setFilter(f.key)}
                        >
                            <Text style={[s.filterChipText, filter === f.key && s.filterChipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Product list */}
                {filtered.length === 0
                    ? <EmptyState icon="📦" title="No products found" subtitle="Add products via the + button above" />
                    : filtered.map(p => {
                        const stock = stocks[p.id] ?? 0;
                        const badge = stockBadge(stock, p.reorderLevel);
                        return (
                            <TouchableOpacity
                                key={p.id}
                                style={s.productRow}
                                activeOpacity={0.75}
                                onPress={() => navigation.navigate('StockIn')}
                            >
                                <View style={s.productLeft}>
                                    <View style={[s.categoryDot, { backgroundColor: categoryColor(p.category) }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
                                        <Text style={s.productMeta}>
                                            {p.brand ? `${p.brand} · ` : ''}{p.category} · ₹{p.sellingPrice ?? 0}/{p.unit}
                                        </Text>
                                    </View>
                                </View>
                                <View style={s.productRight}>
                                    <Badge label={badge.label} color={badge.color} />
                                    {stock <= p.reorderLevel && (
                                        <Text style={s.reorderHint}>reorder: {p.reorderLevel}</Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })
                }
            </ScrollView>

            {/* FAB — quick stock in */}
            <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('StockIn')} activeOpacity={0.85}>
                <Text style={s.fabText}>+ Stock In</Text>
            </TouchableOpacity>
        </View>
    );
}

function categoryColor(cat) {
    const map = {
        Grocery: '#1DB97A', Beverage: '#4A90E2', Snack: '#F0A500',
        Dairy: '#9B59B6', Medicine: '#E84545', 'Personal Care': '#E91E8C',
        Household: '#888780', Other: '#50556E',
    };
    return map[cat] || '#50556E';
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: 100 },

    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.xl, marginBottom: spacing.xl,
    },
    back: { color: colors.teal, fontSize: font.md, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },
    addBtn: { color: colors.teal, fontSize: font.md, fontWeight: '700' },

    stripRow: {
        flexDirection: 'row',
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.lg,
    },
    strip: { flex: 1, alignItems: 'center' },
    stripVal: { color: colors.textPrimary, fontSize: font.xl, fontWeight: '700', marginBottom: 2 },
    stripLabel: { color: colors.textMuted, fontSize: font.xs },
    stripDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },

    search: {
        backgroundColor: colors.bgInput,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        color: colors.textPrimary, fontSize: font.md,
        paddingHorizontal: spacing.md, paddingVertical: 12,
        marginBottom: spacing.md,
    },

    filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: radius.full, borderWidth: 1,
        borderColor: colors.border, backgroundColor: colors.bgInput,
    },
    filterChipActive: { borderColor: colors.teal, backgroundColor: colors.teal + '20' },
    filterChipText: { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },
    filterChipTextActive: { color: colors.teal },

    productRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    productLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
    categoryDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    productName: { color: colors.textPrimary, fontSize: font.md, fontWeight: '600', marginBottom: 2 },
    productMeta: { color: colors.textMuted, fontSize: font.xs },
    productRight: { alignItems: 'flex-end', gap: 4 },
    reorderHint: { color: colors.textMuted, fontSize: font.xs },

    fab: {
        position: 'absolute', bottom: 28, right: 20,
        backgroundColor: colors.teal,
        borderRadius: radius.full,
        paddingHorizontal: spacing.xl, paddingVertical: 14,
    },
    fabText: { color: colors.bg, fontSize: font.md, fontWeight: '700' },
});