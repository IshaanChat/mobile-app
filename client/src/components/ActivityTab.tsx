import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { FeedInteraction } from '../types';

function channelName(ch: { type: string; label: string | null }) {
  return ch.label || ch.type;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ActivityTab({ businessId, refreshKey }: { businessId: string; refreshKey: number }) {
  const [feed, setFeed] = useState<FeedInteraction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getActivityFeed(businessId)
      .then(setFeed)
      .catch((e) => setError(e.message));
  }, [businessId, refreshKey]);

  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>{error}</div>;
  if (!feed) return <div style={{ padding: 24, color: 'var(--text-dim)' }}>Loading…</div>;

  if (feed.length === 0) {
    return (
      <div style={{ padding: 32, color: 'var(--text-dim)' }}>
        No activity yet. Log an interaction with a contact and it'll show up here.
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {feed.map((i) => (
          <li key={i.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--panel-border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14 }}>
                <strong>{i.contact.name}</strong>
                <span style={{ color: 'var(--text-dim)' }}> · {channelName(i.contact.channel)} · </span>
                <span>{i.type.toLowerCase()}</span>
              </div>
              {i.note && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>{i.note}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              <div>{timeAgo(i.occurredAt)}</div>
              <div style={{ marginTop: 2 }}>impact {i.weight}/5</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
