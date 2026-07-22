// Account-level state: the profile, the businesses, and which one is active.
// The mode drives all top-level routing:
//
//   loading     still fetching
//   error       first fetch failed (Render cold start, offline)
//   onboarding  no profile yet — the Hinge-style flow owns the screen
//   explorer    profile but no business — browse-first new founders live in
//               Discover until the starter funnel creates their business
//   active      at least one business — the full app
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { getActiveBusinessId, setActiveBusinessId } from '@/lib/prefs';
import type { Business, UserProfile } from '@/types';

export type AppMode = 'loading' | 'error' | 'onboarding' | 'explorer' | 'active';

interface AppData {
  mode: AppMode;
  error: string | null;
  profile: UserProfile | null;
  businesses: Business[];
  activeBusiness: Business | null;
  refresh: () => Promise<void>;
  switchBusiness: (id: string) => void;
  onProfileCreated: (profile: UserProfile) => void;
  onProfileUpdated: (profile: UserProfile) => void;
  onBusinessCreated: (business: Business) => void;
  onBusinessUpdated: (business: Business) => void;
  onBusinessDeleted: (id: string) => void;
}

const Ctx = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const value = useContext(Ctx);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}

// `ready` lets the provider mount before auth is usable (the token getter is
// installed by the Clerk gate); nothing is fetched until it flips true.
export function AppDataProvider({ ready, children }: { ready: boolean; children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [businesses, setBusinesses] = useState<Business[] | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [p, b, storedId] = await Promise.all([
        api.getProfile(),
        api.getBusinesses(),
        getActiveBusinessId(),
      ]);
      setProfile(p);
      setBusinesses(b);
      setActiveId((current) => current ?? storedId);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const switchBusiness = useCallback((id: string) => {
    setActiveId(id);
    void setActiveBusinessId(id);
  }, []);

  const value = useMemo<AppData>(() => {
    const list = businesses ?? [];
    const activeBusiness = list.find((b) => b.id === activeId) ?? list[0] ?? null;

    let mode: AppMode = 'loading';
    if (error && (profile === undefined || businesses === undefined)) mode = 'error';
    else if (profile !== undefined && businesses !== undefined) {
      if (profile === null) mode = 'onboarding';
      else if (list.length === 0) mode = 'explorer';
      else mode = 'active';
    }

    return {
      mode,
      error,
      profile: profile ?? null,
      businesses: list,
      activeBusiness,
      refresh,
      switchBusiness,
      onProfileCreated: (p) => setProfile(p),
      onProfileUpdated: (p) => setProfile(p),
      onBusinessCreated: (b) => {
        setBusinesses((prev) => [...(prev ?? []), b]);
        switchBusiness(b.id);
      },
      onBusinessUpdated: (b) =>
        setBusinesses((prev) => prev?.map((x) => (x.id === b.id ? b : x))),
      onBusinessDeleted: (id) =>
        setBusinesses((prev) => {
          const next = (prev ?? []).filter((x) => x.id !== id);
          if (next.length > 0) switchBusiness(next[0].id);
          return next;
        }),
    };
  }, [profile, businesses, activeId, error, refresh, switchBusiness]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
