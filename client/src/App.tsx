import { useEffect, useState, useCallback } from 'react';
import { api } from './api/client';
import type { Business, UserProfile } from './types';
import { getActiveBusinessId, setActiveBusinessId } from './appSettings';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [businesses, setBusinesses] = useState<Business[] | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(getActiveBusinessId());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getProfile(), api.getBusinesses()])
      .then(([p, b]) => {
        setProfile(p);
        setBusinesses(b);
      })
      .catch((err) => setError(err.message));
  }, []);

  const switchBusiness = useCallback((id: string) => {
    setActiveBusinessId(id);
    setActiveId(id);
  }, []);

  const handleBusinessCreated = useCallback((b: Business) => {
    setBusinesses((list) => [...(list ?? []), b]);
    switchBusiness(b.id);
  }, [switchBusiness]);

  const handleBusinessUpdated = useCallback((b: Business) => {
    setBusinesses((list) => list?.map((x) => (x.id === b.id ? b : x)));
  }, []);

  const handleBusinessDeleted = useCallback((id: string) => {
    setBusinesses((list) => {
      const next = (list ?? []).filter((x) => x.id !== id);
      if (next.length > 0) switchBusiness(next[0].id);
      return next;
    });
  }, [switchBusiness]);

  if (error) {
    return (
      <div style={{ padding: 40, color: 'var(--danger)' }}>
        Failed to reach the API: {error}. Is the server running on port 4000?
      </div>
    );
  }

  if (profile === undefined || businesses === undefined) {
    return <div style={{ padding: 40, color: 'var(--text-dim)' }}>Loading…</div>;
  }

  if (profile === null || businesses.length === 0) {
    return (
      <Onboarding
        needsProfile={profile === null}
        needsBusiness={businesses.length === 0}
        onProfileCreated={setProfile}
        onBusinessCreated={handleBusinessCreated}
      />
    );
  }

  const active = businesses.find((b) => b.id === activeId) ?? businesses[0];

  return (
    <Dashboard
      key={active.id}
      business={active}
      businesses={businesses}
      profile={profile}
      onProfileUpdated={setProfile}
      onSwitchBusiness={switchBusiness}
      onBusinessCreated={handleBusinessCreated}
      onBusinessUpdated={handleBusinessUpdated}
      onBusinessDeleted={handleBusinessDeleted}
    />
  );
}
