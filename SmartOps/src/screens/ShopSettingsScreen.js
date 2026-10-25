import React, { useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, ScrollView, Alert,
    TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BusinessAPI } from '../services/api';
import { useSession, saveSession } from '../services/session';
import { PrimaryButton } from '../../components/UI';
import { colors, spacing, radius, font } from '../theme';

// Shop details printed on bills, and the UPI ID used in payment links sent
// with khata reminders. Saved on the server (owner only), cached on the phone.
export default function ShopSettingsScreen({ navigation }) {
    const { business } = useSession();
    const [form, setForm] = useState({
        name: business?.name || '',
        upi_id: business?.upi_id || '',
        address: business?.address || '',
        gstin: business?.gstin || '',
    });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    async function save() {
        if (!form.name.trim()) return Alert.alert('Shop name is required');
        setSaving(true);
        try {
            const res = await BusinessAPI.updateProfile({
                name: form.name.trim(),
                upi_id: form.upi_id.trim(),
                address: form.address.trim(),
                gstin: form.gstin.trim().toUpperCase(),
            });
            await saveSession({ business: { ...business, ...res.business } });
            Alert.alert('Saved', 'Your shop details are updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (e) {
            const msg = e.data?.errors?.[0]?.msg || e.message;
            Alert.alert('Could not save', e.status ? msg : 'You are offline. Connect to the internet to update shop details.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
                <View style={s.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={s.back}>‹ Back</Text>
                    </TouchableOpacity>
                    <Text style={s.title}>Shop details</Text>
                    <View style={{ width: 40 }} />
                </View>

                <Text style={s.label}>Shop name *</Text>
                <TextInput style={s.input} value={form.name} onChangeText={v => set('name', v)}
                    placeholderTextColor={colors.textMuted} />

                <Text style={s.label}>UPI ID</Text>
                <TextInput style={s.input} value={form.upi_id} onChangeText={v => set('upi_id', v)}
                    placeholder="e.g. sharmastore@okaxis" placeholderTextColor={colors.textMuted}
                    autoCapitalize="none" keyboardType="email-address" />
                <Text style={s.hint}>Added to khata reminders as a tap-to-pay link with the amount filled in.</Text>

                <Text style={s.label}>Address</Text>
                <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} multiline
                    value={form.address} onChangeText={v => set('address', v)}
                    placeholder="Shown at the top of every bill" placeholderTextColor={colors.textMuted} />

                <Text style={s.label}>GSTIN (optional)</Text>
                <TextInput style={s.input} value={form.gstin} onChangeText={v => set('gstin', v)}
                    placeholder="15-character GST number" placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters" maxLength={15} />

                <PrimaryButton label="Save" onPress={save} loading={saving} style={{ marginTop: spacing.xl }} />
            </ScrollView>
        </KeyboardAvoidingView>
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
    label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
    hint: { color: colors.textMuted, fontSize: font.xs, marginTop: spacing.xs },
    input: {
        backgroundColor: colors.bgInput, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        color: colors.textPrimary, fontSize: font.md, paddingHorizontal: spacing.md, paddingVertical: 13,
    },
});
