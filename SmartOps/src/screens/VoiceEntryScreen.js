import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity,
    ActivityIndicator, Pressable, Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
    useAudioRecorder, useAudioRecorderState, AudioModule, setAudioModeAsync, RecordingPresets,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { VoiceAPI } from '../services/api';
import {
    matchCustomerByName, matchProductByName, recordCreditEntry, recordRepayment, createCustomer,
} from '../database/actions';
import { useAppBadges } from '../hooks/useAppBadges';
import { PrimaryButton, GhostButton, Card } from '../../components/UI';
import { AppIcon } from '../theme/icons';
import { colors, spacing, radius, font } from '../theme';

// Small mono AAC (ADTS) clips: a format Gemini accepts directly, ~4 KB/s, so a
// 10-second sentence uploads quickly on a weak shop connection.
const VOICE_PRESET = {
    ...RecordingPresets.LOW_QUALITY,
    extension: '.aac',
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
    android: { outputFormat: 'aac_adts', audioEncoder: 'aac' },
};
// Android writes raw AAC (ADTS); iOS keeps its default AAC-in-MP4 (.m4a).
const VOICE_MIME = Platform.OS === 'android' ? 'audio/aac' : 'audio/mp4';
const MAX_SECONDS = 15;

const ACTION_LABEL = {
    khata_credit: 'Add to khata (credit)',
    khata_repayment: 'Khata repayment',
    sale: 'New sale',
    stock_in: 'Stock received',
    unknown: "Didn't catch that",
};

