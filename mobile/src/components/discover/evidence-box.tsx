// The expanded evidence: what was measured, when, and by whom.
//
// Two boxes. "Demand right now" is the marketplace picture; "Why this one"
// is the ad picture, and it never paraphrases an ad — it links to the
// snapshot and names the advertiser so the reader can go and look.
//
// Nothing here branches on Meta-versus-bench for its layout. Both fill the
// same fields, so if Meta access never arrives the hand-logged version reads
// identically and only the footer changes.
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { compact, daysSincePolled } from '@/lib/catalog';
import type { DiscoverEvidence } from '@/types';

export function EvidenceBox({ evidence }: { evidence: DiscoverEvidence | null }) {
  const theme = useTheme();

  if (!evidence) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.none}>
        No hard numbers on this one yet — it's here on judgement, not evidence.
      </ThemedText>
    );
  }

  const stale = daysSincePolled(evidence.polledAt);
  const hasMarket =
    evidence.unitsSold !== null ||
    evidence.listings !== null ||
    evidence.priceLow !== null ||
    evidence.interest !== null;
  const hasAds = evidence.adDaysLive !== null || evidence.adCount !== null;

  return (
    <View style={styles.wrap}>
      {hasMarket ? (
        <View style={[styles.box, { backgroundColor: theme.backgroundSelected }]}>
          <View style={styles.head}>
            <Icon name="chart" size={16} color={theme.textSecondary} />
            <ThemedText type="smallBold">
              Demand right now{evidence.heat !== null ? ` · heat ${evidence.heat}` : ''}
            </ThemedText>
            {evidence.heatDelta !== null && evidence.heatDelta !== 0 ? (
              <ThemedText
                type="smallBold"
                style={{ color: evidence.heatDelta > 0 ? theme.customer : theme.textSecondary }}>
                {evidence.heatDelta > 0 ? '+' : ''}
                {evidence.heatDelta}
              </ThemedText>
            ) : null}
          </View>

          {evidence.unitsSold !== null ? (
            <Row label="Units sold" value={compact(evidence.unitsSold)} />
          ) : null}
          {evidence.listings !== null ? (
            <Row
              label="Competing sellers"
              value={`${compact(evidence.listings)}${evidence.saturation ? ` · ${evidence.saturation}` : ''}`}
            />
          ) : null}
          {evidence.priceLow !== null ? (
            <Row
              label="Sourcing price"
              value={
                evidence.priceHigh && evidence.priceHigh !== evidence.priceLow
                  ? `$${evidence.priceLow.toFixed(2)}–${evidence.priceHigh.toFixed(2)}`
                  : `$${evidence.priceLow.toFixed(2)}`
              }
            />
          ) : null}
          {evidence.interest !== null ? (
            <Row
              label="People reading about it"
              value={
                `${compact(evidence.interest)}/day` +
                (evidence.interestTrend !== null
                  ? `  ${evidence.interestTrend >= 1 ? '+' : ''}${Math.round((evidence.interestTrend - 1) * 100)}%`
                  : '')
              }
            />
          ) : null}

          {evidence.sources.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.foot}>
              {evidence.sources.join(', ')}
              {stale !== null ? ` · checked ${stale === 0 ? 'today' : `${stale}d ago`}` : ''}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {hasAds ? (
        <View style={[styles.box, { backgroundColor: theme.backgroundSelected }]}>
          <View style={styles.head}>
            <Icon name="flame" size={16} color={theme.engaged} />
            <ThemedText type="smallBold">Why this one</ThemedText>
          </View>

          {evidence.adDaysLive !== null ? (
            <ThemedText type="small">
              An ad has been running for {evidence.adDaysLive} days
              {evidence.adAdvertiser ? ` by ${evidence.adAdvertiser}` : ''}.
            </ThemedText>
          ) : null}
          {evidence.adCount !== null && evidence.adCount > 1 ? (
            <Row label="Live creatives" value={String(evidence.adCount)} />
          ) : null}
          {evidence.adReach !== null ? (
            <Row label="People reached" value={compact(evidence.adReach)} />
          ) : null}

          {evidence.adEvidenceUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(evidence.adEvidenceUrl!)}
              style={styles.link}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                See the ad
              </ThemedText>
              <Icon name="out" size={16} color={theme.accent} />
            </Pressable>
          ) : null}

          <ThemedText type="small" themeColor="textSecondary" style={styles.foot}>
            {/* Meta's non-political data is EU-reach only. Saying so is the
                difference between a leading indicator and a false claim. */}
            {evidence.adCoverage === 'EU' ? 'EU-reaching ads' : 'Ad activity'}
            {evidence.adSource === 'manual' ? ' · logged by hand' : ''}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold" style={styles.value}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  none: { fontStyle: 'italic' },
  box: { borderRadius: Spacing.two + 4, padding: Spacing.three, gap: Spacing.one },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  value: { fontVariant: ['tabular-nums'] },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingTop: Spacing.one },
  foot: { fontSize: 12, paddingTop: Spacing.half },
});
