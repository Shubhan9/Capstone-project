import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Vibration,
    TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, font, radius, spacing } from '../src/theme';

export default function BarcodeScanner({ onScan, onClose, hint }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [torch, setTorch] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [manualValue, setManualValue] = useState('');
    const scanLockRef = useRef(false);
    const resetTimerRef = useRef(null);

    function submitManual() {
        const code = manualValue.trim();
        if (!code) return;
        setManualMode(false);
        setManualValue('');
        onScan(code);
    }

    useEffect(() => {
        if (!permission?.granted) requestPermission();
    }, [permission?.granted, requestPermission]);

    useEffect(() => {
        return () => {
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        };
    }, []);

    async function handleScan({ data }) {
        if (scanLockRef.current) return;

        scanLockRef.current = true;
        setScanned(true);
        Vibration.vibrate(60);
        await onScan(data);

        // Small cooldown prevents the same barcode from firing multiple times
        // before the camera view is dismissed or the next scan begins.
        resetTimerRef.current = setTimeout(() => {
            scanLockRef.current = false;
            setScanned(false);
            resetTimerRef.current = null;
        }, 1200);
    }

    if (!permission?.granted) {
        return (
            <View style={s.permissionBox}>
                <Text style={s.permText}>Camera permission needed</Text>
                <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
                    <Text style={s.permBtnText}>Allow camera</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={s.wrapper} >
            <CameraView
                style={s.camera}
                enableTorch={torch}
                onBarcodeScanned={scanned || manualMode ? undefined : handleScan}
                barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_a', 'upc_e'],
                }
                }
            />

            {/* Scanning frame overlay */}
            <View style={s.overlay}>
                <View style={s.frameTop} />
                <View style={s.frameRow}>
                    <View style={s.frameSide} />
                    <View style={s.frame}>
                        <View style={[s.corner, s.tl]} />
                        <View style={[s.corner, s.tr]} />
                        <View style={[s.corner, s.bl]} />
                        <View style={[s.corner, s.br]} />
                        {scanned && <View style={s.scannedFlash} />}
                    </View>
                    <View style={s.frameSide} />
                </View>
                <View style={s.frameBottom}>
                    <Text style={s.hint}>{hint || 'Point at a barcode'}</Text>
                    <View style={s.actionsRow}>
                        <TouchableOpacity
                            style={[s.actionChip, torch && s.actionChipActive]}
                            onPress={() => setTorch(t => !t)}
                        >
                            <Text style={[s.actionChipText, torch && s.actionChipTextActive]}>
                                🔦 {torch ? 'Torch on' : 'Torch'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.actionChip} onPress={() => setManualMode(true)}>
                            <Text style={s.actionChipText}>⌨  Enter code</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                        <Text style={s.closeBtnText}>✕  Close</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Manual barcode entry (for damaged / unreadable codes) */}
            {manualMode && (
                <KeyboardAvoidingView
                    style={s.manualOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={s.manualBox}>
                        <Text style={s.manualTitle}>Enter barcode</Text>
                        <Text style={s.manualSub}>Type the number printed under the barcode.</Text>
                        <TextInput
                            style={s.manualInput}
                            placeholder="e.g. 8901030893346"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            autoFocus
                            value={manualValue}
                            onChangeText={setManualValue}
                            onSubmitEditing={submitManual}
                            returnKeyType="search"
                        />
                        <View style={s.manualBtns}>
                            <TouchableOpacity
                                style={s.manualCancel}
                                onPress={() => { setManualMode(false); setManualValue(''); }}
                            >
                                <Text style={s.manualCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.manualSubmit, !manualValue.trim() && { opacity: 0.5 }]}
                                disabled={!manualValue.trim()}
                                onPress={submitManual}
                            >
                                <Text style={s.manualSubmitText}>Look up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            )}
        </View>
    );
}

const CORNER = 22;
const CORNER_THICK = 3;

const s = StyleSheet.create({
    wrapper: { flex: 1, backgroundColor: '#000' },
    camera: { ...StyleSheet.absoluteFillObject },

    overlay: { flex: 1, flexDirection: 'column' },
    frameTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    frameRow: { flexDirection: 'row', height: 220 },
    frameSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    frameBottom: { flex: 1.2, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', paddingTop: 20, gap: 20 },

    frame: {
        width: 220, height: 220,
        position: 'relative',
    },
    scannedFlash: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.teal + '55',
        borderRadius: 4,
    },

    corner: {
        position: 'absolute', width: CORNER, height: CORNER,
        borderColor: colors.teal, borderWidth: CORNER_THICK,
    },
    tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
    tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
    bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
    br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },

    hint: {
        color: colors.textSecondary, fontSize: font.md,
        letterSpacing: 0.3, textAlign: 'center',
    },
    actionsRow: { flexDirection: 'row', gap: spacing.sm },
    actionChip: {
        borderWidth: 1, borderColor: colors.borderLight,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: radius.full,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    },
    actionChipActive: { borderColor: colors.teal, backgroundColor: colors.teal + '25' },
    actionChipText: { color: colors.textPrimary, fontSize: font.sm, fontWeight: '600' },
    actionChipTextActive: { color: colors.teal },

    closeBtn: {
        borderWidth: 1, borderColor: colors.border,
        borderRadius: radius.full,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    },
    closeBtnText: { color: colors.textPrimary, fontSize: font.sm, fontWeight: '600' },

    manualOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center', alignItems: 'center',
        padding: spacing.xl,
    },
    manualBox: {
        width: '100%',
        backgroundColor: colors.bgCard,
        borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
        padding: spacing.xl,
    },
    manualTitle: { color: colors.textPrimary, fontSize: font.xl, fontWeight: '700', marginBottom: spacing.xs },
    manualSub: { color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.lg },
    manualInput: {
        backgroundColor: colors.bgInput,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        color: colors.textPrimary, fontSize: font.lg,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
        textAlign: 'center', letterSpacing: 1,
    },
    manualBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    manualCancel: {
        flex: 1, alignItems: 'center', paddingVertical: spacing.md,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    },
    manualCancelText: { color: colors.textSecondary, fontSize: font.md, fontWeight: '600' },
    manualSubmit: {
        flex: 1, alignItems: 'center', paddingVertical: spacing.md,
        borderRadius: radius.md, backgroundColor: colors.teal,
    },
    manualSubmitText: { color: colors.bg, fontSize: font.md, fontWeight: '700' },

    permissionBox: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.bg, gap: 16,
    },
    permText: { color: colors.textSecondary, fontSize: font.md },
    permBtn: {
        backgroundColor: colors.teal, borderRadius: radius.md,
        paddingHorizontal: 24, paddingVertical: 12,
    },
    permBtnText: { color: colors.bg, fontWeight: '700' },
});
