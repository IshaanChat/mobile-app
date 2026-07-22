// Home: the feed. Real cards (network pulse, money, going-quiet, activity)
// land in the next build phase — this shell proves the mode-aware layout.
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppData } from '@/state/app-data';

export default function HomeScreen() {
  const theme = useTheme();
  const { mode, profile, activeBusiness } = useAppData();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.header}>
            <ThemedText type="smallBold" style={styles.brand}>
              🔧 Sales Mechanic
            </ThemedText>
          </View>

          {mode === 'explorer' ? (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Hey {profile?.name ?? 'there'} 👋</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your journey starts in Discover — find a product worth selling and
                we’ll guide you from idea to first sale.
              </ThemedText>
              <Link href="/discover">
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Start exploring →
                </ThemedText>
              </Link>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{activeBusiness?.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your feed is on its way: network pulse, money, who’s going quiet,
                and today’s missions — as cards, not spreadsheets.
              </ThemedText>
            </View>
          )}
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
  header: { paddingVertical: Spacing.three },
  brand: { fontSize: 18 },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
