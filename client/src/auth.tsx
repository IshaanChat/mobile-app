import { ReactNode, useEffect, useState } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from '@clerk/clerk-react';
import { setAuthTokenGetter } from './api/client';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

// Auth is opt-in: with no publishable key (local dev), the app renders
// straight through and the API treats every call as the development account.
// Set VITE_CLERK_PUBLISHABLE_KEY to require real sign-in.
export const CLERK_ENABLED = Boolean(PUBLISHABLE_KEY);

// Feeds Clerk's session token into the API client, and clears it on sign-out.
//
// Children are held back until the token getter is actually installed. React
// runs a child's effects before its parent's, so without this gate `App`
// would fire its first API calls a beat before the token was attached — and
// those requests would 401.
function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setTokenReady(true);
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  if (!isLoaded || !tokenReady) {
    return <div style={{ padding: 40, color: 'var(--text-dim)' }}>Loading…</div>;
  }
  return <>{children}</>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY!} afterSignOutUrl="/">
      <SignedOut>
        <SignInScreen />
      </SignedOut>
      <SignedIn>
        <TokenBridge>{children}</TokenBridge>
      </SignedIn>
    </ClerkProvider>
  );
}

function SignInScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div className="brand-row" style={{ justifyContent: 'center' }}>
          <span className="brand-mark">🔧</span> Venturo
        </div>
        <h1 style={{ margin: '8px 0 4px' }}>Welcome back.</h1>
        <p style={{ color: 'var(--text-dim)', margin: 0 }}>
          Big companies have sales teams. You have this.
        </p>
      </div>
      <SignIn />
    </div>
  );
}

// Clerk's account menu (avatar → manage account / sign out). Only render
// this where CLERK_ENABLED is true; outside a ClerkProvider it would throw.
export function AccountButton() {
  return <UserButton afterSignOutUrl="/" />;
}
