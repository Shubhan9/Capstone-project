import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity,
} from 'react-native';
import { getSuppliers, getAllProducts, createPurchaseOrder } from '../database/actions';
import { openWhatsApp } from '../services/share';
import { getSession } from '../services/session';
import { PrimaryButton, GhostButton } from '../../components/UI';
import { colors, spacing, radius, font } from '../theme';

// Build an order for a supplier and send it on WhatsApp. Opened empty, for a
// supplier, or pre-filled from Smart Restock's suggested quantities.
// route.params: { supplierId?, items?: [{ product_id, name, quantity, unit }] }
export default function PurchaseOrderScreen({ navigation, route }) {
    const [suppliers, setSuppliers] = useState([]);
    const [supplierId, setSupplierId] = useState(route?.params?.supplierId || null);
    const [items, setItems] = useState(route?.params?.items || []);
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getSuppliers().then(setSuppliers);
        getAllProducts().then(setProducts);
    }, []);

    const matches = search.trim()
        ? products
            .filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
            .filter(p => !items.some(i => i.product_id === p.id))
            .slice(0, 6)
        : [];

    function addProduct(p) {
        setItems(list => [...list, { product_id: p.id, name: p.name, unit: p.unit, quantity: 1 }]);
        setSearch('');
    }

    function setQty(index, text) {
        const quantity = parseInt(text.replace(/\D/g, ''), 10) || 0;
        setItems(list => list.map((it, i) => (i === index ? { ...it, quantity } : it)));
    }

    function removeItem(index) {
        setItems(list => list.filter((_, i) => i !== index));
    }

    function orderText(supplier) {
        const shop = getSession().business?.name || 'our shop';
        return [
            `Namaste ${supplier?.name || ''},`,
            ``,
            `New order from *${shop}*:`,
            ...items.map((it, i) => `${i + 1}. ${it.name} — ${it.quantity}${it.unit ? ' ' + it.unit : ''}`),
            note.trim() ? `\nNote: ${note.trim()}` : null,
            ``,
            `Please confirm. Thank you!`,
        ].filter(v => v !== null).join('\n');
    }

    async function submit(send) {
        const valid = items.filter(i => i.quantity > 0);
        if (valid.length === 0) return Alert.alert('Add at least one item with a quantity');
        const supplier = suppliers.find(sp => sp.id === supplierId);
        if (send && !supplier) return Alert.alert('Pick a supplier to send the order to');

        setSaving(true);
        try {
            await createPurchaseOrder({
                supplierId,
                items: valid.map(({ product_id, name, quantity }) => ({ product_id, name, quantity })),
                note: note.trim(),
                status: send ? 'sent' : 'draft',
            });
            if (send) await openWhatsApp(supplier.phone, orderText(supplier));
            navigation.goBack();
        } finally {
            setSaving(false);
        }
    }

    return (
        <ScrollView style={s.root} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={s.back}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={s.title}>Purchase order</Text>
                <View style={{ width: 40 }} />
            </View>

            <Text style={s.section}>SUPPLIER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {suppliers.map(sp => (
                    <TouchableOpacity key={sp.id} style={[s.chip, supplierId === sp.id && s.chipActive]}
                        onPress={() => setSupplierId(sp.id)}>
                        <Text style={[s.chipText, supplierId === sp.id && { color: colors.teal }]}>{sp.name}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.chip} onPress={() => navigation.navigate('Suppliers', { addNew: true })}>
                    <Text style={s.chipText}>+ New supplier</Text>
                </TouchableOpacity>
            </ScrollView>

            <Text style={s.section}>ITEMS</Text>
            {items.map((it, i) => (
                <View key={it.product_id} style={s.itemRow}>
                    <Text style={s.itemName} numberOfLines={1}>{it.name}</Text>
                    <TextInput style={s.qty} keyboardType="number-pad" value={String(it.quantity)}
                        onChangeText={t => setQty(i, t)} />
                    <Text style={s.unit}>{it.unit}</Text>
                    <TouchableOpacity onPress={() => removeItem(i)}>
                        <Text style={s.remove}>✕</Text>
                    </TouchableOpacity>
                </View>
            ))}
            <TextInput style={s.input} placeholder="Add product…" placeholderTextColor={colors.textMuted}
                value={search} onChangeText={setSearch} />
            {matches.map(p => (
                <TouchableOpacity key={p.id} style={s.match} onPress={() => addProduct(p)}>
                    <Text style={s.matchText}>+ {p.name}</Text>
                </TouchableOpacity>
            ))}

            <Text style={s.section}>NOTE</Text>
            <TextInput style={s.input} placeholder="Delivery by Friday, etc. (optional)" placeholderTextColor={colors.textMuted}
                value={note} onChangeText={setNote} />

            <PrimaryButton label="Send on WhatsApp" onPress={() => submit(true)} loading={saving} style={{ marginTop: spacing.xl }} />
            <GhostButton label="Save as draft" onPress={() => submit(false)} style={{ marginTop: spacing.sm }} />
        </ScrollView>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: 80 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl, marginBottom: spacing.md,
    },
    back: { color: colors.teal, fontSize: font.md, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },
    section: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
    chip: {
        borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
        paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.bgInput,
    },
    chipActive: { borderColor: colors.teal, backgroundColor: colors.teal + '22' },
    chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '600' },
    itemRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    },
    itemName: { flex: 1, color: colors.textPrimary, fontSize: font.md, fontWeight: '600' },
    qty: {
        width: 64, textAlign: 'center', backgroundColor: colors.bgInput, borderRadius: radius.sm,
        color: colors.textPrimary, fontSize: font.md, paddingVertical: 6,
    },
    unit: { color: colors.textMuted, fontSize: font.sm, width: 36 },
    remove: { color: colors.red, fontSize: font.md, fontWeight: '700', paddingHorizontal: 4 },
    input: {
        backgroundColor: colors.bgInput, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        color: colors.textPrimary, fontSize: font.md, paddingHorizontal: spacing.md, paddingVertical: 13,
    },
    match: { paddingVertical: 10, paddingHorizontal: spacing.md },
    matchText: { color: colors.teal, fontSize: font.md, fontWeight: '600' },
});
