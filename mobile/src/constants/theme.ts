/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Venturo's palette, shared with the prototype so both surfaces feel like one
// product.
//
// Light — "the artisan": blush cream and violet, honey and sage. For the store
// owner whose brand is beautiful, personal, handmade.
// Dark — "the grind": warm charcoal and lavender, not techy navy. For the
// operator who treats their business like a scoreboard.
//
// prospect/engaged/customer are the relationship-journey colors; they map
// to the same three stages the CRM uses everywhere.
//
// ---------------------------------------------------------------------------
// The accent is two lightnesses of one hue, and it has to be.
//
// The app icon is a lavender V, so the accent moved from rose/gold to purple.
// But the icon's lavender cannot be the light-mode accent — measured against
// the blush-cream background it is 1.64:1, and white text on it is 1.78:1.
// Both need 4.5:1. It is legible only on the dark ground it was drawn for,
// where it reaches 10.99:1.
//
// So: a deep violet in light mode, the icon's own lavender in dark. Same hue
// (~264°), each one legible on its own background.
//
//   light accent #6E4EAB   5.78:1 on cream · white on it 6.29:1
//   dark  accent #D0B8F0  10.99:1 on charcoal · near-black on it 10.32:1
//
// Worth noting the rose this replaces only reached 3.56:1 as a text colour, so
// light mode gets *more* legible, not less.
//
// Both purples are sampled from assets/brand/logo.png, not chosen: the V's
// dominant colour over 130k pixels is #D0B8F0, and the violet is that hue
// darkened until it clears 4.5 on cream.
// ---------------------------------------------------------------------------
export const Colors = {
  light: {
    text: '#34262B',
    background: '#FBF4F0',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F8EDE8',
    textSecondary: '#98818A',
    accent: '#6E4EAB',
    accentText: '#FFFFFF',
    accentSoft: 'rgba(110, 78, 171, 0.1)',
    danger: '#CC4F4F',
    success: '#5F9B7A',
    border: '#EEDBD4',
    prospect: '#A3919A',
    engaged: '#CF8F2E',
    customer: '#5F9B7A',
  },
  dark: {
    text: '#EDEEF2',
    background: '#0B0C0F',
    backgroundElement: '#14161B',
    backgroundSelected: '#1B1E25',
    textSecondary: '#8B92A0',
    accent: '#D0B8F0',
    // Near-black, not white: white on this lavender is 1.78:1.
    accentText: '#1A1024',
    accentSoft: 'rgba(208, 184, 240, 0.14)',
    danger: '#E5484D',
    success: '#34C477',
    border: '#262A33',
    prospect: '#79808F',
    engaged: '#5B9CF0',
    customer: '#34C477',
  },
} as const;

/**
 * The app icon's background. Not a theme colour — it is the one value that has
 * to match the artwork exactly, and it is used for the splash so that launching
 * the app is continuous with tapping its icon.
 */
export const BrandDark = '#120E1B';

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * The three faces, named the way the design talks about them rather than the
 * way the files are named. This replaces the Expo template's system-font
 * stack — the app shipped with no custom type at all, which is why nothing
 * matched the prototype no matter how the spacing was tuned.
 *
 * React Native has no font synthesis: `fontWeight: '600'` on a family that
 * only ships Regular gets you Regular on iOS, or a smeared fake bold on
 * Android. Every weight has to be a separately registered family, so these
 * are full family names, not a family plus a weight. Never pair these with
 * `fontWeight`.
 *
 *   display  Fraunces — screen titles, onboarding questions, big numbers.
 *            Single moments only; it gets heavy repeated down a feed.
 *   sans     Plus Jakarta Sans — everything that repeats.
 *   wordmark Baloo 2 Medium — the Venturo logotype, and nothing else ever.
 */
export const Fonts = {
  display: 'Fraunces_600SemiBold',
  displayRegular: 'Fraunces_400Regular',
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  wordmark: 'Baloo2_500Medium',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
