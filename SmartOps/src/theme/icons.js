// Centralized icon system — every icon in the app is rendered through this one
// module, and every color it uses comes from `colors` (src/theme/index.js).
// That indirection is deliberate: when light mode is added later, only the
// `colors` palette needs to become theme-aware — nothing here, and nothing at
// any of the ~15 call sites across the app, has to change.
//
// One stroke weight app-wide ('regular'). The single deliberate exception is
// tab-bar active state, which switches to 'fill' — that's a state indicator,
// not a second competing style.
import React from 'react';
import {
    House, Package, HandCoins, Receipt, Plus,
    ArrowsClockwise, SignOut, Users, UserPlus,
    WarningCircle, TrendUp, ShoppingCart, Archive,
    Barcode, CheckCircle, WifiSlash, Flashlight, Keyboard,
    X, CaretRight, MapPin, Eye, EyeSlash,
} from 'phosphor-react-native';
import { colors } from './index';

const ICONS = {
    // Tab bar
    home: House,
    inventory: Package,
    khata: HandCoins,
    records: Receipt,
    // Actions
    newOrder: Plus,
    add: Plus,
    sync: ArrowsClockwise,
    logout: SignOut,
    customers: Users,
    addCustomer: UserPlus,
    alerts: WarningCircle,
    restock: TrendUp,
    cart: ShoppingCart,
    stockIn: Archive,
    scan: Barcode,
    allClear: CheckCircle,
    offline: WifiSlash,
    torch: Flashlight,
    keyboard: Keyboard,
    close: X,
    chevron: CaretRight,
    location: MapPin,
    show: Eye,
    hide: EyeSlash,
};

// Three sizes only: inline text/list rows, the bottom tab bar, and action chips
// (header buttons, cards) that need a slightly larger tap target.
const SIZES = { inline: 18, chip: 22, tabBar: 24 };

/**
 * <AppIcon name="khata" size="chip" active color={colors.teal} />
 *
 * - `active` switches weight to 'fill' (tab-bar selected state) — everywhere
 *   else stays 'regular'.
 * - `color` overrides the default; when omitted, active icons use the app's
 *   accent (teal) and inactive icons use muted text — both from `colors`.
 */
export function AppIcon({ name, size = 'inline', active = false, color }) {
    const Glyph = ICONS[name];
    if (!Glyph) {
        if (__DEV__) console.warn(`[AppIcon] Unknown icon name: "${name}"`);
        return null;
    }
    const resolvedColor = color || (active ? colors.teal : colors.textMuted);
    const resolvedSize = typeof size === 'number' ? size : (SIZES[size] ?? SIZES.inline);

    return (
        <Glyph
            size={resolvedSize}
            color={resolvedColor}
            weight={active ? 'fill' : 'regular'}
        />
    );
}

export { SIZES as ICON_SIZES };
