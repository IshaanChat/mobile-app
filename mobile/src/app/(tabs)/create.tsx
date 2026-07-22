// Create (+): quick logging, Instagram-post-fast. Each action becomes a
// real flow in the next build phase; explorers see why it's locked.
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppData } from '@/state/app-data';

const ACTIONS = [
  { key: 'sale', emoji: '💸', title: 'Log a sale', hint: 'Money in, stock down, missions up' },
  { key: 'client', emoji: '🤝', title: 'Add a client', hint: 'Paste a link — we detect the channel' },
  { key: 'touch', emoji: '💬', title: 'Log an interaction', hint: 'Keep the relationship score honest' },
] as const;

export default function CreateScreen() {
  const theme = useTheme();
  const { mode } = useAppData();
  const locked = mode === 'explorer';

  const onPress = (title: string) => {
    if (locked) {
      Alert.alert(
        'First things first',
        'Find your product in Discover — once your business exists, logging lives here.'
      );
    } else {
      Alert.alert(title, 'This flow arrives in the next build.');
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Create</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {locked
                ? 'These unlock once you’ve picked your product.'
                : 'Thirty seconds, tops.'}
            </ThemedText>
          </View>

          {ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              accessibilityRole="button"
              onPress={() => onPress(a.title)}
              style={[
                styles.card,
                { backgroundColor: theme.backgroundElement, opacity: locked ? 0.55 : 1 },
              ]}>
              <ThemedText style={styles.emoji}>{a.emoji}</ThemedText>
              <View style={styles.cardText}>
                <ThemedText type="smallBold">{a.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{a.hint}</ThemedText>
              </View>
            </Pressable>
          ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  emoji: { fontSize: 28, lineHeight: 34 },
  cardText: { flex: 1, gap: Spacing.half },
});
