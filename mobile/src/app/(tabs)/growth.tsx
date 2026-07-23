// Growth: the paid tier. A feed of coached community posts — where this
// business's next customers already gather. Each community is an accordion
// card: image + one-line teaser collapsed; tap to expand the full profile
// (overview, what they talk about, buyer likes/dislikes, house rules, the
// play, Explore) in place.
//
// v1 billing stance (see DESIGN.md): no live paywall yet — early testers
// get it free, and the banner says so. The hard lock arrives with billing.
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  UIManager,
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
import type { GrowthPostDetail } from '@/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const splitLines = (text: string) =>
  text.split('\n').map((l) => l.trim()).filter(Boolean);

export default function GrowthScreen() {
  const theme = useTheme();
  const { mode, activeBusiness } = useAppData();

  const [posts, setPosts] = useState<GrowthPostDetail[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const sectionBlock = (title: string, children: ReactNode) => (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );

  const bulletList = (text: string, mark: string, markColor?: string) => (
    <View style={styles.list}>
      {splitLines(text).map((item, i) => (
        <View key={i} style={styles.listRow}>
          <ThemedText type="small" style={[styles.listMark, markColor ? { color: markColor } : null]}>
            {mark}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.listText}>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );

  const renderCard = ({ item }: { item: GrowthPostDetail }) => {
    const style = platformStyle(item.platform);
    const members = formatMembers(item.memberCount);
    const isOpen = expanded.has(item.id);

    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <Pressable accessibilityRole="button" onPress={() => toggle(item.id)}>
          {/* Hero: real image if we have one, else the platform-color block. */}
          {item.imageUrl ? (
            <View style={styles.heroImageWrap}>
              <Image source={item.imageUrl} style={styles.heroImage} contentFit="cover" transition={200} />
              <View style={styles.heroChipsOverlay}>
                <View style={[styles.chip, { backgroundColor: style.color }]}>
                  <ThemedText type="smallBold" style={styles.chipText}>{item.platform}</ThemedText>
                </View>
                <View style={styles.chipDark}>
                  <ThemedText type="small" style={styles.chipText}>
                    {KIND_LABELS[item.kind] ?? item.kind}
                  </ThemedText>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.heroColor, { backgroundColor: style.color }]}>
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
          )}

          <View style={styles.cardBody}>
            <View style={styles.cardHeadRow}>
              <View style={styles.cardHeadText}>
                <ThemedText type="smallBold" style={styles.cardTitle}>{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{item.tagline}</ThemedText>
                {members ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.members}>{members}</ThemedText>
                ) : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.chevron}>
                {isOpen ? '▲' : '▼'}
              </ThemedText>
            </View>
          </View>
        </Pressable>

        {isOpen ? (
          <View style={styles.expanded}>
            {item.overview.split(/\n\s*\n/).map((para, i) => (
              <ThemedText key={i} type="small" style={styles.para}>{para.trim()}</ThemedText>
            ))}

            <View style={[styles.audienceCard, { backgroundColor: theme.background }]}>
              <ThemedText type="smallBold">Who you’ll find here</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{item.audience}</ThemedText>
            </View>

            {sectionBlock('What they talk about', bulletList(item.discussions, '•'))}
            {sectionBlock('What wins them over', bulletList(item.loves, '✓', theme.success))}
            {sectionBlock('What turns them off', bulletList(item.dislikes, '✕', theme.danger))}
            {sectionBlock('House rules', bulletList(item.rules, '§'))}

            <View style={[styles.approachCard, { backgroundColor: theme.background, borderColor: theme.accent }]}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>The play</ThemedText>
              <ThemedText type="small">{item.approach}</ThemedText>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => void WebBrowser.openBrowserAsync(item.url)}
              style={[styles.explore, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                Explore {item.title} ↗
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
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
  heroImageWrap: { height: 160, width: '100%' },
  heroImage: { height: 160, width: '100%' },
  heroChipsOverlay: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  heroColor: {
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
  chipDark: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: { color: '#ffffff', fontSize: 12, lineHeight: 16 },
  cardBody: { padding: Spacing.three },
  cardHeadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  cardHeadText: { flex: 1, gap: Spacing.half },
  cardTitle: { fontSize: 18, lineHeight: 24 },
  members: { marginTop: Spacing.half },
  chevron: { paddingTop: Spacing.half },
  expanded: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  para: { marginTop: Spacing.two, lineHeight: 21 },
  audienceCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    marginVertical: Spacing.two,
  },
  section: { marginTop: Spacing.three, gap: Spacing.two },
  sectionTitle: { fontSize: 16 },
  list: { gap: Spacing.two },
  listRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  listMark: { width: 16, textAlign: 'center' },
  listText: { flex: 1 },
  approachCard: {
    marginTop: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  explore: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    paddingVertical: 16,
    alignItems: 'center',
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
