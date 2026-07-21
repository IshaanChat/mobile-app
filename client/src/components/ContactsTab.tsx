import { useMemo, useState } from 'react';
import type { Channel, Contact } from '../types';
import { STATUS_META, statusLabel } from '../statusMeta';

function channelName(c: Channel) {
  return c.label || c.type;
}

function lastTouch(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

type SortKey = 'relationship' | 'engagement' | 'name' | 'recent';

export default function ContactsTab({
  channels,
  contacts,
  onSelectContact,
  onAddContact,
}: {
  channels: Channel[];
  contacts: Contact[];
  onSelectContact: (id: string) => void;
  onAddContact: () => void;
}) {
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('relationship');

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const visibleContacts = useMemo(() => {
    let list = contacts;
    if (channelFilter !== 'ALL') list = list.filter((c) => c.channelId === channelFilter);
    if (statusFilter !== 'ALL') list = list.filter((c) => c.status === statusFilter);

    const sorted = [...list];
    switch (sortKey) {
      case 'relationship':
        sorted.sort((a, b) => b.relationshipStrength - a.relationshipStrength);
        break;
      case 'engagement':
        sorted.sort((a, b) => b.engagementScore - a.engagementScore);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        sorted.sort(
          (a, b) =>
            new Date(b.lastInteractionAt ?? 0).getTime() - new Date(a.lastInteractionAt ?? 0).getTime()
        );
        break;
    }
    return sorted;
  }, [contacts, channelFilter, statusFilter, sortKey]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" onClick={onAddContact}>+ New Client</button>

        <div style={{ flex: 1 }} />

        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
          <option value="ALL">Everywhere</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>{channelName(c)}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">Everyone</option>
          <option value="PROSPECT">{statusLabel('PROSPECT')}s</option>
          <option value="ENGAGED">{statusLabel('ENGAGED')}</option>
          <option value="CUSTOMER">{statusLabel('CUSTOMER')}s</option>
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="relationship">Sort: Relationship</option>
          <option value="engagement">Sort: Engagement</option>
          <option value="recent">Sort: Recently active</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {contacts.length === 0 && (
        <p style={{ color: 'var(--text-dim)' }}>
          Your client book is empty — add the first person you've talked to about your business.
        </p>
      )}

      {contacts.length > 0 && visibleContacts.length === 0 && (
        <p style={{ color: 'var(--text-dim)' }}>No clients match these filters.</p>
      )}

      {visibleContacts.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim)', fontSize: 12, borderBottom: '1px solid var(--panel-border)' }}>
              <th style={{ padding: '8px 12px 8px 0' }}>Name</th>
              <th style={{ padding: '8px 12px' }}>Found on</th>
              <th style={{ padding: '8px 12px' }}>Stage</th>
              <th style={{ padding: '8px 12px' }}>Relationship</th>
              <th style={{ padding: '8px 12px' }}>Last touch</th>
            </tr>
          </thead>
          <tbody>
            {visibleContacts.map((c) => {
              const channel = channelById.get(c.channelId);
              const meta = STATUS_META[c.status];
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelectContact(c.id)}
                  style={{ borderBottom: '1px solid var(--panel-border)', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px 10px 0', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{channel ? channelName(channel) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{meta.emoji} {meta.title}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{Math.round(c.relationshipStrength)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>{lastTouch(c.lastInteractionAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
