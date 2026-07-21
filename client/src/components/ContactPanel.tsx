import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api/client';
import type { ContactDetail, ContactStatus, InteractionType } from '../types';
import { STATUS_META, STATUS_ORDER } from '../statusMeta';

const INTERACTION_OPTIONS: { type: InteractionType; label: string }[] = [
  { type: 'MESSAGE', label: '💬 Chatted' },
  { type: 'MEETING', label: '☕ Met up' },
  { type: 'PURCHASE', label: '💰 They bought' },
  { type: 'REVIEW', label: '⭐ Left a review' },
  { type: 'OTHER', label: '✨ Something else' },
];

export default function ContactPanel({
  contactId,
  onClose,
  onUpdated,
}: {
  contactId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<InteractionType>('MESSAGE');
  const [note, setNote] = useState('');
  const [weight, setWeight] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  // Dopamine bits
  const [deltas, setDeltas] = useState<{ rel: number; eng: number; key: number } | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setDeltas(null);
    setCelebrate(null);
    api
      .getContact(contactId)
      .then(setContact)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [contactId]);

  const handleLog = async (e: FormEvent) => {
    e.preventDefault();
    if (!contact) return;
    setSubmitting(true);
    setError(null);
    const before = { rel: contact.relationshipStrength, eng: contact.engagementScore };
    try {
      const updated = await api.logInteraction(contactId, { type, note: note || undefined, weight });
      setContact(updated);
      setNote('');
      const rel = Math.round(updated.relationshipStrength - before.rel);
      const eng = Math.round(updated.engagementScore - before.eng);
      if (rel > 0 || eng > 0) setDeltas({ rel, eng, key: Date.now() });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (status: ContactStatus) => {
    if (!contact || contact.status === status) return;
    const wasCustomer = contact.status === 'CUSTOMER';
    const updated = await api.updateContact(contact.id, { status });
    setContact({ ...contact, status: updated.status });
    if (status === 'CUSTOMER' && !wasCustomer) {
      setCelebrate(`🎉 ${contact.name} is now a customer! That's a relationship that paid off.`);
      setTimeout(() => setCelebrate(null), 4000);
    }
    onUpdated();
  };

  return (
    <aside
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: 'var(--panel)', borderLeft: '1px solid var(--panel-border)',
        padding: 20, overflowY: 'auto', zIndex: 50,
      }}
    >
      <button className="btn-secondary" onClick={onClose} style={{ float: 'right' }}>✕</button>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {contact && (
        <>
          <h2 style={{ marginBottom: 0 }}>{contact.name}</h2>
          <p style={{ color: 'var(--text-dim)', marginTop: 4, fontSize: 13 }}>
            Found on {contact.channel.label || contact.channel.type}
            {contact.sourceUrl && (
              <>
                {' · '}
                <a href={contact.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                  view profile ↗
                </a>
              </>
            )}
          </p>

          {celebrate && <div className="celebrate-banner">{celebrate}</div>}

          <div style={{ display: 'flex', gap: 6, margin: '14px 0' }}>
            {STATUS_ORDER.map((s) => {
              const meta = STATUS_META[s];
              const selected = contact.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  className={`chip ${selected ? 'selected' : ''}`}
                  onClick={() => handleStatusChange(s)}
                  style={selected ? { borderColor: meta.color, color: meta.color } : undefined}
                >
                  {meta.emoji} {meta.title}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 24, margin: '16px 0' }}>
            <ScoreBadge
              label="Relationship"
              value={contact.relationshipStrength}
              delta={deltas && deltas.rel > 0 ? deltas : null}
              deltaValue={deltas?.rel ?? 0}
            />
            <ScoreBadge
              label="Engagement"
              value={contact.engagementScore}
              delta={deltas && deltas.eng > 0 ? deltas : null}
              deltaValue={deltas?.eng ?? 0}
            />
          </div>

          <h4 style={{ marginTop: 24, marginBottom: 4 }}>What happened?</h4>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0, marginBottom: 10 }}>
            Every touch you log makes this relationship stronger.
          </p>
          <form onSubmit={handleLog}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {INTERACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  className={`chip ${type === opt.type ? 'selected' : ''}`}
                  onClick={() => setType(opt.type)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="field">
              <label>How big a deal was it?</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={1} max={5} value={weight} onChange={(e) => setWeight(Number(e.target.value))} style={{ flex: 1 }} />
                <span style={{ fontSize: 13, color: 'var(--text-dim)', minWidth: 90 }}>
                  {['tiny touch', 'small chat', 'real moment', 'big step', 'huge win'][weight - 1]}
                </span>
              </div>
            </div>
            <div className="field">
              <label>The story (optional)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What did you talk about?" />
            </div>
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Logging…' : 'Log it 🔥'}
            </button>
          </form>

          <h4 style={{ marginTop: 24, marginBottom: 8 }}>The story so far</h4>
          {contact.interactions.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Nothing logged yet — the first touch starts the story.
            </p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {contact.interactions.map((i) => {
              const opt = INTERACTION_OPTIONS.find((o) => o.type === i.type);
              return (
                <li key={i.id} style={{ borderBottom: '1px solid var(--panel-border)', padding: '8px 0', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{opt?.label ?? i.type}</strong>
                    <span style={{ color: 'var(--text-dim)' }}>{new Date(i.occurredAt).toLocaleDateString()}</span>
                  </div>
                  {i.note && <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>{i.note}</div>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}

function ScoreBadge({
  label,
  value,
  delta,
  deltaValue,
}: {
  label: string;
  value: number;
  delta: { key: number } | null;
  deltaValue: number;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {Math.round(value)}
        {delta && deltaValue > 0 && (
          <span key={delta.key} className="score-delta">+{deltaValue}</span>
        )}
      </div>
    </div>
  );
}
