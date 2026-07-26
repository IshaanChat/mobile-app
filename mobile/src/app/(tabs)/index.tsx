// Home: where the business stands today. Ported from the web client's
// HomeTab — greeting, next mission, and a stack of stat cards (network,
// money, the shelf, who needs you, recent moves) — restyled as a single
// mobile column in the artisan palette.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCoolingOffDays } from '@/lib/prefs';
import { daysSince, greeting, money, STATUS_META, timeAgo } from '@/lib/status-meta';
import { useAppData } from '@/state/app-data';
import type {
  Contact, ContactStatus, FeedInteraction, MissionsPayload, PaymentsPayload, ProductsPayload,
} from '@/types';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { mode, profile, activeBusiness } = useAppData();

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

  const { needsAttention, byStatus, topContacts } = useMemo(() => {
    const list = contacts ?? [];
    const byStatus: Record<ContactStatus, number> = { PROSPECT: 0, ENGAGED: 0, CUSTOMER: 0 };
    for (const c of list) byStatus[c.status]++;

    const needsAttention = list
      .map((c) => ({ contact: c, days: daysSince(c.lastInteractionAt) }))
      .filter(({ days }) => days === null || days >= coolingOff)
      .sort((a, b) => b.contact.relationshipStrength - a.contact.relationshipStrength)
      .slice(0, 4);

    const topContacts = [...list]
      .sort((a, b) => b.relationshipStrength - a.relationshipStrength)
      .filter((c) => c.relationshipStrength > 0)
      .slice(0, 3);

    return { needsAttention, byStatus, topContacts };
  }, [contacts, coolingOff]);

  // Explorers have no business yet — Home is an invitation, not a dashboard.
  if (mode === 'explorer') {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.body}>
            <View style={styles.brandRow}>
              <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
                <ThemedText style={styles.brandMarkText}>🔧</ThemedText>
              </View>
              <ThemedText type="smallBold" style={[styles.brandText, { color: theme.accent }]}>
                SALES MECHANIC
              </ThemedText>
            </View>
            <Card>
              <ThemedText type="smallBold">Hey {profile?.name?.split(' ')[0] ?? 'there'} 👋</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your journey starts in Discover — find a product worth selling and
                we’ll guide you from idea to first sale.
              </ThemedText>
              <Pressable accessibilityRole="button" onPress={() => router.push('/discover')}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Start exploring →
                </ThemedText>
              </Pressable>
            </Card>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const nextMission = missions?.missions.find((m) => !m.completed);
  const dateLine = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.body}
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
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.brandMarkText}>🔧</ThemedText>
            </View>
            <ThemedText type="smallBold" style={[styles.brandText, { color: theme.accent }]}>
              SALES MECHANIC
            </ThemedText>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.dateLine}>
            {dateLine.toUpperCase()}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.greeting}>
            {greeting()}, {profile?.name?.split(' ')[0] ?? 'there'} 👋
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Here’s where {activeBusiness?.name} stands.
          </ThemedText>

          {/* Quick actions */}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/create')}
              style={[styles.pill, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>+ New client</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/create')}
              style={[styles.pillGhost, { borderColor: theme.border }]}>
              <ThemedText type="small">💰 Record a sale</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/growth')}
              style={[styles.pillGhost, { borderColor: theme.border }]}>
              <ThemedText type="small">🔭 Find customers</ThemedText>
            </Pressable>
          </View>

          {/* Next mission */}
          {nextMission ? (
            <View style={[styles.card, styles.missionCard, { backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}>
              <ThemedText type="small" style={[styles.kicker, { color: theme.accent }]}>NEXT MISSION</ThemedText>
              <View style={styles.missionRow}>
                <View style={styles.missionText}>
                  <ThemedText type="smallBold">🎯 {nextMission.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {nextMission.description}
                    {nextMission.target > 1 ? ` (${nextMission.current}/${nextMission.target})` : ''}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  +{nextMission.xp}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {/* Your network */}
          <Card title="🤝 Your network">
            {contacts === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <>
                <View style={styles.stats}>
                  <BigStat value={String(contacts.length)} label={contacts.length === 1 ? 'person' : 'people'} />
                  {(['PROSPECT', 'ENGAGED', 'CUSTOMER'] as ContactStatus[]).map((s) => (
                    <BigStat
                      key={s}
                      value={String(byStatus[s])}
                      label={`${STATUS_META[s].emoji} ${STATUS_META[s].title.toLowerCase()}`}
                      color={theme[STATUS_META[s].color]}
                    />
                  ))}
                </View>
                {contacts.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Every business starts with one person who cared. Add yours.
                  </ThemedText>
                ) : null}
              </>
            )}
          </Card>

          {/* Money */}
          <Card title="💵 Money">
            {payments === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <>
                <View style={styles.stats}>
                  <BigStat value={money(payments.summary.thisMonth)} label="this month" color={theme.customer} />
                  <BigStat value={money(payments.summary.total)} label="all time" />
                  <BigStat
                    value={String(payments.summary.count)}
                    label={payments.summary.count === 1 ? 'payment' : 'payments'}
                  />
                </View>
                {payments.summary.count === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    The first dollar is the hardest — and the sweetest. Record it when it lands.
                  </ThemedText>
                ) : null}
              </>
            )}
          </Card>

          {/* The shelf */}
          <Card title="🏷️ The shelf">
            {products === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <>
                <View style={styles.stats}>
                  <BigStat
                    value={String(products.summary.count)}
                    label={products.summary.count === 1 ? 'listing' : 'listings'}
                  />
                  <BigStat value={money(products.summary.inventoryValue)} label="inventory value" />
                  {products.summary.lowStock > 0 ? (
                    <BigStat value={String(products.summary.lowStock)} label="running low ⚠️" color={theme.danger} />
                  ) : null}
                </View>
                {products.summary.count === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Give people something to say yes to — add your first product or offering.
                  </ThemedText>
                ) : null}
              </>
            )}
          </Card>

          {/* Who needs you */}
          <Card title="🔥 Who needs you">
            {needsAttention.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                You’re on top of everyone. Nothing’s going cold. 🔥
              </ThemedText>
            ) : (
              needsAttention.map(({ contact, days }) => (
                <View key={contact.id} style={[styles.listRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.listMain}>
                    <ThemedText type="small">
                      {STATUS_META[contact.status].emoji} {contact.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {days === null ? 'never contacted' : `${days}d quiet`}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.accent }}>Check in →</ThemedText>
                </View>
              ))
            )}
          </Card>

          {/* Recent moves */}
          <Card title="⚡ Recent moves">
            {!feed || feed.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No activity yet — log your first interaction and the story starts here.
              </ThemedText>
            ) : (
              feed.map((i) => (
                <View key={i.id} style={[styles.listRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.listMain}>
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

          {/* Strongest relationships */}
          {topContacts.length > 0 ? (
            <Card title="🏆 Strongest relationships">
              {topContacts.map((c, i) => (
                <View key={c.id} style={[styles.listRow, { borderBottomColor: theme.border }]}>
                  <ThemedText type="small">
                    {['🥇', '🥈', '🥉'][i]}  {c.name}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.customer }}>
                    {Math.round(c.relationshipStrength)}
                  </ThemedText>
                </View>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {title ? <ThemedText type="smallBold" style={styles.cardTitle}>{title}</ThemedText> : null}
      {children}
    </View>
  );
}

function BigStat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={[styles.statValue, color ? { color } : null]}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  body: { flex: 1, width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  scroll: { paddingBottom: Spacing.six, gap: Spacing.one },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  brandMark: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontSize: 12, lineHeight: 16 },
  brandText: { fontSize: 12, letterSpacing: 1.2 },
  dateLine: { fontSize: 11, letterSpacing: 0.8, marginTop: Spacing.two },
  greeting: { fontSize: 26, lineHeight: 34, marginTop: Spacing.half },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  pill: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  pillGhost: { borderRadius: 999, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  cardTitle: { fontSize: 15 },
  missionCard: { borderWidth: 1.5 },
  kicker: { fontSize: 11, letterSpacing: 0.8 },
  missionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  missionText: { flex: 1, gap: Spacing.half },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  stat: { gap: Spacing.half },
  statValue: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  statLabel: { fontSize: 12 },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  listMain: { flex: 1, gap: Spacing.half },
});
