// Growth: the $5/month tier. Finds the communities and customers your
// business should be in front of (the engine behind the web app's Discover).
// v1 ships fully locked — a real upgrade screen, no live billing; testers
// get unlocked manually. See DESIGN.md.
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PROMISES = [
  ['🎯', 'Real communities where your customers already hang out'],
  ['🧲', 'Leads you can actually message, not scraped lists'],
  ['🗺️', 'A weekly plan for where to show up next'],
] as const;

export default function GrowthScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.hero}>
            <ThemedText style={styles.lock}>🔒</ThemedText>
            <ThemedText type="subtitle" style={styles.center}>Growth</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Where your next customers come from.
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {PROMISES.map(([emoji, text]) => (
              <View key={text} style={styles.row}>
                <ThemedText style={styles.emoji}>{emoji}</ThemedText>
                <ThemedText type="small" style={styles.rowText}>{text}</ThemedText>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: theme.accent }]}
            onPress={() => {}}>
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              $5/month — coming soon
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Early testers get it free. You’re early.
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  hero: { alignItems: 'center', gap: Spacing.one },
  lock: { fontSize: 40, lineHeight: 48 },
  center: { textAlign: 'center' },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  emoji: { fontSize: 20, lineHeight: 26 },
  rowText: { flex: 1 },
  cta: {
    borderRadius: Spacing.three,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
