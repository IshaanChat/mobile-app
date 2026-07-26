// Business: the settings surface, ported from the web client's BusinessTab.
// Same four sub-tabs — Business / About you / Socials / Settings — rendered
// as a mobile sub-tab strip in the artisan palette.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMaybeSignOut } from '@/lib/auth';
import { getCoolingOffDays, setCoolingOffDays } from '@/lib/prefs';
import { useAppData } from '@/state/app-data';
import type { Business, SocialLink, SocialPlatform, UserProfile } from '@/types';

type SubTab = 'business' | 'profile' | 'socials' | 'settings';

const SUBTABS: { key: SubTab; label: string }[] = [
  { key: 'business', label: '🏪 Business' },
  { key: 'profile', label: '👤 About you' },
  { key: 'socials', label: '🌐 Socials' },
  { key: 'settings', label: '⚙️ Settings' },
];

const SOCIAL_DEFS: { platform: SocialPlatform; label: string; emoji: string; placeholder: string }[] = [
  { platform: 'INSTAGRAM', label: 'Instagram', emoji: '📸', placeholder: 'instagram.com/yourshop' },
  { platform: 'TWITTER', label: 'X (Twitter)', emoji: '🐦', placeholder: 'x.com/yourshop' },
  { platform: 'TIKTOK', label: 'TikTok', emoji: '🎵', placeholder: 'tiktok.com/@yourshop' },
  { platform: 'YOUTUBE', label: 'YouTube', emoji: '▶️', placeholder: 'youtube.com/@yourshop' },
  { platform: 'REDDIT', label: 'Reddit', emoji: '👽', placeholder: 'reddit.com/u/yourname' },
  { platform: 'FACEBOOK', label: 'Facebook', emoji: '👥', placeholder: 'facebook.com/yourshop' },
  { platform: 'PINTEREST', label: 'Pinterest', emoji: '📌', placeholder: 'pinterest.com/yourshop' },
];

