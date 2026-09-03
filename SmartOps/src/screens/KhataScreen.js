import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    StyleSheet, RefreshControl, Modal, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
    getOutstandingCustomers, getCustomerLedger, recordRepayment,
} from '../database/actions';
import { PrimaryButton, GhostButton, EmptyState } from '../../components/UI';
import { AppIcon } from '../theme/icons';
import { colors, spacing, radius, font } from '../theme';

export default function KhataScreen({ navigation }) {
    const [rows, setRows] = useState([]);           // [{ customer, balance }]
    const [refreshing, setRefreshing] = useState(false);
    const [selected, setSelected] = useState(null); // { customer, balance }
    const [ledger, setLedger] = useState([]);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const outstanding = await getOutstandingCustomers();
        setRows(outstanding);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    const totalOutstanding = rows.reduce((sum, r) => sum + r.balance, 0);

    async function openCustomer(row) {
        setSelected(row);
        setPayAmount('');
        setLedger([]);
        setLoadingLedger(true);
        try {
            const { entries } = await getCustomerLedger(row.customer.id);
            setLedger(entries);
        } finally {
            setLoadingLedger(false);
        }
    }

    function closeCustomer() {
        setSelected(null);
        setLedger([]);
        setPayAmount('');
    }

    async function submitRepayment() {
        const amount = parseFloat(payAmount);
        if (!amount || amount <= 0) {
            return Alert.alert('Invalid amount', 'Enter a repayment amount greater than 0.');
        }
        if (amount > selected.balance + 0.005) {
            return Alert.alert(
                'Amount too high',
                `This customer owes ₹${selected.balance.toFixed(2)}. Enter that amount or less.`
            );
        }
        setSaving(true);
        try {
            await recordRepayment({ customerId: selected.customer.id, amount });
            closeCustomer();
            await load();
        } catch (e) {
            Alert.alert('Error', 'Could not record repayment. Please try again.');
            console.error(e);
        } finally {
            setSaving(false);
        }
    }

    return (
        <View style={s.root}>
            <ScrollView
                contentContainerStyle={s.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Khata is a tab root — its header action opens the full customer
                    directory (address, contact) rather than going back anywhere. */}
                <View style={s.header}>
                    <Text style={s.title}>Khata</Text>
                    <TouchableOpacity style={s.headerIconBtn} onPress={() => navigation.navigate('Customers')}>
                        <AppIcon name="customers" size="chip" />
                    </TouchableOpacity>
                </View>

                {/* Total outstanding card */}
                <View style={s.totalCard}>
                    <Text style={s.totalLabel}>TOTAL OUTSTANDING</Text>
                    <Text style={s.totalValue}>₹{totalOutstanding.toFixed(0)}</Text>
                    <Text style={s.totalSub}>
                        {rows.length} {rows.length === 1 ? 'customer owes' : 'customers owe'} you
                    </Text>
                </View>

                {rows.length === 0 ? (
                    <EmptyState
                        icon={<AppIcon name="allClear" size={40} color={colors.teal} />}
                        title="No pending credit"
                        subtitle="Credit sales you make will show up here until the customer repays."
                    />
                ) : (
                    rows.map(row => (
                        <TouchableOpacity
                            key={row.customer.id}
                            style={s.customerRow}
                            activeOpacity={0.75}
                            onPress={() => openCustomer(row)}
                        >
                            <View style={s.avatar}>
                                <Text style={s.avatarText}>
                                    {(row.customer.name || '?').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.customerName} numberOfLines={1}>{row.customer.name}</Text>
                                <Text style={s.customerPhone}>{row.customer.phone}</Text>
                            </View>
                            <View style={s.balanceWrap}>
                                <Text style={s.balanceValue}>₹{row.balance.toFixed(0)}</Text>
                                <Text style={s.balanceLabel}>due ›</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Customer ledger + repayment modal */}
            <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeCustomer}>
                <KeyboardAvoidingView
                    style={s.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closeCustomer}>
                    <TouchableOpacity activeOpacity={1} onPress={() => {}} style={s.modalBox}>
                        <View style={s.modalHeader}>
                            <View>
                                <Text style={s.modalTitle}>{selected?.customer?.name}</Text>
                                <Text style={s.modalPhone}>{selected?.customer?.phone}</Text>
                            </View>
                            <TouchableOpacity onPress={closeCustomer}>
                                <AppIcon name="close" size="chip" color={colors.red} />
                            </TouchableOpacity>
                        </View>

                        <View style={s.modalBalanceRow}>
                            <Text style={s.modalBalanceLabel}>Outstanding</Text>
                            <Text style={s.modalBalanceValue}>₹{selected?.balance?.toFixed(2)}</Text>
                        </View>

                        {/* Repayment input */}
                        <Text style={s.inputLabel}>RECORD A REPAYMENT</Text>
                        <View style={s.payRow}>
                            <TextInput
                                style={s.payInput}
                                placeholder="₹ amount received"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="decimal-pad"
                                value={payAmount}
                                onChangeText={setPayAmount}
                            />
                            <TouchableOpacity
                                style={s.fullBtn}
                                onPress={() => setPayAmount(String(selected?.balance?.toFixed(2)))}
                            >
                                <Text style={s.fullBtnText}>Full</Text>
                            </TouchableOpacity>
                        </View>
                        <PrimaryButton
                            label="Record repayment"
                            onPress={submitRepayment}
                            loading={saving}
                            style={{ marginTop: spacing.sm }}
                        />

                        {/* Ledger history */}
                        <Text style={[s.inputLabel, { marginTop: spacing.xl }]}>HISTORY</Text>
                        {loadingLedger ? (
                            <View style={s.loadingState}>
                                <ActivityIndicator color={colors.teal} />
                            </View>
                        ) : (
                            <ScrollView style={s.historyList} showsVerticalScrollIndicator={false}>
                                {ledger.map(entry => {
                                    const isRepayment = entry.type === 'repayment';
                                    return (
                                        <View key={entry.id} style={s.historyRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.historyType}>
                                                    {isRepayment ? 'Repayment' : 'Credit sale'}
                                                </Text>
                                                <Text style={s.historyDate}>
                                                    {new Date(entry.entryAt).toLocaleDateString('en-IN', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                    })}
                                                </Text>
                                            </View>
                                            <Text style={[s.historyAmount, { color: isRepayment ? colors.teal : colors.amber }]}>
                                                {isRepayment ? '−' : '+'}₹{entry.amount.toFixed(2)}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        )}

                        <GhostButton label="Close" onPress={closeCustomer} style={{ marginTop: spacing.md }} />
                    </TouchableOpacity>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>
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
    title: { color: colors.textPrimary, fontSize: font.lg, fontWeight: '700' },
    headerIconBtn: {
        width: 38, height: 38, borderRadius: radius.md,
        backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
    },

    totalCard: {
        backgroundColor: colors.bgCard,
        borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight,
        padding: spacing.xl, marginBottom: spacing.xl,
    },
    totalLabel: { color: colors.textSecondary, fontSize: font.xs, fontWeight: '700', letterSpacing: 1.5, marginBottom: spacing.xs },
    totalValue: { color: colors.amber, fontSize: 44, fontWeight: '800', letterSpacing: -1 },
    totalSub: { color: colors.textMuted, fontSize: font.sm, marginTop: 4 },

    customerRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.md, marginBottom: spacing.sm,
    },
    avatar: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: colors.bgInput,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.textPrimary, fontSize: font.md, fontWeight: '700' },
    customerName: { color: colors.textPrimary, fontSize: font.md, fontWeight: '600', marginBottom: 2 },
    customerPhone: { color: colors.textMuted, fontSize: font.xs },
    balanceWrap: { alignItems: 'flex-end' },
    balanceValue: { color: colors.amber, fontSize: font.lg, fontWeight: '700' },
    balanceLabel: { color: colors.textMuted, fontSize: font.xs },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    modalBackdrop: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    modalBox: {
        backgroundColor: colors.bgCard,
        borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
        borderWidth: 1, borderColor: colors.border,
        padding: spacing.xl, paddingBottom: 40, maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    modalTitle: { color: colors.textPrimary, fontSize: font.xl, fontWeight: '700' },
    modalPhone: { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
    modalClose: { color: colors.red, fontSize: font.lg, padding: 4 },

    modalBalanceRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.amber + '12',
        borderWidth: 1, borderColor: colors.amber + '30',
        borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg,
    },
    modalBalanceLabel: { color: colors.amber, fontSize: font.md, fontWeight: '600' },
    modalBalanceValue: { color: colors.amber, fontSize: font.xl, fontWeight: '800' },

    inputLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm },
    payRow: { flexDirection: 'row', gap: spacing.sm },
    payInput: {
        flex: 1,
        backgroundColor: colors.bgInput,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        color: colors.textPrimary, fontSize: font.md,
        paddingHorizontal: spacing.md, paddingVertical: 13,
    },
    fullBtn: {
        paddingHorizontal: spacing.lg, justifyContent: 'center',
        backgroundColor: colors.bgInput, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border,
    },
    fullBtnText: { color: colors.teal, fontSize: font.sm, fontWeight: '700' },

    loadingState: { paddingVertical: spacing.lg, alignItems: 'center' },
    historyList: { maxHeight: 220 },
    historyRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    historyType: { color: colors.textPrimary, fontSize: font.sm, fontWeight: '600', marginBottom: 2 },
    historyDate: { color: colors.textMuted, fontSize: font.xs },
    historyAmount: { fontSize: font.md, fontWeight: '700' },
});
