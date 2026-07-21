import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type {
  Business, Channel, Contact, ContactStatus, FeedInteraction,
  MissionsPayload, PaymentsPayload, ProductsPayload, UserProfile,
} from '../types';
import { STATUS_META } from '../statusMeta';
import { getCoolingOffDays } from '../appSettings';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default function HomeTab({
  business,
  profile,
  channels,
  contacts,
  missions,
  refreshKey,
  onSelectContact,
  onAddContact,
  onGoToMissions,
  onNavigate,
}: {
  business: Business;
  profile: UserProfile;
  channels: Channel[];
  contacts: Contact[];
  missions: MissionsPayload | null;
  refreshKey: number;
  onSelectContact: (id: string) => void;
  onAddContact: () => void;
  onGoToMissions: () => void;
  onNavigate: (dest: 'clients' | 'sales' | 'discover') => void;
}) {
  const [payments, setPayments] = useState<PaymentsPayload | null>(null);
  const [products, setProducts] = useState<ProductsPayload | null>(null);
  const [feed, setFeed] = useState<FeedInteraction[] | null>(null);

  useEffect(() => {
    api.getPayments(business.id).then(setPayments).catch(() => {});
    api.getProducts(business.id).then(setProducts).catch(() => {});
    api.getActivityFeed(business.id, 3).then(setFeed).catch(() => {});
  }, [business.id, refreshKey]);

  const { needsAttention, byStatus, topContacts } = useMemo(() => {
    const byStatus: Record<ContactStatus, number> = { PROSPECT: 0, ENGAGED: 0, CUSTOMER: 0 };
    for (const c of contacts) byStatus[c.status]++;

    const coolingOffDays = getCoolingOffDays();
    const needsAttention = contacts
      .map((c) => ({ contact: c, days: daysSince(c.lastInteractionAt) }))
      .filter(({ days }) => days === null || days >= coolingOffDays)
      .sort((a, b) => b.contact.relationshipStrength - a.contact.relationshipStrength)
      .slice(0, 4);

    const topContacts = [...contacts]
      .sort((a, b) => b.relationshipStrength - a.relationshipStrength)
      .filter((c) => c.relationshipStrength > 0)
      .slice(0, 3);

    return { needsAttention, byStatus, topContacts };
  }, [contacts]);

  const firstName = profile.name.split(' ')[0];
  const nextMission = missions?.missions.find((m) => !m.completed);
  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {dateLine}
        </div>
        <h2 style={{ margin: '4px 0 2px' }}>{greeting()}, {firstName} 👋</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: 0 }}>
          Here's where <strong style={{ color: 'var(--text)' }}>{business.name}</strong> stands.
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button className="btn" onClick={onAddContact}>+ New Client</button>
        <button className="btn-secondary" onClick={() => onNavigate('sales')}>💰 Record a sale</button>
        <button className="btn-secondary" onClick={() => onNavigate('sales')}>🏷️ Add a product</button>
        <button className="btn-secondary" onClick={() => onNavigate('discover')}>🔭 Find customers</button>
      </div>

      {/* Next mission banner */}
      {nextMission && (
        <div className="attention-row" onClick={onGoToMissions} style={{ borderColor: 'var(--accent)', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>NEXT MISSION</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>🎯 {nextMission.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              {nextMission.description}
              {nextMission.target > 1 && ` (${nextMission.current}/${nextMission.target})`}
            </div>
          </div>
          <span style={{ fontSize: 13, color: 'var(--accent)', whiteSpace: 'nowrap', fontWeight: 700 }}>
            +{nextMission.xp} Wisdom →
          </span>
        </div>
      )}

      {/* The breakdown grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Network pulse */}
        <HomeCard title="Your network" emoji="🤝" onOpen={() => onNavigate('clients')}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <BigStat value={String(contacts.length)} label={contacts.length === 1 ? 'person' : 'people'} />
            {(['PROSPECT', 'ENGAGED', 'CUSTOMER'] as ContactStatus[]).map((s) => (
              <BigStat key={s} value={String(byStatus[s])} label={`${STATUS_META[s].emoji} ${STATUS_META[s].title.toLowerCase()}`} color={STATUS_META[s].color} />
            ))}
          </div>
          {contacts.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 0 }}>
              Every business starts with one person who cared. Add yours.
            </p>
          )}
        </HomeCard>

        {/* Money */}
        <HomeCard title="Money" emoji="💵" onOpen={() => onNavigate('sales')}>
          {payments ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <BigStat value={money(payments.summary.thisMonth)} label="this month" color="var(--customer)" />
              <BigStat value={money(payments.summary.total)} label="all time" />
              <BigStat value={String(payments.summary.count)} label={payments.summary.count === 1 ? 'payment' : 'payments'} />
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 0 }}>Loading…</p>
          )}
          {payments && payments.summary.count === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 0 }}>
              The first dollar is the hardest — and the sweetest. Record it when it lands.
            </p>
          )}
        </HomeCard>

        {/* The shelf */}
        <HomeCard title="The shelf" emoji="🏷️" onOpen={() => onNavigate('sales')}>
          {products ? (
            <>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <BigStat value={String(products.summary.count)} label={products.summary.count === 1 ? 'listing' : 'listings'} />
                <BigStat value={money(products.summary.inventoryValue)} label="inventory value" />
                {products.summary.lowStock > 0 && (
                  <BigStat value={String(products.summary.lowStock)} label="running low ⚠️" color="var(--danger)" />
                )}
              </div>
              {products.summary.count === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 0 }}>
                  Give people something to say yes to — add your first product or offering.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 0 }}>Loading…</p>
          )}
        </HomeCard>

        {/* Who needs you */}
        <HomeCard title="Who needs you" emoji="🔥">
          {needsAttention.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 0 }}>
              You're on top of everyone. Nothing's going cold. 🔥
            </p>
          ) : (
            needsAttention.map(({ contact, days }) => {
              const channel = channels.find((ch) => ch.id === contact.channelId);
              return (
                <div
                  key={contact.id}
                  onClick={() => onSelectContact(contact.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--panel-border)', cursor: 'pointer', fontSize: 13 }}
                >
                  <span>
                    {STATUS_META[contact.status].emoji} <strong>{contact.name}</strong>
                    <span style={{ color: 'var(--text-dim)' }}>
                      {channel ? ` · ${channel.label || channel.type}` : ''}
                      {days === null ? ' · never contacted' : ` · ${days}d quiet`}
                    </span>
                  </span>
                  <span style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }}>Check in →</span>
                </div>
              );
            })
          )}
        </HomeCard>

        {/* Recent moves */}
        <HomeCard title="Recent moves" emoji="⚡" onOpen={() => onNavigate('clients')}>
          {!feed || feed.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 0 }}>
              No activity yet — log your first interaction and the story starts here.
            </p>
          ) : (
            feed.map((i) => (
              <div key={i.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--panel-border)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span><strong>{i.contact.name}</strong> · {i.type.toLowerCase()}</span>
                  <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{timeAgo(i.occurredAt)}</span>
                </div>
                {i.note && <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>{i.note}</div>}
              </div>
            ))
          )}
        </HomeCard>

        {/* Strongest relationships */}
        {topContacts.length > 0 && (
          <HomeCard title="Strongest relationships" emoji="🏆">
            {topContacts.map((c, i) => (
              <div
                key={c.id}
                onClick={() => onSelectContact(c.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--panel-border)', fontSize: 13, cursor: 'pointer' }}
              >
                <span>
                  <span style={{ marginRight: 6 }}>{['🥇', '🥈', '🥉'][i]}</span>
                  <strong>{c.name}</strong>
                </span>
                <span style={{ color: 'var(--customer)', fontWeight: 700 }}>{Math.round(c.relationshipStrength)}</span>
              </div>
            ))}
          </HomeCard>
        )}
      </div>
    </div>
  );
}

function HomeCard({ title, emoji, onOpen, children }: { title: string; emoji: string; onOpen?: () => void; children: React.ReactNode }) {
  return (
    <section style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{emoji} {title}</h3>
        {onOpen && (
          <button
            onClick={onOpen}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            Open →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function BigStat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</div>
    </div>
  );
}
