// Small bridges over Clerk hooks that stay safe in dev mode (no Clerk key,
// no ClerkProvider mounted). CLERK_ENABLED is fixed for the app's lifetime,
// so the conditional hook calls below never change order between renders.
/* eslint-disable react-hooks/rules-of-hooks */
import { useClerk, useUser } from '@clerk/expo';

import { CLERK_ENABLED } from '@/lib/auth-config';

export function useAccountEmail(): string {
  if (!CLERK_ENABLED) return 'dev@sales-mechanic.local';
  const { user } = useUser();
  return user?.primaryEmailAddress?.emailAddress ?? '';
}

// Returns null in dev mode, where there is no session to end.
export function useMaybeSignOut(): (() => Promise<void>) | null {
  if (!CLERK_ENABLED) return null;
  const { signOut } = useClerk();
  return async () => {
    await signOut();
  };
}
