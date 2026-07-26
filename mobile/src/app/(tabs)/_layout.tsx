import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ColorValue, Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { JourneySheet } from '@/components/journey-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/top-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppData } from '@/state/app-data';

// The active tab draws a touch heavier rather than filling in — the set is
// one stroke weight, so weight is the only emphasis it can carry.
function icon(name: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={name} size={24} color={color as string} strokeWidth={focused ? 2 : 1.7} />
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { mode, error, refresh } = useAppData();
  const [journeyOpen, setJourneyOpen] = useState(false);

  if (mode === 'loading') {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary">
          Warming up… (the free server naps when idle)
        </ThemedText>
      </ThemedView>
    );
  }

  if (mode === 'error') {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="smallBold">Couldn’t load your account</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
          {error}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refresh()}
          style={[styles.retry, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={{ color: theme.accentText }}>
            Try again
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (mode === 'onboarding') return <Redirect href="/onboarding" />;

  // Four tabs, and Journey is not one of them — it's a sheet the top bar
  // opens, so the bottom row stays the four places you actually live in.
  return (
    <>
      <Tabs
        screenOptions={{
          header: () => <TopBar onOpenJourney={() => setJourneyOpen(true)} />,
          tabBarShowLabel: true,
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Discover', tabBarIcon: icon('compass') }} />
        <Tabs.Screen name="grow" options={{ title: 'Grow', tabBarIcon: icon('sprout') }} />
        <Tabs.Screen name="business" options={{ title: 'Business', tabBarIcon: icon('chart') }} />
        <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: icon('user') }} />
      </Tabs>
      <JourneySheet open={journeyOpen} onClose={() => setJourneyOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  errorText: { textAlign: 'center' },
  retry: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
