import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import type { Business, Channel, Contact, MissionsPayload, UserProfile } from '../types';
import ContactPanel from './ContactPanel';
import HomeTab from './HomeTab';
import DiscoverTab from './DiscoverTab';
import BusinessTab from './BusinessTab';
import MissionsSidebar from './MissionsSidebar';
import MissionsPage from './MissionsPage';
import SalesTab, { SalesSubTab } from './SalesTab';
import ClientsTab from './ClientsTab';
import AddContactModal from './AddContactModal';
import { AccountButton, CLERK_ENABLED } from '../auth';

type Tab = 'home' | 'people' | 'sales' | 'discover' | 'business';

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'people', label: 'Clients' },
  { key: 'sales', label: 'Sales' },
  { key: 'discover', label: 'Discover' },
  { key: 'business', label: 'My Business' },
];

interface Toast {
  id: number;
  text: string;
}

export default function Dashboard({
  business,
  businesses,
  profile,
  onProfileUpdated,
  onSwitchBusiness,
  onBusinessCreated,
  onBusinessUpdated,
  onBusinessDeleted,
}: {
  business: Business;
  businesses: Business[];
  profile: UserProfile;
  onProfileUpdated: (p: UserProfile) => void;
  onSwitchBusiness: (id: string) => void;
  onBusinessCreated: (b: Business) => void;
  onBusinessUpdated: (b: Business) => void;
  onBusinessDeleted: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('home');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [addContact, setAddContact] = useState<{ open: boolean; initialUrl?: string }>({ open: false });
  const [refreshKey, setRefreshKey] = useState(0);
  const [missions, setMissions] = useState<MissionsPayload | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [missionsForceOpen, setMissionsForceOpen] = useState(false);
  const [missionsPageOpen, setMissionsPageOpen] = useState(false);
  const [salesSub, setSalesSub] = useState<SalesSubTab>('products');
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const reload = useCallback(async () => {
    const graph = await api.getGraph(business.id);
    setChannels(graph.channels);
    setContacts(graph.contacts);
    setLoading(false);
    setRefreshKey((k) => k + 1);
  }, [business.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Refresh the mission board whenever data changes; celebrate fresh completions.
  useEffect(() => {
    let cancelled = false;
    api.getMissions(business.id).then((payload) => {
      if (!cancelled) setMissions(payload);
      // Toasts are processed even for a "cancelled" effect run: the server's
      // unique constraint means each completion is reported exactly once, and
      // StrictMode's double-mount would otherwise swallow it.
      if (payload.justCompleted.length > 0) {
        const newToasts = payload.justCompleted.map((id) => {
          const m = payload.missions.find((x) => x.id === id);
          return {
            id: Date.now() + Math.random(),
            text: m ? `🎉 Mission complete: ${m.title} (+${m.xp} Wisdom)` : '🎉 Mission complete!',
          };
        });
        setToasts((t) => [...t, ...newToasts]);
        newToasts.forEach((toast) =>
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), 5000)
        );
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [business.id, refreshKey]);

  const summary = missions?.summary;
  const xpPct = summary && summary.nextLevelXp !== null
    ? Math.min(100, Math.round(((summary.xp - summary.currentLevelXp) / (summary.nextLevelXp - summary.currentLevelXp)) * 100))
    : 100;

  return (
    <div style={{ height: '100vh', overflowY: 'auto', paddingRight: 46 }}>
      <header style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--panel-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="brand-row">
              <span className="brand-mark">🔧</span> Venturo
            </div>
            <h2 style={{ margin: 0 }}>{business.name}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
              {business.niche}
              {business.pageUrl && (
                <>
                  {' · '}
                  <a href={business.pageUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Visit my page ↗
                  </a>
                </>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {summary && (
              <button
                onClick={() => setMissionsForceOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', padding: 0 }}
                title={`${summary.xp} Wisdom — ${summary.nextLevelXp !== null ? `${summary.nextLevelXp - summary.xp} to next level` : 'max level'}`}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  Lv {summary.level} · {summary.levelName}
                </div>
                <div className="xp-track" style={{ width: 120, height: 6, marginTop: 4 }}>
                  <div className="xp-fill" style={{ width: `${xpPct}%` }} />
                </div>
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button className="btn" onClick={() => setQuickAddOpen((o) => !o)}>+ Quick add</button>
              {quickAddOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 70 }} onClick={() => setQuickAddOpen(false)} />
                  <div
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 71,
                      background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12,
                      boxShadow: 'var(--shadow), 0 8px 24px rgba(0,0,0,0.15)', padding: 6, minWidth: 200,
                    }}
                  >
                    {[
                      { label: '👤 New client', run: () => setAddContact({ open: true }) },
                      { label: '🏷️ Add a product', run: () => { setTab('sales'); setSalesSub('products'); } },
                      { label: '💰 Record a sale', run: () => { setTab('sales'); setSalesSub('money'); } },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() => { setQuickAddOpen(false); item.run(); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                          padding: '9px 12px', fontSize: 14, color: 'var(--text)', borderRadius: 8, cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-soft)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {CLERK_ENABLED && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <AccountButton />
              </div>
            )}
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none', padding: '10px 16px', fontSize: 14, fontWeight: 600,
                color: tab === t.key ? 'var(--text)' : 'var(--text-dim)',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--text-dim)' }}>Loading…</div>
        ) : (
          <>
            {tab === 'home' && (
              <HomeTab
                business={business}
                profile={profile}
                channels={channels}
                contacts={contacts}
                missions={missions}
                refreshKey={refreshKey}
                onSelectContact={setSelectedContactId}
                onAddContact={() => setAddContact({ open: true })}
                onGoToMissions={() => setMissionsForceOpen(true)}
                onNavigate={(dest) => setTab(dest === 'clients' ? 'people' : dest)}
              />
            )}
            {tab === 'people' && (
              <ClientsTab
                businessId={business.id}
                channels={channels}
                contacts={contacts}
                refreshKey={refreshKey}
                onSelectContact={setSelectedContactId}
                onAddContact={() => setAddContact({ open: true })}
              />
            )}
            {tab === 'sales' && (
              <SalesTab
                businessId={business.id}
                contacts={contacts}
                sub={salesSub}
                onSubChange={setSalesSub}
                onChanged={() => setRefreshKey((k) => k + 1)}
              />
            )}
            {tab === 'discover' && (
              <DiscoverTab
                business={business}
                onBusinessUpdated={(b) => {
                  onBusinessUpdated(b);
                  setRefreshKey((k) => k + 1);
                }}
                onFoundSomeone={(url) => setAddContact({ open: true, initialUrl: url })}
              />
            )}
            {tab === 'business' && (
              <BusinessTab
                business={business}
                businesses={businesses}
                profile={profile}
                onProfileUpdated={(p) => {
                  onProfileUpdated(p);
                  setRefreshKey((k) => k + 1);
                }}
                onSocialsSaved={() => setRefreshKey((k) => k + 1)}
                onSwitchBusiness={onSwitchBusiness}
                onBusinessCreated={onBusinessCreated}
                onBusinessUpdated={onBusinessUpdated}
                onBusinessDeleted={onBusinessDeleted}
              />
            )}
          </>
        )}
      </main>

      {selectedContactId && (
        <ContactPanel contactId={selectedContactId} onClose={() => setSelectedContactId(null)} onUpdated={reload} />
      )}

      {addContact.open && (
        <AddContactModal
          businessId={business.id}
          initialSourceUrl={addContact.initialUrl}
          onClose={() => setAddContact({ open: false })}
          onCreated={() => {
            setAddContact({ open: false });
            reload();
          }}
        />
      )}

      <MissionsSidebar
        data={missions}
        forceOpen={missionsForceOpen}
        onForceOpenHandled={() => setMissionsForceOpen(false)}
        onOpenMissionsPage={() => setMissionsPageOpen(true)}
      />

      {missionsPageOpen && <MissionsPage data={missions} onClose={() => setMissionsPageOpen(false)} />}

      <div>
        {toasts.map((t) => (
          <div key={t.id} className="mission-toast">{t.text}</div>
        ))}
      </div>
    </div>
  );
}
