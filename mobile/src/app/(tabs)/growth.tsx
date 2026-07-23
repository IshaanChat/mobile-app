// Growth: the paid tier. A feed of coached community posts — where this
// business's next customers already gather. Big image-led cards; tapping
// opens the blog-post detail (growth/[id]).
//
// v1 billing stance (see DESIGN.md): no live paywall yet — early testers
// get it free, and the banner says so. The hard lock arrives with billing.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMembers, KIND_LABELS, platformStyle } from '@/lib/platforms';
import { useAppData } from '@/state/app-data';
import type { GrowthPost } from '@/types';

export default function GrowthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { mode, activeBusiness } = useAppData();

  const [posts, setPosts] = useState<GrowthPost[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusiness) return;
    setError(null);
    try {
      const payload = await api.getGrowth(activeBusiness.id);
      setPosts(payload.posts);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    }
  }, [activeBusiness]);

  useEffect(() => {
    void load();
  }, [load]);

  // Explorers haven't set up shop yet — Growth needs a business to aim at.
  if (mode === 'explorer') {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <View style={[styles.body, styles.centered]}>
            <ThemedText style={styles.bigEmoji}>🧭</ThemedText>
            <ThemedText type="subtitle" style={styles.centerText}>Growth comes after the idea</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Once you’ve committed to a product in Discover and set up shop,
              Growth shows you exactly where your customers gather.
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const renderCard = ({ item }: { item: GrowthPost }) => {
    const style = platformStyle(item.platform);
    const members = formatMembers(item.memberCount);
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/growth/[id]', params: { id: item.id } })}
        style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.cardHero, { backgroundColor: style.color }]}>
          <ThemedText style={styles.heroEmoji}>{style.emoji}</ThemedText>
          <View style={styles.heroChips}>
            <View style={styles.chip}>
              <ThemedText type="smallBold" style={styles.chipText}>{item.platform}</ThemedText>
            </View>
            <View style={styles.chip}>
              <ThemedText type="small" style={styles.chipText}>
                {KIND_LABELS[item.kind] ?? item.kind}
              </ThemedText>
            </View>
          </View>
        </View>
        <View style={styles.cardBody}>
          <ThemedText type="smallBold" style={styles.cardTitle}>{item.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{item.tagline}</ThemedText>
          <View style={styles.cardFooter}>
            {members ? (
              <ThemedText type="small" themeColor="textSecondary">{members}</ThemedText>
            ) : <View />}
            <ThemedText type="smallBold" style={{ color: theme.accent }}>Read the play →</ThemedText>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <FlatList
            data={posts ?? []}
            keyExtractor={(p) => p.id}
            renderItem={renderCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
                tintColor={theme.textSecondary}
              />
            }
            ListHeaderComponent={
              <View style={styles.header}>
                <ThemedText type="subtitle">Growth</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Where {activeBusiness?.name ?? 'your business'} finds its next customers.
                </ThemedText>
                <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    🔓 $5/month at launch — free while you’re an early tester.
                  </ThemedText>
                </View>
              </View>
            }
            ListEmptyComponent={
              error ? (
                <View style={styles.centered}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                    {error}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void load()}
                    style={[styles.retry, { backgroundColor: theme.accent }]}>
                    <ThemedText type="smallBold" style={{ color: theme.accentText }}>Try again</ThemedText>
                  </Pressable>
                </View>
              ) : posts === null ? (
                <View style={styles.centered}>
                  <ActivityIndicator color={theme.accent} />
                </View>
              ) : (
                <View style={styles.centered}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                    No communities yet — content is on its way.
                  </ThemedText>
                </View>
              )
            }
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  body: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  header: { paddingVertical: Spacing.three, gap: Spacing.one },
  banner: {
    marginTop: Spacing.two,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    marginBottom: Spacing.three,
  },
  cardHero: {
    height: 120,
    padding: Spacing.three,
    justifyContent: 'space-between',
  },
  heroEmoji: { fontSize: 40, lineHeight: 48 },
  heroChips: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: { color: '#ffffff', fontSize: 12, lineHeight: 16 },
  cardBody: { padding: Spacing.three, gap: Spacing.one },
  cardTitle: { fontSize: 18, lineHeight: 24 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  centerText: { textAlign: 'center' },
  bigEmoji: { fontSize: 44, lineHeight: 52 },
  retry: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