// Hold the mic, speak ("Ramesh ko 200 udhaar", "2 Parle-G aur 1 Amul doodh becha"),
// release. The clip goes to our server → Gemini → a structured intent, which is
// shown here to check and edit. Nothing is saved until the shopkeeper confirms,
// and the confirmed action uses the same offline-first writes as the rest of the app.
export default function VoiceEntryScreen({ navigation }) {
    const recorder = useAudioRecorder(VOICE_PRESET);
    const recState = useAudioRecorderState(recorder, 250);
    const [phase, setPhase] = useState('idle');   // idle | recording | thinking | review
    const [intent, setIntent] = useState(null);
    const [customer, setCustomer] = useState(null);
    const [amount, setAmount] = useState('');
    const [lines, setLines] = useState([]);       // [{ spoken, quantity, product }]
    const [saving, setSaving] = useState(false);
    const { refresh: refreshBadges } = useAppBadges();

    useEffect(() => {
        (async () => {
            const perm = await AudioModule.requestRecordingPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Microphone needed', 'Allow microphone access to use voice entry.');
                return;
            }
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        })();
    }, []);

    // Hard stop so a stuck finger can't record a huge clip.
    useEffect(() => {
        if (phase === 'recording' && (recState.durationMillis || 0) >= MAX_SECONDS * 1000) stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recState.durationMillis, phase]);

    async function start() {
        const net = await NetInfo.fetch();
        if (net.isConnected === false || net.isInternetReachable === false) {
            Alert.alert('Voice needs internet', 'Everything else works offline — use the normal screens for now.');
            return;
        }
        try {
            await recorder.prepareToRecordAsync();
            recorder.record();
            setPhase('recording');
        } catch (e) {
            Alert.alert('Could not start recording', e.message);
        }
    }

    async function stop() {
        if (phase !== 'recording') return;
        setPhase('thinking');
        const duration = recState.durationMillis || 0;   // read before stop() resets it
        try {
            await recorder.stop();
            if (duration < 700) {
                setPhase('idle');
                return;   // a tap, not a sentence
            }
            const audio = await FileSystem.readAsStringAsync(recorder.uri, { encoding: 'base64' });
            const { intent: parsed } = await VoiceAPI.parse(audio, VOICE_MIME);
            await review(parsed);
        } catch (e) {
            setPhase('idle');
            Alert.alert('Voice failed', e.status ? e.message : 'Check your internet connection and try again.');
        }
    }

    async function review(parsed) {
        setIntent(parsed);
        setAmount(parsed.amount != null ? String(parsed.amount) : '');
        setCustomer(parsed.customer_name ? await matchCustomerByName(parsed.customer_name) : null);
        const matched = [];
        for (const it of parsed.items || []) {
            matched.push({
                spoken: it.product_name,
                quantity: it.quantity || 1,
                product: await matchProductByName(it.product_name),
            });
        }
        setLines(matched);
        setPhase('review');
    }

    function reset() {
        setIntent(null);
        setCustomer(null);
        setLines([]);
        setAmount('');
        setPhase('idle');
    }

    async function ensureCustomer() {
        if (customer) return customer;
        if (!intent.customer_name) return null;
        // Spoken name isn't in the customer list yet — create it (phone can be added later).
        const created = await createCustomer({ name: intent.customer_name });
        setCustomer(created);
        return created;
    }

    async function confirm() {
        const action = intent.action;
        setSaving(true);
        try {
            if (action === 'khata_credit' || action === 'khata_repayment') {
                const value = parseFloat(amount);
                if (!(value > 0)) return Alert.alert('Enter the amount');
                const c = await ensureCustomer();
                if (!c) return Alert.alert('Say or pick a customer name');
                if (action === 'khata_credit') {
                    await recordCreditEntry({ customerId: c.id, amount: value, note: 'Voice entry' });
                } else {
                    await recordRepayment({ customerId: c.id, amount: value, note: 'Voice entry' });
                }
                refreshBadges();
                Alert.alert('Saved ✓', `${action === 'khata_credit' ? 'Credit' : 'Repayment'} of ₹${value} for ${c.name}.`);
                reset();
                return;
            }

            const usable = lines.filter(l => l.product);
            if (usable.length === 0) return Alert.alert('No matching products', 'None of the items matched your product list.');

            if (action === 'sale') {
                const c = intent.customer_name ? await ensureCustomer() : null;
                navigation.replace('NewOrder', {
                    prefill: {
                        lines: usable.map(l => ({ productId: l.product.id, quantity: l.quantity })),
                        customerId: c?.id ?? null,
                        paymentMode: intent.payment_mode || 'cash',
                    },
                });
            } else if (action === 'stock_in') {
                navigation.replace('StockIn', { productId: usable[0].product.id, quantity: usable[0].quantity });
            }
        } finally {
            setSaving(false);
        }
    }

    const secs = Math.floor((recState.durationMillis || 0) / 1000);

    return (
        <ScrollView style={s.root} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={s.back}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={s.title}>Voice entry</Text>
                <View style={{ width: 40 }} />
            </View>

            {phase !== 'review' && (
                <View style={s.center}>
                    <Text style={s.prompt}>
                        {phase === 'recording' ? `Listening… ${secs}s` : phase === 'thinking' ? 'Understanding…' : 'Hold the mic and speak'}
                    </Text>
                    <Pressable
                        onPressIn={start}
                        onPressOut={stop}
                        disabled={phase === 'thinking'}
                        style={[s.mic, phase === 'recording' && s.micActive]}
                    >
                        {phase === 'thinking'
                            ? <ActivityIndicator color={colors.white} size="large" />
                            : <AppIcon name="mic" size={56} color={colors.white} weight="fill" />}
                    </Pressable>
                    <Text style={s.examplesTitle}>Try saying</Text>
                    {[
                        '"Ramesh ko do sau rupaye udhaar"',
                        '"Sunita ne paanch sau jama kiye"',
                        '"Do Parle-G aur ek Amul doodh becha"',
                        '"Bees kilo chawal aaya"',
                    ].map(t => <Text key={t} style={s.example}>{t}</Text>)}
                </View>
            )}

            {phase === 'review' && intent && (
                <View>
                    <Card style={{ marginBottom: spacing.md }}>
                        <Text style={s.label}>YOU SAID</Text>
                        <Text style={s.transcript}>{intent.transcript || '—'}</Text>
                    </Card>

                    <Text style={s.action}>{ACTION_LABEL[intent.action] || ACTION_LABEL.unknown}</Text>

                    {(intent.action === 'khata_credit' || intent.action === 'khata_repayment' || (intent.action === 'sale' && intent.customer_name)) && (
                        <>
                            <Text style={s.label}>CUSTOMER</Text>
                            <Text style={s.value}>
                                {customer ? customer.name : `${intent.customer_name || '—'}  (new customer)`}
                            </Text>
                        </>
                    )}

                    {(intent.action === 'khata_credit' || intent.action === 'khata_repayment') && (
                        <>
                            <Text style={s.label}>AMOUNT (₹)</Text>
                            <TextInput style={s.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
                        </>
                    )}

                    {(intent.action === 'sale' || intent.action === 'stock_in') && (
                        <>
                            <Text style={s.label}>ITEMS</Text>
                            {lines.map((l, i) => (
                                <View key={i} style={s.lineRow}>
                                    <Text style={[s.value, { flex: 1 }, !l.product && { color: colors.red }]}>
                                        {l.product ? l.product.name : `${l.spoken} — not in your products`}
                                    </Text>
                                    <Text style={s.value}>× {l.quantity}</Text>
                                </View>
                            ))}
                            {intent.action === 'sale' && <Text style={s.hint}>You can review prices and payment on the next screen.</Text>}
                        </>
                    )}

                    {intent.action === 'unknown' ? (
                        <PrimaryButton label="Try again" onPress={reset} style={{ marginTop: spacing.xl }} />
                    ) : (
                        <>
                            <PrimaryButton
                                label={intent.action === 'sale' ? 'Review sale' : intent.action === 'stock_in' ? 'Continue to Stock In' : 'Confirm & save'}
                                onPress={confirm}
                                loading={saving}
                                style={{ marginTop: spacing.xl }}
                            />
                            <GhostButton label="Discard" onPress={reset} style={{ marginTop: spacing.sm }} />
                        </>
                    )}
                </View>
            )}
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
    center: { alignItems: 'center', paddingTop: spacing.xl },
    prompt: { color: colors.textPrimary, fontSize: font.xl, fontWeight: '700', marginBottom: spacing.xxl },
    mic: {
        width: 140, height: 140, borderRadius: 70, backgroundColor: colors.teal,
        alignItems: 'center', justifyContent: 'center',
    },
    micActive: { backgroundColor: colors.red, transform: [{ scale: 1.08 }] },
    examplesTitle: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginTop: spacing.xxxl, marginBottom: spacing.sm },
    example: { color: colors.textSecondary, fontSize: font.md, marginBottom: 6 },
    label: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.xs },
    transcript: { color: colors.textPrimary, fontSize: font.lg, fontStyle: 'italic' },
    action: { color: colors.teal, fontSize: font.xl, fontWeight: '800' },
    value: { color: colors.textPrimary, fontSize: font.md, fontWeight: '600' },
    hint: { color: colors.textMuted, fontSize: font.sm, marginTop: spacing.sm },
    lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    input: {
        backgroundColor: colors.bgInput, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        color: colors.textPrimary, fontSize: font.lg, paddingHorizontal: spacing.md, paddingVertical: 12,
    },
});
