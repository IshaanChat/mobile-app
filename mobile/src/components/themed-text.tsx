import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * Weight is carried by the family, never by `fontWeight`.
 *
 * These styles used to set `fontWeight: 500/600/700` with no family at all,
 * which worked only because everything was the system font. With registered
 * custom families that combination is a trap: iOS ignores the weight and
 * renders Regular, Android fakes it by smearing the glyphs. Picking
 * `PlusJakartaSans_600SemiBold` is the whole instruction.
 *
 * Fraunces on title and subtitle, matching the prototype's rule that the
 * serif is for single moments — a screen title, one question, one big number.
 * Anything that repeats down a feed stays sans, which is why `default` and
 * `small` are Jakarta even though they are the most common styles in the app.
 */
const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: Fonts.sansMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  link: {
    fontFamily: Fonts.sansMedium,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: Fonts.sansSemiBold,
    lineHeight: 30,
    fontSize: 14,
    // No colour here on purpose. This used to hardcode the light-mode accent,
    // which meant primary links stayed rose in dark mode and survived the move
    // to purple untouched — a literal in a StyleSheet cannot follow the theme.
    // `themeColor="accent"` on the element supplies it instead.
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
