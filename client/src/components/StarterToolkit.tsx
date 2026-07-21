import { useState } from 'react';
import type { BusinessType } from '../types';
import Modal from './Modal';

// For founders who don't know what to sell yet: three honest paths with
// real trade-offs and concrete first moves. Picking one prefills the
// business type and offers starter niche ideas.

interface Path {
  type: BusinessType;
  emoji: string;
  title: string;
  tagline: string;
  examples: string[];
  cost: string;
  firstSale: string;
  goodIf: string;
  firstMoves: string[];
  nicheIdeas: string[];
}

const PATHS: Path[] = [
  {
    type: 'PRODUCT_SALES',
    emoji: '📦',
    title: 'Sell products',
    tagline: 'Physical or digital things people can buy.',
    examples: ['Handmade goods (ceramics, jewelry, candles)', 'Prints, stickers & stationery', 'Digital templates & printables', 'Curated vintage resale'],
    cost: 'Low–medium (materials, listings)',
    firstSale: 'Days to weeks',
    goodIf: 'you love making or finding things, and want something tangible to show.',
    firstMoves: [
      'Make or source 3–5 pieces you\'d proudly show a friend',
      'Photograph them in natural light on a clean background',
      'List on one marketplace (Etsy or Depop) — one is enough to start',
    ],
    nicheIdeas: ['Handmade candles', 'Digital planner templates', 'Vintage clothing resale'],
  },
  {
    type: 'SERVICE',
    emoji: '🛠️',
    title: 'Sell a service',
    tagline: 'Your skills, applied to someone else\'s problem.',
    examples: ['AI services for local businesses (chatbots, automation)', 'Consulting in your field', 'Contracting & freelance (design, writing, web)', 'Photography, tutoring, organizing'],
    cost: 'Near zero — your time is the inventory',
    firstSale: 'Often 1–3 conversations',
    goodIf: 'you already have a skill people at work or in your circle ask you about.',
    firstMoves: [
      'Write one sentence: "I help ___ do ___" — that\'s your pitch',
      'Tell 5 people you know — most first clients come from warm intros',
      'Do one project cheap or free in exchange for a testimonial',
    ],
    nicheIdeas: ['AI automation for small shops', 'Freelance web design', 'Social media management'],
  },
  {
    type: 'KNOWLEDGE',
    emoji: '🎓',
    title: 'Sell knowledge',
    tagline: 'Teach what you\'ve already lived.',
    examples: ['Online course', '1:1 or group coaching', 'Paid guides & digital books', 'Paid community or newsletter'],
    cost: 'Mostly time up front',
    firstSale: 'After trust — weeks to months of showing up',
    goodIf: 'you\'ve done something others are trying to do, and enjoy explaining it.',
    firstMoves: [
      'Pick the one transformation you can teach ("from ___ to ___")',
      'Share what you know free for 2 weeks (posts, videos) and see what resonates',
      'Offer a small paid version (workshop, mini-guide) before building the big course',
    ],
    nicheIdeas: ['Career coaching', 'A course on your craft', 'Paid newsletter in your field'],
  },
];

export default function StarterToolkit({
  onPick,
  onClose,
}: {
  onPick: (type: BusinessType, nicheIdea?: string) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<BusinessType | null>(null);

  return (
    <Modal title="What could you sell? 🧰" onClose={onClose}>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0 }}>
        Three honest paths. There's no wrong door — most people start with what they already have.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PATHS.map((path) => {
          const open = expanded === path.type;
          return (
            <div
              key={path.type}
              style={{ border: `1px solid ${open ? 'var(--accent)' : 'var(--panel-border)'}`, borderRadius: 12, padding: 14, cursor: 'pointer' }}
              onClick={() => setExpanded(open ? null : path.type)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 15 }}>{path.emoji} {path.title}</strong>
                <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>{path.tagline}</div>

              {open && (
                <div style={{ marginTop: 12, fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>For example:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--text-dim)' }}>
                      {path.examples.map((ex) => <li key={ex}>{ex}</li>)}
                    </ul>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div><strong>Startup cost:</strong> <span style={{ color: 'var(--text-dim)' }}>{path.cost}</span></div>
                    <div><strong>First sale:</strong> <span style={{ color: 'var(--text-dim)' }}>{path.firstSale}</span></div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Good fit if</strong> <span style={{ color: 'var(--text-dim)' }}>{path.goodIf}</span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong>Your first three moves:</strong>
                    <ol style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--text-dim)' }}>
                      {path.firstMoves.map((m) => <li key={m}>{m}</li>)}
                    </ol>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="btn" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => onPick(path.type)}>
                      Choose this path
                    </button>
                    {path.nicheIdeas.map((idea) => (
                      <button
                        key={idea}
                        className="chip"
                        onClick={() => onPick(path.type, idea)}
                        title="Start with this idea — you can change everything later"
                      >
                        e.g. {idea}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
