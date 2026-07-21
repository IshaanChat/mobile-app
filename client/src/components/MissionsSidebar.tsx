import { useState } from 'react';
import type { Mission, MissionCadence, MissionsPayload } from '../types';
import { getMissionsPinned, setMissionsPinned } from '../appSettings';

export const CADENCE_BADGE: Record<MissionCadence, { label: string; emoji: string }> = {
  daily: { label: 'Daily', emoji: '☀️' },
  weekly: { label: 'Weekly', emoji: '📅' },
  monthly: { label: 'Monthly', emoji: '🗓️' },
  once: { label: 'Milestone', emoji: '🏆' },
};

const CADENCE_PRIORITY: Record<MissionCadence, number> = { daily: 0, weekly: 1, monthly: 2, once: 3 };

// Slim rail on the right edge; hover to peek the next 6 missions,
// click the rail (or "See all") to open the full missions page.
export default function MissionsSidebar({
  data,
  forceOpen,
  onForceOpenHandled,
  onOpenMissionsPage,
}: {
  data: MissionsPayload | null;
  forceOpen: boolean;
  onForceOpenHandled: () => void;
  onOpenMissionsPage: () => void;
}) {
  const [pinned, setPinned] = useState(getMissionsPinned());
  const [hovered, setHovered] = useState(false);

  const open = pinned || hovered || forceOpen;

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    setMissionsPinned(next);
    if (!next) onForceOpenHandled();
  };

  const summary = data?.summary;
  const upNext = data
    ? [...data.missions]
        .filter((m) => !m.completed)
        .sort((a, b) => CADENCE_PRIORITY[a.cadence] - CADENCE_PRIORITY[b.cadence] || b.xp - a.xp)
        .slice(0, 6)
    : [];

  return (
    <>
      {!open && (
        <div
          className="missions-rail"
          role="button"
          tabIndex={0}
          aria-label="Open missions"
          onMouseEnter={() => setHovered(true)}
          onClick={onOpenMissionsPage}
          onKeyDown={(e) => e.key === 'Enter' && onOpenMissionsPage()}
          title="Missions — hover to peek, click for the full board"
        >
          <span style={{ fontSize: 18 }}>🎯</span>
          {summary && (
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>L{summary.level}</span>
          )}
          <span className="rail-label">Missions</span>
          {summary && (
            <div className="xp-track" style={{ width: 6, height: 80, marginTop: 'auto' }}>
              <div
                className="xp-fill"
                style={{
                  width: '100%',
                  height: summary.nextLevelXp !== null
                    ? `${Math.min(100, Math.round(((summary.xp - summary.currentLevelXp) / (summary.nextLevelXp - summary.currentLevelXp)) * 100))}%`
                    : '100%',
                }}
              />
            </div>
          )}
        </div>
      )}

      <aside
        className={`missions-panel ${open ? 'open' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); onForceOpenHandled(); }}
      >
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>🎯 Up next</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-secondary"
                onClick={togglePin}
                title={pinned ? 'Unpin — sidebar closes when you move away' : 'Pin the sidebar open'}
                style={{ padding: '4px 12px', fontSize: 13 }}
              >
                {pinned ? '→' : '📌'}
              </button>
            </div>
          </div>

          {!data || !summary ? (
            <p style={{ color: 'var(--text-dim)' }}>Loading missions…</p>
          ) : (
            <>
              <LevelCard summary={summary} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                {upNext.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                    All caught up — fresh missions arrive with the next reset. 🔥
                  </p>
                ) : (
                  upNext.map((m) => <SidebarMissionRow key={m.id} mission={m} />)
                )}
              </div>

              <button className="btn" onClick={onOpenMissionsPage} style={{ width: '100%', marginTop: 16 }}>
                See all missions →
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export function LevelCard({ summary }: { summary: NonNullable<MissionsPayload['summary']> }) {
  const xpIntoLevel = summary.xp - summary.currentLevelXp;
  const levelSpan = summary.nextLevelXp !== null ? summary.nextLevelXp - summary.currentLevelXp : null;
  const pct = levelSpan ? Math.min(100, Math.round((xpIntoLevel / levelSpan) * 100)) : 100;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--accent-soft), rgba(95, 155, 122, 0.08))',
        border: '1px solid var(--accent)', borderRadius: 12, padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Level {summary.level} of 100</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.levelName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{summary.xp}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Wisdom{summary.nextLevelXp !== null ? ` · ${summary.nextLevelXp - summary.xp} to next` : ' · max'}
          </div>
        </div>
      </div>
      <div className="xp-track" style={{ marginTop: 12 }}>
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SidebarMissionRow({ mission }: { mission: Mission }) {
  const pct = Math.min(100, Math.round((mission.current / mission.target) * 100));
  const badge = CADENCE_BADGE[mission.cadence];
  return (
    <div
      style={{
        background: 'var(--input-bg)', border: '1px solid var(--panel-border)', borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{mission.title}</span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', border: '1px solid var(--panel-border)', borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>
              {badge.emoji} {badge.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{mission.description}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--accent)' }}>
          +{mission.xp}
        </span>
      </div>
      {mission.target > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div className="xp-track" style={{ flex: 1, height: 6 }}>
            <div className="xp-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            {mission.current}/{mission.target}
          </span>
        </div>
      )}
    </div>
  );
}