export default function BusinessScreen() {
  const theme = useTheme();
  const signOut = useMaybeSignOut();
  const { profile, businesses, activeBusiness, switchBusiness, mode, refresh } = useAppData();
  const [sub, setSub] = useState<SubTab>('business');

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.name}>{profile?.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{profile?.email}</ThemedText>
          </View>

          {/* Sub-tab strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subtabs}>
            {SUBTABS.map((t) => {
              const on = t.key === sub;
              return (
                <Pressable
                  key={t.key}
                  accessibilityRole="button"
                  onPress={() => setSub(t.key)}
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? theme.accent : theme.border,
                      backgroundColor: on ? theme.accentSoft : 'transparent',
                    },
                  ]}>
                  <ThemedText type={on ? 'smallBold' : 'small'} themeColor={on ? 'text' : 'textSecondary'}>
                    {t.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {sub === 'business' ? (
              mode === 'explorer' ? (
                <Section title="No business yet — on purpose">
                  <ThemedText type="small" themeColor="textSecondary">
                    You’re exploring. When you commit to a product in Discover,
                    your business gets set up right here.
                  </ThemedText>
                </Section>
              ) : (
                <>
                  {activeBusiness ? (
                    <BusinessSection business={activeBusiness} onSaved={refresh} />
                  ) : null}
                  <Section
                    title="All your ventures"
                    subtitle="Run more than one thing? Each business keeps its own network and activity.">
                    {businesses.map((b) => {
                      const active = b.id === activeBusiness?.id;
                      return (
                        <Pressable
                          key={b.id}
                          accessibilityRole="button"
                          onPress={() => switchBusiness(b.id)}
                          style={[
                            styles.bizRow,
                            {
                              backgroundColor: active ? theme.backgroundSelected : 'transparent',
                              borderColor: theme.border,
                            },
                          ]}>
                          <View style={styles.bizMain}>
                            <ThemedText type="smallBold">{b.name}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">{b.niche}</ThemedText>
                          </View>
                          {active ? (
                            <View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
                              <ThemedText type="small" style={{ color: theme.accent, fontSize: 12 }}>active</ThemedText>
                            </View>
                          ) : (
                            <ThemedText type="small" style={{ color: theme.accent }}>Switch →</ThemedText>
                          )}
                        </Pressable>
                      );
                    })}
                  </Section>
                </>
              )
            ) : null}

            {sub === 'profile' && profile ? (
              <AboutYouSection profile={profile} onSaved={refresh} />
            ) : null}

            {sub === 'socials' ? (
              activeBusiness ? (
                <SocialsSection businessId={activeBusiness.id} />
              ) : (
                <Section title="Your socials">
                  <ThemedText type="small" themeColor="textSecondary">
                    Set up a business first and your channels live here.
                  </ThemedText>
                </Section>
              )
            ) : null}

            {sub === 'settings' ? (
              <>
                <RelationshipSection />
                {signOut ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      Alert.alert('Sign out?', undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
                      ])
                    }
                    style={[styles.signOut, { borderColor: theme.border }]}>
                    <ThemedText type="smallBold" style={{ color: theme.danger }}>Sign out</ThemedText>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ---------- Business ---------- */

function BusinessSection({ business, onSaved }: { business: Business; onSaved: () => void }) {
  const [name, setName] = useState(business.name);
  const [niche, setNiche] = useState(business.niche);
  const [description, setDescription] = useState(business.description);
  const [pageUrl, setPageUrl] = useState(business.pageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== business.name || niche !== business.niche ||
    description !== business.description || pageUrl !== (business.pageUrl ?? '');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateBusiness(business.id, { name, niche, description, pageUrl });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Your business" subtitle="This is how the app talks about what you do.">
      <Field label="Business name" value={name} onChangeText={setName} />
      <Field label="Product / niche" value={niche} onChangeText={setNiche} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline />
      <Field
        label="Your business page — where should people land?"
        value={pageUrl}
        onChangeText={setPageUrl}
        placeholder="etsy.com/shop/yourshop"
      />
      <SaveButton onPress={save} saving={saving} saved={saved} disabled={!dirty} error={error} />
    </Section>
  );
}

/* ---------- About you ---------- */

function AboutYouSection({ profile, onSaved }: { profile: UserProfile; onSaved: () => void }) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [location, setLocation] = useState(profile.location ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [goals, setGoals] = useState(profile.goals ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile(profile.id, {
        name, email, age: profile.age, gender: profile.gender, location, bio, goals,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="About you" subtitle="The person behind the business. People buy from people.">
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Location (optional)" value={location} onChangeText={setLocation} placeholder="e.g. Austin, TX" />
      <Field label="Bio (optional)" value={bio} onChangeText={setBio} multiline
        placeholder="A sentence about you — people buy from people." />
      <Field label="What do you want from this business? (optional)" value={goals} onChangeText={setGoals} multiline
        placeholder="e.g. Replace my day-job income within two years" />
      <SaveButton onPress={save} saving={saving} saved={saved} error={error} />
    </Section>
  );
}

/* ---------- Socials ---------- */

function SocialsSection({ businessId }: { businessId: string }) {
  const theme = useTheme();
  const [urls, setUrls] = useState<Record<SocialPlatform, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const blank: Record<SocialPlatform, string> = {
      TWITTER: '', INSTAGRAM: '', TIKTOK: '', YOUTUBE: '', REDDIT: '', FACEBOOK: '', PINTEREST: '',
    };
    api.getSocials(businessId)
      .then((links: SocialLink[]) => {
        const next = { ...blank };
        for (const l of links) next[l.platform] = l.url;
        setUrls(next);
      })
      .catch(() => setUrls(blank));
  }, [businessId]);

  const save = async () => {
    if (!urls) return;
    setSaving(true);
    setError(null);
    try {
      await api.saveSocials(
        businessId,
        (Object.keys(urls) as SocialPlatform[]).map((platform) => ({ platform, url: urls[platform] }))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const connected = urls ? Object.values(urls).filter(Boolean).length : 0;

  return (
    <Section
      title="Your socials"
      subtitle="Where your business lives online. Growth uses these to meet customers where you already are.">
      {!urls ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        <>
          {SOCIAL_DEFS.map((def) => (
            <Field
              key={def.platform}
              label={`${def.emoji} ${def.label}`}
              value={urls[def.platform]}
              onChangeText={(v) => setUrls({ ...urls, [def.platform]: v })}
              placeholder={def.placeholder}
              autoCapitalize="none"
            />
          ))}
          <SaveButton onPress={save} saving={saving} saved={saved} error={error} />
          <ThemedText type="small" themeColor="textSecondary">{connected} connected</ThemedText>
        </>
      )}
    </Section>
  );
}

/* ---------- Settings ---------- */

function RelationshipSection() {
  const theme = useTheme();
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    getCoolingOffDays().then(setDays).catch(() => setDays(7));
  }, []);

  const update = (n: number) => {
    setDays(n);
    void setCoolingOffDays(n);
  };

  return (
    <Section
      title="Relationship reminders"
      subtitle="How long someone can go quiet before they show up in “Who needs you”.">
      {days === null ? (
        <ActivityIndicator color={theme.accent} />
      ) : (
        <View style={styles.dayRow}>
          {[3, 7, 14, 30].map((n) => {
            const on = n === days;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                onPress={() => update(n)}
                style={[
                  styles.chip,
                  {
                    borderColor: on ? theme.accent : theme.border,
                    backgroundColor: on ? theme.accentSoft : 'transparent',
                  },
                ]}>
                <ThemedText type={on ? 'smallBold' : 'small'} themeColor={on ? 'text' : 'textSecondary'}>
                  {n} days
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </Section>
  );
}

/* ---------- shared ---------- */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="smallBold" style={styles.cardTitle}>{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText>
      ) : null}
      {children}
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          { backgroundColor: theme.backgroundSelected, borderColor: theme.border, color: theme.text },
        ]}
      />
    </View>
  );
}

function SaveButton({
  onPress, saving, saved, disabled, error,
}: {
  onPress: () => void; saving: boolean; saved: boolean; disabled?: boolean; error: string | null;
}) {
  const theme = useTheme();
  const off = saving || disabled;
  return (
    <>
      {error ? <ThemedText type="small" style={{ color: theme.danger }}>{error}</ThemedText> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={off}
        style={[styles.save, { backgroundColor: theme.accent, opacity: off ? 0.6 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: theme.accentText }}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </ThemedText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  body: { flex: 1, width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  header: { paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.half },
  name: { fontSize: 26, lineHeight: 34 },
  subtabs: { gap: Spacing.two, paddingVertical: Spacing.two },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  scroll: { paddingBottom: Spacing.six },
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  cardTitle: { fontSize: 15 },
  field: { gap: Spacing.one, marginTop: Spacing.two },
  fieldLabel: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  save: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  bizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  bizMain: { flex: 1, gap: Spacing.half },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  signOut: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
});
