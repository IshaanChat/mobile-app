import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ReactNode, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { setAuthTokenGetter } from '@/api/client';
import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY } from '@/lib/auth-config';
import { AppDataProvider } from '@/state/app-data';

SplashScreen.preventAutoHideAsync();

// signedIn decides which route group exists; ready gates the first API fetch
// until the auth token getter is installed (mirrors the web TokenBridge).
function Shell({ signedIn, ready }: { signedIn: boolean; ready: boolean }) {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppDataProvider ready={ready}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
      </AppDataProvider>
    </ThemeProvider>
  );
}

// Feeds Clerk's session token into the API client. Children wait until the
// getter is installed so the first requests can't race it and 401.
function ClerkGate({ children }: { children: (signedIn: boolean, ready: boolean) => ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setTokenReady(true);
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  const signedIn = Boolean(isLoaded && isSignedIn);
  return <>{children(signedIn, signedIn && tokenReady)}</>;
}

export default function RootLayout() {
  // No key = dev mode: no sign-in, the API treats every call as the shared
  // development account. Only sensible against a local server.
  if (!CLERK_ENABLED) {
    return <Shell signedIn ready />;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ClerkGate>{(signedIn, ready) => <Shell signedIn={signedIn} ready={ready} />}</ClerkGate>
    </ClerkProvider>
  );
}
