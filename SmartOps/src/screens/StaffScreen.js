import React, { useState, useCallback } from 'react';
import {
    View, Text, TextInput, StyleSheet, ScrollView, Alert,
    TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BusinessAPI } from '../services/api';
import { PrimaryButton, EmptyState, Card } from '../../components/UI';
import { AppIcon } from '../theme/icons';
import { colors, spacing, radius, font } from '../theme';

// Owner-only: give helpers their own login on their own phone. Staff can
// sell, stock-in and record khata, but can't change prices, shop details or
// staff. Every device syncs into the same shop. Needs internet.
export default function StaffScreen({ navigation }) {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ name: '', phone: '', password: '' });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const load = useCallback(async () => {
        try {
            const res = await BusinessAPI.listStaff();
            setStaff(res.staff || []);
            setError('');
        } catch (e) {
            setError(e.status ? e.message : 'You are offline. Staff management needs a connection.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function add() {
        const { name, phone, password } = form;
        if (!name.trim() || !phone.trim()) return Alert.alert('Enter name and phone number');
        if (password.length < 6) return Alert.alert('Password must be at least 6 characters');
        setSaving(true);
        try {
            await BusinessAPI.addStaff(name.trim(), phone.trim(), password);
            Alert.alert('Staff added', `${name.trim()} can now sign in with ${phone.trim()} and this password on their own phone.`);
            setForm({ name: '', phone: '', password: '' });
            load();
        } catch (e) {
            Alert.alert('Could not add', e.data?.errors?.[0]?.msg || e.message);
        } finally {
            setSaving(false);
        }
    }

    function remove(member) {
        Alert.alert('Remove staff', `${member.name} will be signed out and can't log in again.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    try {
                        await BusinessAPI.removeStaff(member.id);
                        load();
                    } catch (e) {
                        Alert.alert('Could not remove', e.message);
                    }
                },
            },
        ]);
    }

    return (
        <ScrollView style={s.root} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={s.back}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={s.title}>Staff</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <ActivityIndicator color={colors.teal} style={{ marginVertical: spacing.xl }} />
            ) : error ? (
                <EmptyState icon={<AppIcon name="offline" size={40} />} title="Can't load staff" subtitle={error} />
            ) : staff.length === 0 ? (
                <Text style={s.empty}>No staff yet. Add a helper below.</Text>
            ) : staff.map(m => (
                <Card key={m.id} style={s.row}>
                    <AppIcon name="staff" size="chip" color={colors.teal} />
                    <View style={{ flex: 1 }}>
                        <Text style={s.name}>{m.name}</Text>
                        <Text style={s.sub}>{m.phone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => remove(m)}>
                        <Text style={s.remove}>Remove</Text>
                    </TouchableOpacity>
                </Card>
            ))}

            <Text style={s.section}>ADD STAFF</Text>
            <TextInput style={s.input} placeholder="Name" placeholderTextColor={colors.textMuted}
                value={form.name} onChangeText={v => set('name', v)} />
            <TextInput style={s.input} placeholder="Their phone number (login)" placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad" value={form.phone} onChangeText={v => set('phone', v)} />
            <TextInput style={s.input} placeholder="Password (min 6)" placeholderTextColor={colors.textMuted}
                secureTextEntry value={form.password} onChangeText={v => set('password', v)} />
            <Text style={s.hint}>{"Staff can sell, receive stock and record khata. They can't change prices, shop details or staff."}</Text>
            <PrimaryButton label="Add staff" onPress={add} loading={saving} style={{ marginTop: spacing.md }} />
        </ScrollView>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: 80 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl, marginBottom: spacing.xl,
    },
    back: { color: colors.teal, fontSize: font.md, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    name: { color: colors.textPrimary, fontSize: font.md, fontWeight: '700' },
    sub: { color: colors.textMuted, fontSize: font.sm },
    remove: { color: colors.red, fontWeight: '700', fontSize: font.sm },
    empty: { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.md },
    section: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
    input: {
        backgroundColor: colors.bgInput, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        color: colors.textPrimary, fontSize: font.md, paddingHorizontal: spacing.md, paddingVertical: 13,
        marginBottom: spacing.sm,
    },
    hint: { color: colors.textMuted, fontSize: font.xs },
});
