/**
 * Semantic colors for the "Rail & Ledger" UI system.
 *
 * Names and values mirror `.design/tripflow-ui-2.0/src/tokens.css` one-for-one.
 * Surfaces carry no hue; color is spent on the single primary action and on
 * status. Components read tokens through `useTheme()` and must never branch on
 * the active scheme or compare a token to a literal.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // surfaces
    background: '#F7F8F8',
    backgroundElement: '#FFFFFF',
    backgroundSubtle: '#EFF1F1',
    backgroundSelected: '#E1EDE7',

    // text
    text: '#16211F',
    textSecondary: '#5A6663',
    textMuted: '#8A9491',
    textOnAccent: '#FFFFFF',
    textOnDanger: '#FFFFFF',
    link: '#2E6A96',

    // accents
    accent: '#0E6E57',
    accentPressed: '#0A5744',
    accentSoft: '#E1EDE7',
    info: '#2E6A96',
    infoSoft: '#E7EEF4',
    plan: '#A65A2E',
    planSoft: '#F5EBE4',
    danger: '#AF3128',
    dangerSoft: '#F8E7E5',

    // money states a direction, never a severity
    moneyIn: '#0E6E57',
    moneyOut: '#A85A22',
    moneySettled: '#8A9491',

    // lines and depth
    border: '#E2E5E5',
    borderField: '#CFD6D4',
    borderFocus: '#2E6A96',
    shadow: '#16211F',
    navSurface: 'rgba(255,255,255,0.82)',
    navShadow: '0 8px 24px rgba(22,33,31,0.12)',
    scrim: 'rgba(22,33,31,0.72)',
    sheetScrim: 'rgba(12,25,36,0.32)',
    /** Always light: it sits on an opaque dark scrim in both themes. */
    textOnScrim: '#FFFFFF',
    /** Accessible label/initials color on accentSoft and backgroundSelected grounds. */
    accentOnSoft: '#0A5744',

    // itinerary kinds: one muted family at matched lightness.
    // kindActivity stays lighter than accent so a rail dot never reads as the
    // primary action.
    kindTransport: '#2E6A96',
    kindLodging: '#63569B',
    kindFood: '#A05329',
    kindActivity: '#2F7A62',
    kindTask: '#856520',
    kindNote: '#5A6663',
    kindTransportSoft: '#E7EEF4',
    kindLodgingSoft: '#ECEAF4',
    kindFoodSoft: '#F4EAE3',
    kindActivitySoft: '#E6F0EC',
    kindTaskSoft: '#F2EDE0',
    kindNoteSoft: '#ECEEEE',

    // destination atlas
    mapBackground: '#17383A',
    mapLand: '#285657',
    mapLandSelected: '#3E8C79',
    mapGrid: '#3B6B6B',
    mapRoute: '#FFB16B',
    mapMarker: '#FFFFFF',
  },
  dark: {
    background: '#0F1413',
    backgroundElement: '#171D1C',
    backgroundSubtle: '#1D2523',
    backgroundSelected: '#24322D',

    text: '#ECEFEE',
    textSecondary: '#9EAAA7',
    textMuted: '#7C8885',
    textOnAccent: '#0A0F0E',
    textOnDanger: '#321310',
    link: '#7FB6DC',

    accent: '#34A383',
    accentPressed: '#2A8A6E',
    accentSoft: '#24322D',
    info: '#7FB6DC',
    infoSoft: '#22303A',
    plan: '#D08A5A',
    planSoft: '#2E2823',
    danger: '#F09189',
    dangerSoft: '#3A1F1C',

    moneyIn: '#34A383',
    moneyOut: '#D08A5A',
    moneySettled: '#7C8885',

    border: '#2A3331',
    borderField: '#3A4644',
    borderFocus: '#7FB6DC',
    shadow: '#000000',
    navSurface: 'rgba(23,29,28,0.82)',
    navShadow: '0 8px 24px rgba(0,0,0,0.44)',
    scrim: 'rgba(6,10,9,0.76)',
    sheetScrim: 'rgba(6,10,9,0.56)',
    textOnScrim: '#FFFFFF',
    accentOnSoft: '#9FD3C1',

    kindTransport: '#7FB6DC',
    kindLodging: '#A79BE0',
    kindFood: '#D9906A',
    kindActivity: '#4FB595',
    kindTask: '#D8B45F',
    kindNote: '#9EAAA7',
    kindTransportSoft: '#24322D',
    kindLodgingSoft: '#24322D',
    kindFoodSoft: '#24322D',
    kindActivitySoft: '#24322D',
    kindTaskSoft: '#24322D',
    kindNoteSoft: '#24322D',

    // destination atlas
    mapBackground: '#081F24',
    mapLand: '#143A40',
    mapLandSelected: '#267A69',
    mapGrid: '#20505A',
    mapRoute: '#FFC078',
    mapMarker: '#F5FFFA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * 4pt base. Names mirror `--space-*` in
 * `.design/tripflow-ui-2.0/src/tokens.css`; the legacy numeric names below
 * remain for callers that have not been converted yet.
 */
export const Spacing = {
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,

  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii; mirrors `--radius-*`. Radius rises with elevation. */
export const Radius = {
  xs: 8,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  '2xl': 26,
  pill: 999,
} as const;

/** Fixed measures the design specifies; mirrors `--size-*`. */
export const Size = {
  touchMin: 44,
  control: 48,
  amountControl: 64,
  desktopBreakpoint: 1024,
  sidebar: 200,
  fab: 56,
  nav: 54,
  fabClearance: 86,
  railGutter: 46,
  screenGutter: 20,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
