import type { Mission, MissionCadence, MissionCategory, MissionsPayload } from '../types';
import { CADENCE_BADGE, LevelCard } from './MissionsSidebar';

const CATEGORY_EMOJI: Record<MissionCategory, string> = {
  setup: '🧭',
  marketing: '📣',
  outreach: '🤝',
  sales: '💰',
};

const CADENCE_ORDER: MissionCadence[] = ['daily', 'weekly', 'monthly', 'once'];

// Full-screen missions board, grouped by cadence.
export default function MissionsPage({ data, onClose }: { data: MissionsPayload | null; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 60,
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>🎯 Missions</h2>
          <button className="btn-secondary" onClick={onClose}>✕ Close</button>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 4, marginBottom: 20 }}>
          Your playbook for growing this business — every completed mission earns Wisdom and levels you up.
        </p>

        {!data ? (
          <p style={{ color: 'var(--text-dim)' }}>Loading…</p>
        ) : (
          <>
            <LevelCard summary={data.summary} />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 24px' }}>
              {data.missions.filter((m) => m.completed).length} of {data.missions.length} missions complete this period
            </div>

            {CADENCE_ORDER.map((cadence) => {
              const group = data.missions.filter((m) => m.cadence === cadence);
              if (group.length === 0) return null;
              const info = data.cadenceInfo[cadence];
              const badge = CADENCE_BADGE[cadence];
              return (
                <section key={cadence} style={{ marginBottom: 28 }}>
                  <h3 style={{ marginBottom: 2 }}>{badge.emoji} {info.title}</h3>
                  <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0, marginBottom: 10 }}>{info.blurb}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.map((m) => <PageMissionRow key={m.id} mission={m} />)}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function PageMissionRow({ mission }: { mission: Mission }) {
  const pct = Math.min(100, Math.round((mission.current / mission.target) * 100));
  return (
    <div
      style={{
        background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12,
        padding: '12px 16px', opacity: mission.completed ? 0.7 : 1, boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 17 }}>{mission.completed ? '✅' : CATEGORY_EMOJI[mission.category]}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, textDecoration: mission.completed ? 'line-through' : 'none' }}>
              {mission.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{mission.description}</div>
          </div>
        </div>
        <span
          style={{
            fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
            color: mission.completed ? 'var(--customer)' : 'var(--accent)',
          }}
        >
          +{mission.xp} Wisdom
        </span>
      </div>
      {!mission.completed && mission.target > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div className="xp-track" style={{ flex: 1 }}>
            <div className="xp-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            {mission.current}/{mission.target}
          </span>
        </div>
      )}
    </div>
  );
}
