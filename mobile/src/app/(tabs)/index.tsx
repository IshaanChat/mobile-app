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
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getInterests } from '@/lib/prefs';
import { useAppData } from '@/state/app-data';
import type { DiscoverProduct, TrendsPayload } from '@/types';

/**
 * One row of filters, three chips, each a toggle. This replaces the previous
 * two-row control set (By niche / Trending, then All / Maker / Reseller /
 * Both) to match the prototype, which is the design being shipped.
 *
 * "Seller" rather than "Reseller", and no "Both" chip: a `both` niche is
 * badged Maker on the card, so giving it its own chip put cards reading
 * "Maker" inside a list the user had filtered to something else — the label
 * and the section contradicting each other on screen. Maker now means
 * `maker` or `both`, matching the badge.
 */
const FILTERS = [
  { key: 'reseller', label: 'Seller' },
  { key: 'maker', label: 'Maker' },
  { key: 'saved', label: 'Saved' },
] as const;

type Filter = (typeof FILTERS)[number]['key'];

export default function DiscoverScreen() {
  const theme = useTheme();
  const { activeBusiness } = useAppData();

  const [filter, setFilter] = useState<Filter | null>(null);
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
      // Always the sectioned payload, and never an audience filter on the
      // request. The prototype filters in place so the shelves stay put and a
      // chip is instant; refetching per chip would rebuild the feed and lose
      // scroll position for a filter the client can already apply.
      const payload = await api.getTrends({
        ...(activeBusiness ? { businessId: activeBusiness.id } : {}),
        ...(interests?.length ? { interests } : {}),
        sort: 'niche',
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the feed.');
    }
  }, [activeBusiness]);

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

  /**
   * What counts as hot: the top fifth of whatever is loaded.
   *
   * A percentile rather than a fixed number, because hotness is not one
   * scale. Curated rows carry machine-measured heat in the 8–55 range while
   * sourced rows carry a criteria-fit score in the 80s, so any constant would
   * either flame every sourced product and none of the curated ones, or the
   * reverse. A percentile at least means "hot" always describes the same
   * *proportion* of the feed — the underlying two-scales problem is still
   * open and still worth fixing at the source.
   */
  const hotFloor = useMemo(() => {
    if (!data?.products.length) return Infinity;
    const heats = data.products.map((p) => p.hotness).sort((a, b) => a - b);
    return heats[Math.floor(heats.length * 0.8)];
  }, [data]);

  const sections = useMemo(() => {
    if (!data) return [];

    // Saving takes a product *out* of the browsing feed and puts it on the
    // Saved chip. The feed shrinks as you triage, so a long catalogue ends
    // rather than repeating — and Saved is a shelf you chose, not a copy.
    const visible = data.products.filter((p) => {
      if (filter === 'saved') return p.saved;
      if (p.saved) return false;
      if (!filter) return true;
      const aud = p.niche?.audience;
      // Follows the badge, not the raw audience: `both` is badged Maker.
      return filter === 'maker' ? aud === 'maker' || aud === 'both' : aud === filter;
    });

    // Saved is a flat shelf — domain headings over a handful of hand-picked
    // rows read as filing, not as browsing.
    if (filter === 'saved' || data.sections.length === 0) {
      return visible.length ? [{ title: '', data: visible }] : [];
    }
    const byId = new Map(visible.map((p) => [p.id, p]));
    return data.sections
      .map((s) => ({
        title: s.title,
        data: s.productIds.map((id) => byId.get(id)).filter((p): p is DiscoverProduct => Boolean(p)),
      }))
      // A shelf whose products all got filtered out shouldn't leave its
      // header stranded above empty space.
      .filter((s) => s.data.length > 0);
  }, [data, filter]);

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
                  Somebody is already selling all of this. Here is what it costs them.
                </ThemedText>

                <View style={styles.controls}>
                  {FILTERS.map((f) => {
                    const on = f.key === filter;
                    const label =
                      f.key === 'saved' && savedCount > 0 ? `Saved · ${savedCount}` : f.label;
                    return (
                      <Pressable
                        key={f.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        // Tapping the active chip clears it. Every chip is a
                        // toggle, so there is always a way back to the whole
                        // feed without hunting for an "All" that isn't there.
                        onPress={() => setFilter(on ? null : f.key)}
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
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
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
            renderItem={({ item }) => (
              <ProductCard product={item} onToggleSave={toggleSave} hotFloor={hotFloor} />
            )}
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
                ) : filter === 'saved' ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                    Nothing saved yet — tap the heart on a product and it lands here.
                  </ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                    Nothing matched exactly — browse everything, something will click.
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
