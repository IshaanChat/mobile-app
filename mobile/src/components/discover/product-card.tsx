// A Discover card: photo, who it suits, what it costs, what it sells for.
// Tapping opens the case for it and the sourcing link.
//
// The economics line is the whole pitch — cost on the left, resale on the
// right, arrow between. Everything else on the collapsed card exists to let
// someone skip it quickly.
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { EvidenceBox } from '@/components/discover/evidence-box';
import { EvidenceStrip } from '@/components/discover/evidence-strip';
import { HeroChip } from '@/components/discover/hero-chip';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AUDIENCE_COLORS, AUDIENCE_LABELS, SOURCING_LABELS } from '@/lib/catalog';
import type { DiscoverProduct } from '@/types';

export function ProductCard({
  product,
  onToggleSave,
}: {
  product: DiscoverProduct;
  onToggleSave: (p: DiscoverProduct) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const audience = product.niche?.audience;

  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}>
        <View style={[styles.hero, { backgroundColor: theme.backgroundSelected }]}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : null}

          <View style={styles.heroTop}>
            <EvidenceStrip evidence={product.evidence} />
          </View>

          <View style={styles.heroBottom}>
            {audience ? (
              <HeroChip label={AUDIENCE_LABELS[audience]} color={AUDIENCE_COLORS[audience]} />
            ) : null}
            {product.sourcingType ? <HeroChip label={SOURCING_LABELS[product.sourcingType]} /> : null}
          </View>
        </View>

        <View style={styles.body}>
          {product.niche ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
              {product.niche.name.toUpperCase()}
            </ThemedText>
          ) : null}
          <ThemedText type="smallBold" style={styles.title}>{product.title}</ThemedText>

          <View style={styles.econRow}>
            <View style={styles.econ}>
              {product.sourceCost ? (
                <ThemedText type="small" themeColor="textSecondary">{product.sourceCost}</ThemedText>
              ) : null}
              {product.sourceCost && product.typicalResale ? (
                <ThemedText type="small" themeColor="textSecondary">→</ThemedText>
              ) : null}
              {product.typicalResale ? (
                <ThemedText type="smallBold" style={{ color: theme.customer }}>
                  {product.typicalResale}
                </ThemedText>
              ) : null}
            </View>
            <Icon
              name="chev"
              size={16}
              color={theme.textSecondary}
              strokeWidth={1.9}
              rotate={open ? 180 : 0}
            />
          </View>
        </View>
      </Pressable>

      {/* A sibling of the main Pressable, not a child: Android swallows the
          inner press of nested pressables and the heart stops working. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={product.saved ? 'Remove from your shelf' : 'Save to your shelf'}
        hitSlop={10}
        onPress={() => onToggleSave(product)}
        style={styles.save}>
        <Icon
          name="heart"
          size={17}
          color={product.saved ? theme.accent : '#FFFFFF'}
          filled={product.saved}
        />
      </Pressable>

      {open ? (
        <View style={[styles.expand, { borderTopColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">{product.blurb}</ThemedText>

          <EvidenceBox evidence={product.evidence} />

          {product.sourceName ? (
            <View style={styles.where}>
              <ThemedText type="small" themeColor="textSecondary">Where to source</ThemedText>
              <ThemedText type="small">
                {product.sourceName}
                {product.sourcingType ? ` · ${SOURCING_LABELS[product.sourcingType]}` : ''}
              </ThemedText>
            </View>
          ) : null}

          {product.sourcingUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(product.sourcingUrl!)}
              style={[styles.ghost, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">Source it</ThemedText>
              <Icon name="out" size={16} color={theme.text} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, borderWidth: 1, overflow: 'hidden' },
  hero: { height: 168, justifyContent: 'space-between', padding: Spacing.two },
  heroTop: { flexDirection: 'row' },
  heroBottom: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  body: { padding: Spacing.three, gap: Spacing.half },
  kicker: { fontSize: 11, letterSpacing: 0.6 },
  title: { fontSize: 17, lineHeight: 23 },
  econRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  econ: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  save: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,16,18,0.55)',
  },
  expand: { borderTopWidth: 1, padding: Spacing.three, gap: Spacing.three },
  where: { gap: Spacing.half },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.two + 2,
  },
});
