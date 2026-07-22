import { Redirect, Tabs } from 'expo-router';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { ActivityIndicator, ColorValue, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppData } from '@/state/app-data';

function icon(name: SFSymbol) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={name} tintColor={color as string} style={styles.icon} />
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { mode, error, refresh } = useAppData();

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

  // Instagram-style: icons only, no labels.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('house.fill') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('safari.fill') }} />
      <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: icon('plus.app.fill') }} />
      <Tabs.Screen
        name="growth"
        options={{ title: 'Growth', tabBarIcon: icon('chart.line.uptrend.xyaxis') }}
      />
      <Tabs.Screen
        name="business"
        options={{ title: 'Business', tabBarIcon: icon('person.crop.circle.fill') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { width: 26, height: 26 },
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
