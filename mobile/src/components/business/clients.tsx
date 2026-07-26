// Business → Clients: the book of people, strongest relationship first.
//
// Relationship strength is the whole point of this pane — it decays with
// silence and rises when you log a touch, so the list reorders itself
// around whoever you've actually been talking to. Sorting by name would
// make it an address book; sorting by strength makes it a to-do list.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';

import { api } from '@/api/client';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysSince, STATUS_META, STATUS_ORDER } from '@/lib/status-meta';
import { useAppData } from '@/state/app-data';
import type { Contact, ContactStatus } from '@/types';

export function ClientsPane() {
  const theme = useTheme();
  const { activeBusiness } = useAppData();

  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeBusiness) return;
    try {
      const graph = await api.getGraph(activeBusiness.id);
      setContacts(graph.contacts);
    } catch {
      setContacts([]);
    }
  }, [activeBusiness]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addContact() {
    if (!activeBusiness || !name.trim()) return;
    setSaving(true);
    try {
      await api.createContact({
        businessId: activeBusiness.id,
        name: name.trim(),
        // No link is a perfectly normal way to meet someone — the API
        // takes a kind instead so the contact isn't stuck channel-less.
        ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : { noLinkKind: 'IN_PERSON' as const }),
      });
      setName('');
      setSourceUrl('');
      setAdding(false);
      await load();
    } catch (e) {
      Alert.alert('Couldn’t add them', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function logTouch(contact: Contact) {
    try {
      await api.logInteraction(contact.id, { type: 'MESSAGE' });
      await load();
    } catch (e) {
      Alert.alert('Couldn’t log that', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  const sorted = [...(contacts ?? [])].sort(
    (a, b) => b.relationshipStrength - a.relationshipStrength,
  );

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
        onPress={() => setAdding((v) => !v)}
        style={[styles.addBtn, { backgroundColor: theme.accent }]}>
        <Icon name={adding ? 'x' : 'plus'} size={16} color={theme.accentText} />
        <ThemedText type="smallBold" style={{ color: theme.accentText }}>
          {adding ? 'Never mind' : 'New client'}
        </ThemedText>
      </Pressable>

      {adding ? (
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Field label="Their name" value={name} onChange={setName} placeholder="Jamie Rivera" />
          <Field
            label="Where you found them (optional)"
            value={sourceUrl}
            onChange={setSourceUrl}
            placeholder="instagram.com/theirhandle"
          />
          <Pressable
            accessibilityRole="button"
            disabled={!name.trim() || saving}
            onPress={addContact}
            style={[
              styles.saveBtn,
              { backgroundColor: theme.accent, opacity: !name.trim() || saving ? 0.4 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              {saving ? 'Adding…' : 'Add to the book'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {contacts === null ? (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      ) : sorted.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Every business starts with one person who cared. Add yours.
        </ThemedText>
      ) : (
        <>
          <View style={styles.counts}>
            {STATUS_ORDER.map((s) => (
              <View key={s} style={styles.count}>
                <View style={[styles.dot, { backgroundColor: theme[STATUS_META[s].color] }]} />
                <ThemedText type="small" themeColor="textSecondary">
                  {sorted.filter((c) => c.status === s).length} {STATUS_META[s].title.toLowerCase()}
                </ThemedText>
              </View>
            ))}
          </View>

          {sorted.map((c) => (
            <ContactRow key={c.id} contact={c} onLogTouch={() => logTouch(c)} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function ContactRow({ contact, onLogTouch }: { contact: Contact; onLogTouch: () => void }) {
  const theme = useTheme();
  const quiet = daysSince(contact.lastInteractionAt);

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.rowTop}>
        <View style={styles.rowMain}>
          <View style={styles.nameRow}>
            <View style={[styles.dot, { backgroundColor: theme[STATUS_META[contact.status].color] }]} />
            <ThemedText type="smallBold">{contact.name}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {STATUS_META[contact.status].title}
            {quiet === null ? ' · never contacted' : ` · ${quiet}d quiet`}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={[styles.strength, { color: theme.customer }]}>
          {Math.round(contact.relationshipStrength)}
        </ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onLogTouch}
        style={[styles.touch, { borderColor: theme.border }]}>
        <Icon name="spark" size={16} color={theme.accent} />
        <ThemedText type="small" style={{ color: theme.accent }}>Log a touch</ThemedText>
      </Pressable>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="words"
        style={[
          styles.input,
          { borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
        ]}
      />
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
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  rowMain: { flex: 1, gap: Spacing.half },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 7, height: 7, borderRadius: 999 },
  strength: { fontVariant: ['tabular-nums'] },
  touch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.two,
  },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, paddingVertical: Spacing.two },
  count: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  field: { gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Spacing.two + 4, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, fontSize: 16 },
  saveBtn: { borderRadius: 999, alignItems: 'center', paddingVertical: Spacing.two + 2 },
  loading: { paddingVertical: Spacing.five },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
});
