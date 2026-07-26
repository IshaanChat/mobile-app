// Business → Overview: the dashboard, matching the prototype's shape.
//
// Four numbers and three lists, and nothing you can act on directly. The
// web client's HomeTab (which this replaced) also carried a greeting, quick
// actions, the next mission and full Money/Shelf cards — but those all now
// live where they belong: money and the shelf in the Money pane, the next
// mission in the Journey sheet. Overview answers "how am I doing", once.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCoolingOffDays } from '@/lib/prefs';
import { daysSince, money, STATUS_META, timeAgo } from '@/lib/status-meta';
import { useAppData } from '@/state/app-data';
import type {
  Contact, ContactStatus, FeedInteraction, MissionsPayload, PaymentsPayload, ProductsPayload,
} from '@/types';

export function OverviewPane() {
  const theme = useTheme();
  const router = useRouter();
  const { mode, activeBusiness } = useAppData();

  const [payments, setPayments] = useState<PaymentsPayload | null>(null);
  const [products, setProducts] = useState<ProductsPayload | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [feed, setFeed] = useState<FeedInteraction[] | null>(null);
  const [missions, setMissions] = useState<MissionsPayload | null>(null);
  const [coolingOff, setCoolingOff] = useState(7);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeBusiness) return;
    const id = activeBusiness.id;
    // Each card degrades on its own — one failing endpoint shouldn't blank
    // the whole dashboard.
    await Promise.all([
      api.getPayments(id).then(setPayments).catch(() => {}),
      api.getProducts(id).then(setProducts).catch(() => {}),
      api.getGraph(id).then((g) => setContacts(g.contacts)).catch(() => {}),
      api.getActivityFeed(id, 3).then(setFeed).catch(() => {}),
      api.getMissions(id).then(setMissions).catch(() => {}),
      getCoolingOffDays().then(setCoolingOff).catch(() => {}),
    ]);
  }, [activeBusiness]);

  useEffect(() => {
    void load();
  }, [load]);

  const { needsAttention, topContacts } = useMemo(() => {
    const list = contacts ?? [];
    const needsAttention = list
      .map((c) => ({ contact: c, days: daysSince(c.lastInteractionAt) }))
      .filter(({ days }) => days === null || days >= coolingOff)
      .sort((a, b) => b.contact.relationshipStrength - a.contact.relationshipStrength)
      .slice(0, 4);

    const topContacts = [...list]
      .sort((a, b) => b.relationshipStrength - a.relationshipStrength)
      .filter((c) => c.relationshipStrength > 0)
      .slice(0, 3);

    return { needsAttention, topContacts };
  }, [contacts, coolingOff]);

  // Explorers have no business yet — this is an invitation, not a dashboard.
  if (mode === 'explorer') {
    return (
      <View style={styles.pane}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="smallBold">Nothing to measure yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your journey starts in Discover — find a product worth selling and
            we’ll guide you from idea to first sale.
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.pane}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
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
      }>
      <View style={styles.grid}>
        <StatCard value={contacts === null ? '—' : String(contacts.length)} label="people in your book" />
        <StatCard
          value={payments === null ? '—' : money(payments.summary.total)}
          label="all-time revenue"
          color={theme.customer}
        />
        <StatCard
          value={products === null ? '—' : String(products.summary.count)}
          label="listings on the shelf"
        />
        <StatCard
          value={missions === null ? '—' : String(missions.summary.level)}
          label={missions?.summary.levelName ?? 'level'}
          color={theme.accent}
        />
      </View>

      <Card
        icon="flame"
        title="Who needs you"
        action={{ label: 'Open →', onPress: () => router.push('/business?pane=clients') }}>
        {needsAttention.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            You’re on top of everyone. Nothing’s going cold.
          </ThemedText>
        ) : (
          needsAttention.map(({ contact, days }) => (
            <View key={contact.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.rowMain}>
                <View style={styles.nameRow}>
                  <View style={[styles.dot, { backgroundColor: theme[STATUS_META[contact.status].color] }]} />
                  <ThemedText type="small">{contact.name}</ThemedText>
                </View>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {days === null ? 'never contacted' : `${days}d quiet`}
              </ThemedText>
            </View>
          ))
        )}
      </Card>

      <Card icon="spark" title="Recent moves">
        {!feed || feed.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No activity yet — log your first interaction and the story starts here.
          </ThemedText>
        ) : (
          feed.map((i) => (
            <View key={i.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.rowMain}>
                <ThemedText type="small">
                  {i.contact.name} · {i.type.toLowerCase()}
                </ThemedText>
                {i.note ? (
                  <ThemedText type="small" themeColor="textSecondary">{i.note}</ThemedText>
                ) : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary">{timeAgo(i.occurredAt)}</ThemedText>
            </View>
          ))
        )}
      </Card>

      {topContacts.length > 0 ? (
        <Card icon="trophy" title="Strongest relationships">
          {topContacts.map((c, i) => (
            <View key={c.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.nameRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.rank}>{i + 1}</ThemedText>
                <ThemedText type="small">{c.name}</ThemedText>
              </View>
              <ThemedText type="smallBold" style={[styles.strength, { color: theme.customer }]}>
                {Math.round(c.relationshipStrength)}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText style={[styles.statValue, color ? { color } : null]}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

function Card({
  icon, title, action, children,
}: {
  icon: IconName;
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.cardHead}>
        <View style={styles.cardTitleRow}>
          <Icon name={icon} size={16} color={theme.textSecondary} />
          <ThemedText type="smallBold" style={styles.cardTitle}>{title}</ThemedText>
        </View>
        {action ? (
          <ThemedText type="small" style={{ color: theme.accent }} onPress={action.onPress}>
            {action.label}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1 },
  scroll: { paddingBottom: Spacing.six, gap: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stat: {
    // Two up, and they stay two up on a wider screen — four across turns
    // the numbers into a readout rather than something you take in.
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  statValue: { fontSize: 24, fontWeight: '800', lineHeight: 30, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12 },
  card: { borderRadius: Spacing.three, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardTitle: { fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rank: { fontSize: 12, minWidth: 10 },
  dot: { width: 7, height: 7, borderRadius: 999 },
  strength: { fontVariant: ['tabular-nums'] },
});
