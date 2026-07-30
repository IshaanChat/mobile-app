// Imported per weight, from the deep path, rather than from the package root.
//
// Each @expo-google-fonts package's index.js does `require()` on every weight
// and italic it ships. Metro cannot tree-shake a require, so importing from
// the root pulls all of them into the bundle — measured at 37 .ttf files and
// 4.65 MB for the 7 weights actually registered here. Reaching straight for
// the file pulls only the file. Measured by exporting both ways:
// 37 files / 4.65 MB → 7 files / 0.90 MB.
//
// These packages declare no "exports" field, so the deep path is reachable.
// If a future version adds one, this breaks loudly at bundle time rather than
// silently shipping the wrong thing.
import Baloo2_500Medium from '@expo-google-fonts/baloo-2/500Medium/Baloo2_500Medium.ttf';
import Fraunces_400Regular from '@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf';
import Fraunces_600SemiBold from '@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf';
import PlusJakartaSans_400Regular from '@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf';
import PlusJakartaSans_500Medium from '@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf';
import PlusJakartaSans_600SemiBold from '@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf';
import PlusJakartaSans_700Bold from '@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useFonts } from 'expo-font';
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
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Baloo2_500Medium,
  });

  // Hold the splash until the faces are in memory. Returning null keeps Shell
  // unmounted, and Shell's effect is the only thing that hides the splash —
  // so this blocks without a second piece of state. Painting first would show
  // a frame of system font and then reflow every screen as the real metrics
  // arrive, which is more jarring than a slightly longer splash.
  //
  // A font that fails to load must not brick the app: on error, carry on and
  // let it fall back rather than sitting behind the splash forever.
  if (!fontsLoaded && !fontError) return null;

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
