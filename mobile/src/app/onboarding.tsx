// The Hinge-style onboarding: full screen, one question at a time, big type,
// progress dots. The fork ("already run a business" vs "trying to start
// one") decides the rest of the flow and where the user lands:
//
//   have business  → business basics → profile + business created → Home
//   starting out   → interests       → profile only (explorer)    → Discover
import { Redirect, useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountEmail } from '@/lib/auth';
import { setInterests as persistInterests } from '@/lib/prefs';
import { useAppData } from '@/state/app-data';
import type { BusinessType, Gender } from '@/types';

type Path = 'have' | 'new';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'WOMAN', label: 'Woman' },
  { value: 'MAN', label: 'Man' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const BUSINESS_TYPES: { value: BusinessType; label: string; hint: string }[] = [
  { value: 'PRODUCT_SALES', label: 'I sell products', hint: 'Handmade, vintage, digital goods…' },
  { value: 'SERVICE', label: 'I offer services', hint: 'Freelance, repair, photography…' },
  { value: 'KNOWLEDGE', label: 'I teach or coach', hint: 'Courses, coaching, consulting…' },
  { value: 'OTHER', label: 'Something else', hint: 'Or a mix of everything' },
];

const INTEREST_OPTIONS = [
  'Handmade & crafts',
  'Jewelry',
  'Beauty',
  'Fashion',
  'Home & decor',
  'Art & prints',
  'Food & treats',
  'Digital products',
  'Coaching',
  'Fitness',
  'Pets',
  'Tech & gadgets',
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const email = useAccountEmail();
  const { mode, onProfileCreated, onBusinessCreated } = useAppData();

  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Answers
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [path, setPath] = useState<Path | null>(null);
  const [bizName, setBizName] = useState('');
  const [bizNiche, setBizNiche] = useState('');
  const [bizDescription, setBizDescription] = useState('');
  const [bizType, setBizType] = useState<BusinessType | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  // Someone who already finished onboarding has no business here. (All hooks
  // are above this line — these returns must not change hook order.)
  // The fork lands people in different places: someone who already has a
  // business needs customers (Grow), someone starting out needs something
  // to sell (Discover, which is the index route).
  if (mode === 'active') return <Redirect href="/grow" />;
  if (mode === 'explorer') return <Redirect href="/" />;

  const shared = ['name', 'age', 'gender', 'path'] as const;
  const steps: readonly string[] =
    path === 'have'
      ? [...shared, 'bizName', 'bizNiche', 'bizDescription', 'bizType']
      : path === 'new'
        ? [...shared, 'interests']
        : shared;

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex === steps.length - 1;

  const canContinue = (() => {
    switch (step) {
      case 'name': return name.trim().length > 0;
      case 'age': {
        const n = Number(age);
        return Number.isInteger(n) && n >= 13 && n <= 120;
      }
      case 'gender': return gender !== null;
      case 'path': return path !== null;
      case 'bizName': return bizName.trim().length > 0;
      case 'bizNiche': return bizNiche.trim().length > 0;
      case 'bizDescription': return bizDescription.trim().length > 0;
      case 'bizType': return bizType !== null;
      case 'interests': return interests.length > 0;
      default: return false;
    }
  })();

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const experienceLevel = path === 'new' ? 'FIRST_TIME' : 'EXPERIENCED';
      const profile = await api.createProfile({
        name: name.trim(),
        email: email || 'unknown@sales-mechanic.app',
        age: Number(age),
        gender: gender!,
        experienceLevel,
      });

      if (path === 'have') {
        const business = await api.createBusiness({
          name: bizName.trim(),
          niche: bizNiche.trim(),
          description: bizDescription.trim(),
          businessType: bizType!,
        });
        // Set both at once so mode jumps straight to 'active' — never
        // passing through 'explorer', which would redirect mid-flow.
        onProfileCreated(profile);
        onBusinessCreated(business);
        router.replace('/grow');
      } else {
        await persistInterests(interests);
        onProfileCreated(profile);
        router.replace('/');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  const next = () => {
    if (isLast) void finish();
    else setStepIndex((i) => i + 1);
  };

  const back = () => {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border },
  ];

  const option = (selected: boolean) => [
    styles.option,
    {
      backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
      borderColor: selected ? theme.accent : 'transparent',
    },
  ];

  let title = '';
  let subtitle = '';
  let body: ReactNode = null;

  switch (step) {
    case 'name':
      title = 'What’s your name?';
      subtitle = 'The one your customers know you by.';
      body = (
        <TextInput
          style={inputStyle}
          placeholder="Your name"
          placeholderTextColor={theme.textSecondary}
          autoFocus
          value={name}
          onChangeText={setName}
        />
      );
      break;
    case 'age':
      title = 'How old are you?';
      subtitle = 'Helps us tune advice to where you are.';
      body = (
        <TextInput
          style={inputStyle}
          placeholder="Age"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          maxLength={3}
          value={age}
          onChangeText={setAge}
        />
      );
      break;
    case 'gender':
      title = 'How do you identify?';
      subtitle = 'Only ever used to describe you, never to judge.';
      body = (
        <View style={styles.optionList}>
          {GENDERS.map((g) => (
            <Pressable key={g.value} accessibilityRole="button" style={option(gender === g.value)} onPress={() => setGender(g.value)}>
              <ThemedText type="smallBold">{g.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      );
      break;
    case 'path':
      title = 'Where are you on the journey?';
      subtitle = 'This decides what the app shows you first.';
      body = (
        <View style={styles.optionList}>
          <Pressable accessibilityRole="button" style={option(path === 'have')} onPress={() => setPath('have')}>
            <ThemedText type="smallBold">I already run a business</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Bring in your shop and start growing it.
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" style={option(path === 'new')} onPress={() => setPath('new')}>
            <ThemedText type="smallBold">I’m trying to start one</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Explore what you could sell — we’ll guide you from idea to first sale.
            </ThemedText>
          </Pressable>
        </View>
      );
      break;
    case 'bizName':
      title = 'What’s your business called?';
      subtitle = 'The name on the tin.';
      body = (
        <TextInput
          style={inputStyle}
          placeholder="Business name"
          placeholderTextColor={theme.textSecondary}
          autoFocus
          value={bizName}
          onChangeText={setBizName}
        />
      );
      break;
    case 'bizNiche':
      title = 'What’s your niche?';
      subtitle = 'A few words — “ceramic mugs”, “wedding photography”…';
      body = (
        <TextInput
          style={inputStyle}
          placeholder="Your niche"
          placeholderTextColor={theme.textSecondary}
          autoFocus
          value={bizNiche}
          onChangeText={setBizNiche}
        />
      );
      break;
    case 'bizDescription':
      title = 'Describe it in a sentence.';
      subtitle = 'What do you make or do, and for whom?';
      body = (
        <TextInput
          style={[...inputStyle, styles.multiline]}
          placeholder="We make…"
          placeholderTextColor={theme.textSecondary}
          multiline
          autoFocus
          value={bizDescription}
          onChangeText={setBizDescription}
        />
      );
      break;
    case 'bizType':
      title = 'What kind of business is it?';
      subtitle = 'We tune relationship advice per type.';
      body = (
        <View style={styles.optionList}>
          {BUSINESS_TYPES.map((t) => (
            <Pressable key={t.value} accessibilityRole="button" style={option(bizType === t.value)} onPress={() => setBizType(t.value)}>
              <ThemedText type="smallBold">{t.label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{t.hint}</ThemedText>
            </Pressable>
          ))}
        </View>
      );
      break;
    case 'interests':
      title = 'What are you drawn to?';
      subtitle = 'Pick a few — your Discover feed starts here.';
      body = (
        <View style={styles.chips}>
          {INTEREST_OPTIONS.map((label) => {
            const selected = interests.includes(label);
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                onPress={() =>
                  setInterests((prev) =>
                    selected ? prev.filter((x) => x !== label) : [...prev, label]
                  )
                }
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.accent : theme.backgroundElement,
                  },
                ]}>
                <ThemedText type="smallBold" style={selected ? { color: theme.accentText } : undefined}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      );
      break;
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            {stepIndex > 0 ? (
              <Pressable accessibilityRole="button" onPress={back} disabled={busy} hitSlop={12}>
                <ThemedText type="smallBold" themeColor="textSecondary">←</ThemedText>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={styles.dots}>
              {steps.map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.dot,
                    { backgroundColor: i <= stepIndex ? theme.accent : theme.backgroundSelected },
                  ]}
                />
              ))}
            </View>
            <View />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">{title}</ThemedText>
            <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
            <View style={styles.answers}>{body}</View>
            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>{error}</ThemedText>
            ) : null}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            disabled={!canContinue || busy}
            onPress={next}
            style={[
              styles.continue,
              { backgroundColor: theme.accent, opacity: !canContinue || busy ? 0.5 : 1 },
            ]}>
            {busy ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                {isLast ? (path === 'new' ? 'Start exploring' : 'Let’s go') : 'Continue'}
              </ThemedText>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  dots: { flexDirection: 'row', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: 4 },
  scroll: { flex: 1 },
  scrollContent: { gap: Spacing.two, paddingBottom: Spacing.four },
  answers: { marginTop: Spacing.four, gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 18,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  optionList: { gap: Spacing.two },
  option: {
    borderWidth: 2,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  continue: {
    borderRadius: Spacing.three,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
