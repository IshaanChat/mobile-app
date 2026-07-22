import { useSSO } from '@clerk/expo';
// Clerk v4's default useSignIn/useSignUp use the new "signals" API; the
// legacy entry point keeps the documented create/prepare/attempt flow.
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

WebBrowser.maybeCompleteAuthSession();

type EmailStep = 'credentials' | 'verify';

export default function SignInScreen() {
  const theme = useTheme();
  const { startSSOFlow } = useSSO();
  const { signIn, setActive: setActiveFromSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveFromSignUp, isLoaded: signUpLoaded } = useSignUp();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [step, setStep] = useState<EmailStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warm up the in-app browser so the Google flow opens instantly.
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const clerkMessage = (err: any, fallback: string) =>
    err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? fallback;

  const onGoogle = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
      // No created session and no error = the user closed the browser.
    } catch (err: any) {
      setError(clerkMessage(err, 'Google sign-in failed. Try again.'));
    } finally {
      setBusy(false);
    }
  }, [startSSOFlow]);

  const onEmailSubmit = useCallback(async () => {
    if (!signInLoaded || !signUpLoaded) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        const attempt = await signIn.create({ identifier: email.trim(), password });
        if (attempt.status === 'complete') {
          await setActiveFromSignIn({ session: attempt.createdSessionId });
        } else {
          setError('That sign-in needs another step we don’t support yet. Try Google.');
        }
      } else {
        await signUp.create({ emailAddress: email.trim(), password });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStep('verify');
      }
    } catch (err: any) {
      setError(clerkMessage(err, 'That didn’t work. Check the details and try again.'));
    } finally {
      setBusy(false);
    }
  }, [mode, email, password, signIn, signUp, signInLoaded, signUpLoaded, setActiveFromSignIn]);

  const onVerify = useCallback(async () => {
    if (!signUpLoaded) return;
    setError(null);
    setBusy(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete') {
        await setActiveFromSignUp({ session: attempt.createdSessionId });
      } else {
        setError('That code didn’t match. Try again.');
      }
    } catch (err: any) {
      setError(clerkMessage(err, 'That code didn’t match. Try again.'));
    } finally {
      setBusy(false);
    }
  }, [code, signUp, signUpLoaded, setActiveFromSignUp]);

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border },
  ];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ThemedView style={styles.hero}>
            <ThemedText style={styles.mark}>🔧</ThemedText>
            <ThemedText type="subtitle" style={styles.title}>
              Sales Mechanic
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.tagline}>
              Big companies have sales teams.{'\n'}You have this.
            </ThemedText>
          </ThemedView>

          {step === 'credentials' ? (
            <ThemedView style={styles.form}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onGoogle}
                style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Continue with Google</ThemedText>
              </Pressable>

              <ThemedText type="small" themeColor="textSecondary" style={styles.divider}>
                or with email
              </ThemedText>

              <TextInput
                style={inputStyle}
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={inputStyle}
                placeholder="Password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChangeText={setPassword}
              />

              <Pressable
                accessibilityRole="button"
                disabled={busy || !email.trim() || !password}
                onPress={onEmailSubmit}
                style={[
                  styles.button,
                  { backgroundColor: theme.accent, opacity: busy || !email.trim() || !password ? 0.6 : 1 },
                ]}>
                {busy ? (
                  <ActivityIndicator color={theme.accentText} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                    {mode === 'signin' ? 'Sign in' : 'Create account'}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                  setError(null);
                }}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.switchMode}>
                  {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <ThemedView style={styles.form}>
              <ThemedText type="smallBold">Check your email</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                We sent a code to {email.trim()}.
              </ThemedText>
              <TextInput
                style={inputStyle}
                placeholder="Verification code"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy || !code.trim()}
                onPress={onVerify}
                style={[
                  styles.button,
                  { backgroundColor: theme.accent, opacity: busy || !code.trim() ? 0.6 : 1 },
                ]}>
                {busy ? (
                  <ActivityIndicator color={theme.accentText} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                    Verify
                  </ThemedText>
                )}
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setStep('credentials')}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.switchMode}>
                  Back
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {error ? (
            <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
              {error}
            </ThemedText>
          ) : null}
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
    justifyContent: 'center',
    gap: Spacing.four,
  },
  hero: { alignItems: 'center', gap: Spacing.two },
  mark: { fontSize: 44, lineHeight: 52 },
  title: { textAlign: 'center' },
  tagline: { textAlign: 'center' },
  form: { gap: Spacing.three },
  divider: { textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: 14,
    alignItems: 'center',
  },
  switchMode: { textAlign: 'center' },
  error: { textAlign: 'center' },
});
