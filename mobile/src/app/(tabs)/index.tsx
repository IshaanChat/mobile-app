// Discover: the app's front door. A catalog of products worth selling, with
// what each costs to source and what it sells for.
//
// Two layouts off one payload. "By niche" groups into domain shelves the way
// a shop does, which is how you browse when you don't know what you want.
// "Trending" is flat and ordered by what's climbing fastest, which is how you
// browse when you do. The server ranks once and sends both; sections index
// into the same product list, so switching costs nothing and the two can't
// disagree about a card.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { ProductCard } from '@/components/discover/product-card';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getInterests } from '@/lib/prefs';
import { useAppData } from '@/state/app-data';
import type { Audience, DiscoverProduct, TrendsPayload } from '@/types';

type Sort = 'niche' | 'trending';

const SORTS: { key: Sort; label: string; icon: IconName }[] = [
  { key: 'niche', label: 'By niche', icon: 'compass' },
  { key: 'trending', label: 'Trending', icon: 'flame' },
];

const AUDIENCES: { key: Audience | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'maker', label: 'Maker' },
  { key: 'reseller', label: 'Reseller' },
  { key: 'both', label: 'Both' },
];

export default function DiscoverScreen() {
  const theme = useTheme();
  const { activeBusiness } = useAppData();

  const [sort, setSort] = useState<Sort>('niche');
  const [audience, setAudience] = useState<Audience | 'all'>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [data, setData] = useState<TrendsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Explorers have no business to rank against, so their onboarding
      // interests stand in. Discover is their home screen — it has to work
      // before anything else exists.
      const interests = activeBusiness ? undefined : await getInterests();
      const payload = await api.getTrends({
        ...(activeBusiness ? { businessId: activeBusiness.id } : {}),
        ...(interests?.length ? { interests } : {}),
        sort,
        ...(audience !== 'all' ? { audience } : {}),
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the feed.');
    }
  }, [activeBusiness, sort, audience]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSave = useCallback(async (product: DiscoverProduct) => {
    const next = !product.saved;
    // Optimistic: the heart should answer instantly. Rolled back below if the
    // write fails, so it can't end up lying about what's on the shelf.
    setData((d) =>
      d ? { ...d, products: d.products.map((p) => (p.id === product.id ? { ...p, saved: next } : p)) } : d
    );
    try {
      if (next) await api.saveTrend(product.id);
      else await api.unsaveTrend(product.id);
    } catch {
      setData((d) =>
        d
          ? { ...d, products: d.products.map((p) => (p.id === product.id ? { ...p, saved: !next } : p)) }
          : d
      );
    }
  }, []);

  const sections = useMemo(() => {
    if (!data) return [];
    const visible = savedOnly ? data.products.filter((p) => p.saved) : data.products;

    if (data.sort === 'trending' || data.sections.length === 0) {
      return visible.length ? [{ title: '', data: visible }] : [];
    }
    const byId = new Map(visible.map((p) => [p.id, p]));
    return data.sections
      .map((s) => ({
        title: s.title,
        data: s.productIds.map((id) => byId.get(id)).filter((p): p is DiscoverProduct => Boolean(p)),
      }))
      // A shelf whose products all got filtered out shouldn't leave its
      // header stranded above nothing, which is what the prototype does.
      .filter((s) => s.data.length > 0);
  }, [data, savedOnly]);

  const savedCount = data?.products.filter((p) => p.saved).length ?? 0;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <View style={styles.body}>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
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
                <ThemedText type="subtitle" style={styles.h1}>Discover</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Products worth selling — and where to source them.
                </ThemedText>

                <View style={styles.controls}>
                  {SORTS.map((s) => {
                    const on = s.key === sort;
                    return (
                      <Pressable
                        key={s.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => setSort(s.key)}
                        style={[
                          styles.pill,
                          {
                            borderColor: on ? theme.accent : theme.border,
                            backgroundColor: on ? theme.accentSoft : theme.backgroundElement,
                          },
                        ]}>
                        <Icon name={s.icon} size={16} color={on ? theme.accent : theme.textSecondary} />
                        <ThemedText
                          type={on ? 'smallBold' : 'small'}
                          themeColor={on ? 'text' : 'textSecondary'}>
                          {s.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.controls}>
                  {AUDIENCES.map((a) => {
                    const on = a.key === audience && !savedOnly;
                    return (
                      <Pressable
                        key={a.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          setSavedOnly(false);
                          setAudience(a.key);
                        }}
                        style={[
                          styles.chip,
                          {
                            borderColor: on ? theme.accent : theme.border,
                            backgroundColor: on ? theme.accentSoft : 'transparent',
                          },
                        ]}>
                        <ThemedText
                          type={on ? 'smallBold' : 'small'}
                          themeColor={on ? 'text' : 'textSecondary'}>
                          {a.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: savedOnly }}
                    onPress={() => setSavedOnly((v) => !v)}
                    style={[
                      styles.chip,
                      {
                        borderColor: savedOnly ? theme.accent : theme.border,
                        backgroundColor: savedOnly ? theme.accentSoft : 'transparent',
                      },
                    ]}>
                    <ThemedText
                      type={savedOnly ? 'smallBold' : 'small'}
                      themeColor={savedOnly ? 'text' : 'textSecondary'}>
                      Saved{savedCount > 0 ? ` · ${savedCount}` : ''}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            }
            renderSectionHeader={({ section }) =>
              section.title ? (
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHead}>
                  {section.title.toUpperCase()}
                </ThemedText>
              ) : null
            }
            renderItem={({ item }) => <ProductCard product={item} onToggleSave={toggleSave} />}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                {error ? (
                  <>
                    <ThemedText type="smallBold">Couldn’t load Discover</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                      {error}
                    </ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void load()}
                      style={[styles.retry, { backgroundColor: theme.accent }]}>
                      <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                        Try again
                      </ThemedText>
                    </Pressable>
                  </>
                ) : data === null ? (
                  <ActivityIndicator color={theme.accent} />
                ) : savedOnly ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                    Nothing saved yet. Tap the heart on anything worth a second look.
                  </ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                    Nothing here for that filter yet.
                  </ThemedText>
                )}
              </View>
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
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  header: { paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  h1: { fontSize: 30, lineHeight: 38 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  sectionHead: { fontSize: 12, letterSpacing: 0.8, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  gap: { height: Spacing.three },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  centered: { textAlign: 'center' },
  retry: { borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
});
