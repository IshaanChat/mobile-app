// Business → Money: sales that landed, and the shelf they came off.
//
// Recording a sale is the top control rather than a buried form. It's the
// moment the whole app exists for, and it's the one thing people do
// standing up, mid-conversation, on their phone.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { api } from '@/api/client';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { money, timeAgo } from '@/lib/status-meta';
import { useAppData } from '@/state/app-data';
import type { PaymentsPayload, ProductsPayload } from '@/types';

export function MoneyPane() {
  const theme = useTheme();
  const { activeBusiness } = useAppData();

  const [payments, setPayments] = useState<PaymentsPayload | null>(null);
  const [products, setProducts] = useState<ProductsPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeBusiness) return;
    const id = activeBusiness.id;
    await Promise.all([
      api.getPayments(id).then(setPayments).catch(() => {}),
      api.getProducts(id).then(setProducts).catch(() => {}),
    ]);
  }, [activeBusiness]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recordSale() {
    const value = Number(amount);
    if (!activeBusiness || !Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    try {
      await api.createPayment({
        businessId: activeBusiness.id,
        amount: value,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setAmount('');
      setNote('');
      setRecording(false);
      await load();
    } catch (e) {
      Alert.alert('Couldn’t record it', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  const validAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;

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
      <Pressable
        accessibilityRole="button"
        onPress={() => setRecording((v) => !v)}
        style={[styles.addBtn, { backgroundColor: theme.accent }]}>
        <Icon name={recording ? 'x' : 'plus'} size={16} color={theme.accentText} />
        <ThemedText type="smallBold" style={{ color: theme.accentText }}>
          {recording ? 'Never mind' : 'Record a sale'}
        </ThemedText>
      </Pressable>

      {recording ? (
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">How much came in</ThemedText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="45.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background }]}
            />
          </View>
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">What for (optional)</ThemedText>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Two candles, market stall"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background }]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!validAmount || saving}
            onPress={recordSale}
            style={[styles.saveBtn, { backgroundColor: theme.accent, opacity: !validAmount || saving ? 0.4 : 1 }]}>
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              {saving ? 'Recording…' : 'Record it'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {payments === null ? (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.stats}>
              <Stat value={money(payments.summary.thisMonth)} label="this month" color={theme.customer} />
              <Stat value={money(payments.summary.total)} label="all time" />
              <Stat
                value={String(payments.summary.count)}
                label={payments.summary.count === 1 ? 'sale' : 'sales'}
              />
            </View>
            {payments.summary.topClient ? (
              <ThemedText type="small" themeColor="textSecondary">
                Best customer: {payments.summary.topClient.name} · {money(payments.summary.topClient.total)}
              </ThemedText>
            ) : null}
          </View>

          <SectionTitle icon="note" title="Recent sales" />
          {payments.payments.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              The first dollar is the hardest — and the sweetest. Record it when it lands.
            </ThemedText>
          ) : (
            payments.payments.slice(0, 10).map((p) => (
              <View key={p.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                <View style={styles.rowMain}>
                  <ThemedText type="small">
                    {p.note ?? p.product?.name ?? 'Sale'}
                    {p.contact ? ` · ${p.contact.name}` : ''}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{timeAgo(p.occurredAt)}</ThemedText>
                </View>
                <ThemedText type="smallBold" style={[styles.amount, { color: theme.customer }]}>
                  {money(p.amount)}
                </ThemedText>
              </View>
            ))
          )}

          <SectionTitle icon="tag" title="The shelf" />
          {products === null || products.products.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              Give people something to say yes to — add your first product or offering.
            </ThemedText>
          ) : (
            products.products.map((p) => (
              <View key={p.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                <View style={styles.rowMain}>
                  <ThemedText type="small">{p.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {/* null stock means "not tracked" — services and made-to-order
                        shouldn't read as sold out. */}
                    {p.stock === null ? 'stock not tracked' : `${p.stock} in stock`}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" style={styles.amount}>
                  {p.price === null ? '—' : money(p.price)}
                </ThemedText>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function SectionTitle({ icon, title }: { icon: 'note' | 'tag'; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Icon name={icon} size={16} color={theme.textSecondary} />
      <ThemedText type="smallBold" style={styles.sectionText}>{title}</ThemedText>
    </View>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={[styles.statValue, color ? { color } : null]}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1 },
  scroll: { paddingBottom: Spacing.six, gap: Spacing.two },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingVertical: Spacing.two + 2,
  },
  card: { borderRadius: Spacing.three, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  field: { gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Spacing.two + 4, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, fontSize: 16 },
  saveBtn: { borderRadius: 999, alignItems: 'center', paddingVertical: Spacing.two + 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  stat: { gap: Spacing.half },
  statValue: { fontSize: 22, fontWeight: '800', lineHeight: 28, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.three },
  sectionText: { fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  amount: { fontVariant: ['tabular-nums'] },
  loading: { paddingVertical: Spacing.five },
  empty: { paddingVertical: Spacing.three },
});
