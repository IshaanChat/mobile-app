// Business: how the business is actually doing. Three panes behind one
// tab — Overview to look at, Clients and Money to work in.
//
// They're sub-tabs rather than three separate tabs because they're all the
// same question ("how am I doing?") asked at different zoom levels, and the
// bottom row only has room for the four places worth living in.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClientsPane } from '@/components/business/clients';
import { MoneyPane } from '@/components/business/money';
import { OverviewPane } from '@/components/business/overview';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Pane = 'overview' | 'clients' | 'money';

const PANES: { key: Pane; label: string; icon: IconName }[] = [
  { key: 'overview', label: 'Overview', icon: 'chart' },
  { key: 'clients', label: 'Clients', icon: 'book' },
  { key: 'money', label: 'Money', icon: 'note' },
];

export default function BusinessScreen() {
  // Overview's quick actions deep-link straight into a pane.
  const { pane: initial } = useLocalSearchParams<{ pane?: string }>();
  const [pane, setPane] = useState<Pane>(
    PANES.some((p) => p.key === initial) ? (initial as Pane) : 'overview',
  );
  const theme = useTheme();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <View style={styles.body}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subtabs}>
            {PANES.map((p) => {
              const on = p.key === pane;
              return (
                <Pressable
                  key={p.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPane(p.key)}
                  style={[
                    styles.subtab,
                    {
                      borderColor: on ? theme.accent : theme.border,
                      backgroundColor: on ? theme.accentSoft : theme.backgroundElement,
                    },
                  ]}>
                  <Icon name={p.icon} size={16} color={on ? theme.accent : theme.textSecondary} />
                  <ThemedText type={on ? 'smallBold' : 'small'} themeColor={on ? 'text' : 'textSecondary'}>
                    {p.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {pane === 'overview' ? <OverviewPane /> : null}
          {pane === 'clients' ? <ClientsPane /> : null}
          {pane === 'money' ? <MoneyPane /> : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  body: { flex: 1, width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  subtabs: { gap: Spacing.two, paddingVertical: Spacing.three },
  subtab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
