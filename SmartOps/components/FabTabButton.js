// The raised center "New Order" button in the bottom tab bar. It occupies a
// real tab slot (so it sits dead-center), but its tabPress is intercepted in
// App.js to push the NewOrder screen instead of switching tabs — this button
// never actually becomes "active."
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppIcon } from '../src/theme/icons';
import { colors, radius } from '../src/theme';

export default function FabTabButton({ onPress }) {
    return (
        <View style={s.wrap} pointerEvents="box-none">
            <TouchableOpacity style={s.button} activeOpacity={0.85} onPress={onPress}>
                <AppIcon name="newOrder" size={28} color={colors.bg} />
            </TouchableOpacity>
        </View>
    );
}

const s = StyleSheet.create({
    wrap: {
        top: -22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    button: {
        width: 58, height: 58, borderRadius: radius.full,
        backgroundColor: colors.teal,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.teal,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
});
