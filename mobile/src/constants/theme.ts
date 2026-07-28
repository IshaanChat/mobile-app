/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Venturo's palette, carried over from the web client so both
// surfaces feel like one product.
//
// Light — "the artisan": blush cream, dusty rose, honey and sage. For the
// store owner whose brand is beautiful, personal, handmade.
// Dark — "the grind": warm charcoal and gold, not techy navy. For the
// operator who treats their business like a scoreboard.
//
// prospect/engaged/customer are the relationship-journey colors; they map
// to the same three stages the CRM uses everywhere.
export const Colors = {
  light: {
    text: '#34262B',
    background: '#FBF4F0',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F8EDE8',
    textSecondary: '#98818A',
    accent: '#C2647E',
    accentText: '#FFFFFF',
    accentSoft: 'rgba(194, 100, 126, 0.1)',
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
    accent: '#E3A82B',
    accentText: '#1A1408',
    accentSoft: 'rgba(227, 168, 43, 0.12)',
    danger: '#E5484D',
    success: '#34C477',
    border: '#262A33',
    prospect: '#79808F',
    engaged: '#5B9CF0',
    customer: '#34C477',
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
