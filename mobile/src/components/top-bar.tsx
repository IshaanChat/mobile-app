// The top bar: brand on the left, streak and Journey on the right.
//
// Journey lives here rather than in the tab bar on purpose. It's 16
// milestones you check in on, not a place you browse — making it a fifth
// tab would put a progress screen at the same weight as the feed, and
// there are only four things worth standing at the bottom of the screen.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { touchStreak } from '@/lib/prefs';

export function TopBar({ onOpenJourney, hasNews }: { onOpenJourney: () => void; hasNews?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    touchStreak().then(setStreak).catch(() => {});
  }, []);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + Spacing.two,
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
      ]}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: theme.accent }]}>
          <Icon name="spark" size={13} color={theme.accentText} />
        </View>
        <ThemedText style={[styles.wordmark, { color: theme.accent }]}>Venturo</ThemedText>
      </View>

      <View style={styles.right}>
        {streak !== null ? (
          <View style={styles.streak} accessibilityLabel={`${streak} day streak`}>
            <Icon name="flame" size={16} color={theme.engaged} />
            <ThemedText type="smallBold" style={{ color: theme.engaged }}>{streak}</ThemedText>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your journey"
          onPress={onOpenJourney}
          style={[styles.journey, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Journey</ThemedText>
          {hasNews ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mark: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  /**
   * The logotype, not a label. It was 15px semibold in the body font, which
   * is the same treatment a section heading gets — so the app's name read as
   * furniture. Baloo 2 Medium at 25px, and nothing else in the app is allowed
   * this family.
   *
   * `lineHeight` is pinned rather than left to default: Baloo ships tall
   * ascender metrics and RN reserves the full line box, so without this the
   * bar grew ~8px taller than the design for glyphs that are not there.
   */
  wordmark: { fontFamily: Fonts.wordmark, fontSize: 25, lineHeight: 28 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  streak: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  journey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  dot: { width: 6, height: 6, borderRadius: 999 },
});
