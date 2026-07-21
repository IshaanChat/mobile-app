import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api/client';
import type { ContactStatus, DetectedChannel, NoLinkKind } from '../types';
import { STATUS_META, STATUS_ORDER } from '../statusMeta';
import Modal from './Modal';

const CHANNEL_EMOJI: Record<string, string> = {
  ETSY: '🧡',
  INSTAGRAM: '📸',
  REDDIT: '👽',
  REFERRAL: '🤝',
  OTHER: '🌐',
};

const NO_LINK_OPTIONS: { kind: NoLinkKind; label: string }[] = [
  { kind: 'REFERRAL', label: '🤝 Someone referred them' },
  { kind: 'IN_PERSON', label: '👋 Met in person' },
  { kind: 'OTHER', label: '✨ Somewhere else' },
];

export default function AddContactModal({
  businessId,
  initialSourceUrl,
  onClose,
  onCreated,
}: {
  businessId: string;
  initialSourceUrl?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl ?? '');
  const [noLink, setNoLink] = useState(false);
  const [noLinkKind, setNoLinkKind] = useState<NoLinkKind>('REFERRAL');
  const [detected, setDetected] = useState<DetectedChannel | null>(null);
  const [status, setStatus] = useState<ContactStatus>('PROSPECT');
  const [firstNote, setFirstNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live channel detection as the user types/pastes a link.
  useEffect(() => {
    if (noLink || !sourceUrl.trim()) {
      setDetected(null);
      return;
    }
    const t = setTimeout(() => {
      api.detectChannel(sourceUrl).then(setDetected).catch(() => setDetected(null));
    }, 300);
    return () => clearTimeout(t);
  }, [sourceUrl, noLink]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!noLink && !sourceUrl.trim()) {
      setError('Paste a link, or tap "I don\'t have a link"');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createContact({
        businessId,
        name,
        status,
        sourceUrl: noLink ? undefined : sourceUrl.trim(),
        noLinkKind: noLink ? noLinkKind : undefined,
        firstNote: firstNote.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New client" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Who are they?</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Their name" />
        </div>

        <div className="field">
          <label htmlFor="sourceUrl">Where did you find them?</label>
          {!noLink && (
            <>
              <input
                id="sourceUrl"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Paste their profile, shop, or post link…"
              />
              <div style={{ minHeight: 26, marginTop: 6 }}>
                {detected && (
                  <span className="channel-badge">
                    {CHANNEL_EMOJI[detected.type] ?? '🌐'} Found on {detected.label}
                  </span>
                )}
              </div>
            </>
          )}
          {noLink && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {NO_LINK_OPTIONS.map((opt) => (
                <button
                  key={opt.kind}
                  type="button"
                  className={`chip ${noLinkKind === opt.kind ? 'selected' : ''}`}
                  onClick={() => setNoLinkKind(opt.kind)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setNoLink(!noLink)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, padding: '4px 0', textAlign: 'left', cursor: 'pointer' }}
          >
            {noLink ? '← Actually, I have a link' : "I don't have a link"}
          </button>
        </div>

        <div className="field">
          <label>Where does this relationship stand?</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {STATUS_ORDER.map((s) => {
              const meta = STATUS_META[s];
              return (
                <div
                  key={s}
                  className={`status-card ${status === s ? 'selected' : ''}`}
                  onClick={() => setStatus(s)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setStatus(s)}
                >
                  <div style={{ fontSize: 20 }}>{meta.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{meta.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{meta.subtitle}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label htmlFor="firstNote">How did it start?</label>
          <input
            id="firstNote"
            value={firstNote}
            onChange={(e) => setFirstNote(e.target.value)}
            placeholder='e.g. "She DM’d asking about custom mugs"'
          />
          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            This becomes their first logged touch — your relationship starts with a heartbeat.
          </span>
        </div>

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Adding…' : 'Add to client book'}
        </button>
      </form>
    </Modal>
  );
}
