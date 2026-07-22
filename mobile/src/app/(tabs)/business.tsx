// Business: profile, business switcher, settings, sign out. Full editing
// ports over in a later phase; this covers identity and session basics.
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMaybeSignOut } from '@/lib/auth';
import { useAppData } from '@/state/app-data';

export default function BusinessScreen() {
  const theme = useTheme();
  const signOut = useMaybeSignOut();
  const { profile, businesses, activeBusiness, switchBusiness, mode } = useAppData();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{profile?.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{profile?.email}</ThemedText>
          </View>

          {mode === 'explorer' ? (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">No business yet — on purpose</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You’re exploring. When you commit to a product in Discover,
                your business gets set up right here.
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Your businesses</ThemedText>
              {businesses.map((b) => {
                const active = b.id === activeBusiness?.id;
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="button"
                    onPress={() => switchBusiness(b.id)}
                    style={[
                      styles.bizRow,
                      { backgroundColor: active ? theme.backgroundSelected : 'transparent' },
                    ]}>
                    <ThemedText type="smallBold">{b.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {b.niche}{active ? '  ·  active' : ''}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}

          {signOut ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert('Sign out?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
                ])
              }
              style={[styles.signOut, { borderColor: theme.border }]}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                Sign out
              </ThemedText>
            </Pressable>
          ) : null}
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
  header: { paddingVertical: Spacing.three, gap: Spacing.half },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  bizRow: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  signOut: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
