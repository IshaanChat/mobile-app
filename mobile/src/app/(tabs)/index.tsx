// Discover: free for everyone. A feed of product sources with viral
// potential — the hook for explorers and the scout for owners. The feed
// content arrives with the /api/trends endpoint (next build phase).
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppData } from '@/state/app-data';

export default function DiscoverScreen() {
  const theme = useTheme();
  const { mode } = useAppData();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Discover</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Products with momentum, and where they’re taking off.
            </ThemedText>
          </View>

          {mode === 'explorer' ? (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Your first mission 🧭</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Browse the feed, save ideas that spark something, and commit to
                one. That choice unlocks the rest of the app — we’ll walk you
                through setting up shop, step by step.
              </ThemedText>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">The feed is coming</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              This is where the algorithm lives — trending product sources,
              personalized to you. Next build.
            </ThemedText>
          </View>
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
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  header: { paddingVertical: Spacing.three, gap: Spacing.one },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
