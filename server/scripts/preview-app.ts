/**
 * Integrated app prototype — Discover + Grow + Journey in one phone-framed
 * shell with a bottom tab bar. The base version of the whole app.
 *
 *   npm run app:preview
 *
 * Pulls the same content the previews use (niches.json, communities.json)
 * plus the milestone journey (missions.json). The point of this build over
 * the isolated previews: milestones complete by ACTING — opening Discover,
 * picking a niche, opening a community all check off Journey steps; a few
 * steps (open a shop, first sale) are self-checked as outside-app. Progress
 * persists in the browser (localStorage). Preview only — no database, no
 * deploy, nothing touches the live app.
 */

import { readdirSync, readFileSync } from 'fs';
import { createServer } from 'http';

const PORT = Number(process.env.PREVIEW_PORT ?? 4300);
const dir = 'content';

const SOURCING_LABELS: Record<string, string> = {
  DROPSHIP: 'Dropship', WHOLESALE: 'Wholesale', PRINT_ON_DEMAND: 'Print on demand',
  MATERIALS: 'Materials', MAKE_YOUR_OWN: 'Make your own',
};
const AUDIENCE_LABELS: Record<string, string> = { maker: 'Maker', reseller: 'Reseller', both: 'Maker + reseller' };
// Deepened sage / honey / rose from the artisan palette — these chips carry
// white text over photos, so they need more depth than the palette's base
// values to stay legible.
const AUDIENCE_COLORS: Record<string, string> = {
  maker: '#4A7C61',
  reseller: '#8C5E15',
  both: '#A8536C',
};
const PLATFORM_COLORS: Record<string, string> = {
  reddit: '#FF4500', instagram: '#C13584', tiktok: '#0F0F0F', x: '#1D1D1F',
  youtube: '#CC0000', etsy: '#F1641E', pinterest: '#E60023', facebook: '#1877F2',
  discord: '#5865F2', forum: '#5A67D8',
};
const KIND_LABELS: Record<string, string> = {
  community: 'Community', hashtag: 'Hashtag', marketplace: 'Marketplace', search: 'Search recipe', event: 'Event',
};

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s: any) => esc(s).replace(/"/g, '&quot;');
const lines = (s: any) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const pColor = (p: string) => PLATFORM_COLORS[String(p).toLowerCase()] ?? '#5A67D8';

// Ad-intelligence helpers. A product's research record is what turns the feed
// from "ideas someone had" into "things provably selling right now".
const DAY = 86400000;
function daysRunning(r: any): number | null {
  if (!r?.firstSeen) return null;
  const end = r.lastSeen ? new Date(r.lastSeen) : new Date();
  const d = Math.round((end.getTime() - new Date(r.firstSeen).getTime()) / DAY);
  return Number.isFinite(d) && d >= 0 ? d : null;
}
function daysSinceChecked(r: any): number | null {
  if (!r?.checkedAt) return null;
  return Math.round((Date.now() - new Date(r.checkedAt).getTime()) / DAY);
}
const TREND_MARK: Record<string, string> = { rising: '▲', steady: '→', fading: '▼' };

const compact = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  : n >= 1_000 ? (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  : String(n);

// Saturation read off real listing counts rather than hand-set.
function saturationOf(s: any): 'low' | 'medium' | 'high' {
  if (!s || s.listings === undefined) return 'medium';
  return s.listings < 120 ? 'low' : s.listings < 600 ? 'medium' : 'high';
}

function evidenceStrip(r: any, s?: any) {
  const chips: string[] = [];
  // Machine signals first — units sold is the hardest evidence available.
  if (s?.unitsSold) chips.push(`<span class="ev-chip rising">▲ ${compact(s.unitsSold)} sold</span>`);
  if (s && saturationOf(s) === 'low' && s.listings !== undefined) {
    chips.push('<span class="ev-chip fresh">low competition</span>');
  }
  // Then anything logged by hand at the research bench.
  const run = daysRunning(r);
  if (run !== null && run >= 7) {
    chips.push(`<span class="ev-chip rising">${TREND_MARK[r?.trend] ?? '▲'} ${run} days live</span>`);
  }
  if (!s && r?.saturation === 'low') chips.push('<span class="ev-chip fresh">low competition</span>');
  return chips.length ? `<div class="ev-strip">${chips.slice(0, 2).join('')}</div>` : '';
}

function signalsBox(s: any) {
  if (!s || !s.sources?.length) return '';
  const bits: string[] = [];
  if (s.unitsSold) bits.push(`<strong>${compact(s.unitsSold)}</strong> sold recently`);
  if (s.listings !== undefined) bits.push(`${compact(s.listings)} competing sellers`);
  if (s.views) bits.push(`${compact(s.views)} views on reviews`);
  if (s.mentions) bits.push(`${s.mentions} mentions`);
  const price = s.priceLow ? `sourcing from $${Number(s.priceLow).toFixed(2)}` : '';
  return `<div class="ev-box">
    <div class="ev-k">Demand right now · heat ${s.heat}</div>
    <div class="ev-t">${bits.join(' · ')}${price ? '<br>' + price : ''}</div>
    <div class="ev-m"><span>${esc(s.sources.join(', '))}</span><span>polled ${esc(s.polledAt ?? '')}</span></div>
  </div>`;
}

function evidenceBox(r: any) {
  if (!r) return '';
  const run = daysRunning(r);
  const stale = daysSinceChecked(r);
  const bits: string[] = [];
  if (r.advertiser) bits.push(`Seen on <strong>${esc(r.advertiser)}</strong>`);
  if (r.engagement) bits.push(esc(r.engagement));
  if (r.adCount) bits.push(`${r.adCount} creatives running`);
  const meta: string[] = [];
  if (r.adUrl) meta.push(`<a href="${attr(r.adUrl)}" target="_blank" rel="noreferrer">See the ad ↗</a>`);
  if (r.storeUrl) meta.push(`<a href="${attr(r.storeUrl)}" target="_blank" rel="noreferrer">Their store ↗</a>`);
  if (stale !== null) {
    meta.push(`<span class="${stale > 21 ? 'ev-stale' : ''}">checked ${stale === 0 ? 'today' : stale + 'd ago'}</span>`);
  }
  const head = run !== null
    ? `Running for ${run} days on ${esc(r.adPlatform ?? 'ads')}`
    : `Spotted on ${esc(r.adPlatform ?? 'ads')}`;
  return `<div class="ev-box">
    <div class="ev-k">Why this one</div>
    <div class="ev-t">${esc(head)}${bits.length ? ' · ' + bits.join(' · ') : ''}${r.notes ? '<br>' + esc(r.notes) : ''}</div>
    ${meta.length ? `<div class="ev-m">${meta.join('')}</div>` : ''}
  </div>`;
}

function supplierRows(r: any) {
  const list = r?.sourceCandidates ?? [];
  if (!list.length) return '';
  return `<div class="mini"><div class="mini-t">Where to actually buy it</div>${
    list.map((s: any) => `<div class="lrow" style="border-bottom:none;padding:6px 0">
      <div class="lrow-main">${esc(s.supplier)}${s.unitCost ? ` · <strong>${esc(s.unitCost)}</strong>` : ''}
        <div class="lrow-sub">${[s.moq ? 'MOQ ' + esc(String(s.moq)) : '', s.shipDays ? esc(s.shipDays) + ' days' : ''].filter(Boolean).join(' · ')}</div></div>
      ${s.url ? `<a class="hcard-a" href="${attr(s.url)}" target="_blank" rel="noreferrer">Open ↗</a>` : ''}
    </div>`).join('')
  }</div>`;
}

// Discover is a feed of PRODUCTS — the niche is a label on the card, not the
// unit you scroll. Each product carries its niche so filtering, matching and
// "choose this" still work at the niche level.
function productCard(p: any) {
  const n = p.niche ?? {};
  const r = p.research;
  const sig = p.signals;
  const aud = AUDIENCE_COLORS[n.audience] ?? '#60646c';
  const searchText = [p.title, p.blurb, n.name, n.domain, n.tags].filter(Boolean).join(' ').toLowerCase();
  return `<div class="card product" data-slug="${attr(p.slug)}" data-niche="${attr(p.nicheSlug)}" data-aud="${attr(n.audience)}" data-text="${attr(searchText)}">
    <div class="head" onclick="toggleCard(this,'open-niche')">
      <div class="hero" style="background-image:url('${attr(p.imageUrl)}')">
        <div class="chips"><span class="chip" style="background:${aud}">${esc(AUDIENCE_LABELS[n.audience] ?? n.audience ?? '')}</span><span class="chip chip-dark">${esc(SOURCING_LABELS[p.sourcingType] ?? '')}</span></div>
        <span class="match-badge">&#9733; your kind of thing</span>
        ${evidenceStrip(r, sig)}
      </div>
      <button class="savebtn" title="Save to your shelf" onclick="event.stopPropagation(); toggleSave('${attr(p.slug)}', this)"><svg><use href="#i-heart"/></svg></button>
      <div class="body"><div class="titlerow"><div><div class="kicker">${esc(n.name ?? '')}</div><div class="title">${esc(p.title)}</div><div class="econ-inline"><span class="cost">${esc(p.sourceCost)}</span><span class="arrow">&rarr;</span><span class="resale">${esc(p.typicalResale)}</span></div></div><div class="chev">&#9660;</div></div></div>
    </div>
    <div class="expand">
      <p class="para">${esc(p.blurb)}</p>
      ${signalsBox(sig)}
      ${evidenceBox(r)}
      ${supplierRows(r)}
      <div class="mini"><div class="mini-t">Where to source</div><div class="src-b">${esc(p.sourceName)} &middot; ${esc(SOURCING_LABELS[p.sourcingType] ?? '')}</div></div>
      <a class="btn ghost" href="${attr(p.sourcingUrl)}" target="_blank" rel="noreferrer" onclick="fire('view-source')">Source it &#8599;</a>
      <button class="btn primary" data-slug="${attr(p.nicheSlug)}" data-name="${attr(n.name ?? '')}" data-tags="${attr(n.tags ?? '')}" onclick="chooseNiche(this)">Build a business around this</button>
    </div>
  </div>`;
}

function bullets(text: string, mark: string, cls: string) {
  return lines(text).map((li) => `<div class="row"><span class="mk ${cls}">${mark}</span><span>${esc(li)}</span></div>`).join('');
}

function communityCard(c: any) {
  const overview = String(c.overview ?? '').split(/\n\s*\n/).map((x: string) => `<p class="para">${esc(x.trim())}</p>`).join('');
  return `<div class="card community" data-slug="${attr(c.slug)}" data-tags="${attr(c.tags)}">
    <div class="head" onclick="toggleCard(this,'open-community')">
      <div class="hero" style="background-image:url('${attr(c.imageUrl)}')">
        <div class="chips"><span class="chip" style="background:${pColor(c.platform)}">${esc(c.platform)}</span><span class="chip chip-dark">${esc(KIND_LABELS[c.kind] ?? c.kind)}</span></div>
        <span class="match-badge">&#9733; your niche</span>
      </div>
      <div class="body"><div class="titlerow"><div><div class="title">${esc(c.title)}</div><div class="tagline">${esc(c.tagline)}</div></div><div class="chev">&#9660;</div></div></div>
    </div>
    <div class="expand">
      ${overview}
      <div class="who"><div class="who-t">Who you'll find here</div><div class="who-b">${esc(c.audience)}</div></div>
      <div class="sec"><div class="sec-t">What they talk about</div>${bullets(c.discussions, '&bull;', 'm-dot')}</div>
      <div class="sec"><div class="sec-t">What wins them over</div>${bullets(c.loves, '&check;', 'm-good')}</div>
      <div class="sec"><div class="sec-t">What turns them off</div>${bullets(c.dislikes, '&times;', 'm-bad')}</div>
      <div class="sec"><div class="sec-t">House rules</div>${bullets(c.rules, '&sect;', 'm-dot')}</div>
      <div class="play"><div class="play-t">The play</div><div>${esc(c.approach)}</div></div>
      <a class="btn ghost" href="${attr(c.url)}" target="_blank" rel="noreferrer">Explore ${esc(c.title)} &#8599;</a>
      <button class="btn primary pick-community" data-slug="${attr(c.slug)}" data-title="${attr(c.title)}" onclick="focusCommunity(this)">Focus on this community</button>
    </div>
  </div>`;
}

function milestoneRow(m: any) {
  let action = '';
  if (m.where === 'outside') {
    action = `<button class="mini-btn" onclick="markDone(this)">Mark done</button>`;
  } else if (m.trigger === 'name-business') {
    action = `<div class="inline-form"><input class="name-in" placeholder="Business name"><button class="mini-btn" onclick="saveName(this)">Save</button></div>`;
  } else if (m.trigger === 'start-business') {
    action = `<button class="mini-btn" onclick="startBiz(this)">Start my business</button>`;
  } else if (m.trigger === 'log-sale') {
    action = `<button class="mini-btn" onclick="logSale(this)">Log a sale</button>`;
  } else {
    action = `<button class="mini-btn" data-tab="${esc(m.tab)}" onclick="goTab(this)">Go do it &#8599;</button>`;
  }
  return `<div class="ms" data-id="${attr(m.id)}" data-level="${m.level}" data-trigger="${attr(m.trigger ?? '')}">
    <div class="ms-check"></div>
    <div class="ms-main">
      <div class="ms-title">${esc(m.title)}</div>
      <div class="ms-detail">${esc(m.detail)}</div>
      <div class="ms-action">${action}</div>
    </div>
    <span class="ms-where ${m.where === 'outside' ? 'out' : 'inapp'}">${m.where === 'outside' ? 'Outside app' : 'In app'}</span>
  </div>`;
}

function page(products: any[], communities: any[], missions: any, onboarding: any) {
  const domains = [...new Set(products.map((p) => p.niche?.domain).filter(Boolean))];
  const byLevel = (lv: number) => missions.milestones.filter((m: any) => m.level === lv);
  const levelsHtml = missions.levels.map((lv: any) => `
    <section class="level lvsec" data-level="${lv.level}">
      <div class="lvsec-h" onclick="toggleLevel(${lv.level})">
        <span class="lv-num">${lv.level}</span>
        <span class="lvsec-t"><span class="lvsec-n">${esc(lv.name)}</span><span class="lvsec-s">${esc(lv.title)}</span></span>
        <span class="lvsec-c" id="lvc-${lv.level}"></span>
        <span class="lvsec-x"><svg class="ic-sm"><use href="#i-chev"/></svg></span>
      </div>
      <div class="ms-list">${byLevel(lv.level).map(milestoneRow).join('')}</div>
    </section>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sales Mechanic — base app</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* Sales Mechanic — warm, encouraging, built for first-time founders.
     Light "the artisan": blush cream, dusty rose, honey and sage.
     Dark "the grind": warm charcoal and gold, not techy navy.
     Same palette as the web client and the native app. */
  :root {
    --surround:#ece2dc;
    --bg:#fbf4f0;
    --panel:#ffffff;
    --panel-border:#eedbd4;
    --input-bg:#f8ede8;
    --text:#34262b;
    --text-dim:#98818a;
    --accent:#c2647e;
    --accent-soft:rgba(194,100,126,0.1);
    --on-accent:#ffffff;
    --prospect:#a3919a;
    --engaged:#cf8f2e;
    --customer:#5f9b7a;
    --danger:#cc4f4f;
    --scoreboard:#34262b;
    --shadow:0 2px 12px rgba(90,50,60,0.07);
    /* A warm wonky serif for anything that speaks, a clean sans for the rest.
       The pairing is what stops this reading as a default template. */
    --font-display:'Fraunces','Iowan Old Style',Georgia,serif;
    /* Jakarta over Inter: Inter is deliberately neutral, which always reads
       as a default. This one carries warmth in the a, g and y — enough
       character for a card title without needing the serif. */
    --font-sans:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --surround:#050609;
      --bg:#0b0c0f;
      --panel:#14161b;
      --panel-border:#262a33;
      --input-bg:#0b0c0f;
      --text:#edeef2;
      --text-dim:#8b92a0;
      --accent:#e3a82b;
      --accent-soft:rgba(227,168,43,0.12);
      --on-accent:#1a1408;
      --prospect:#79808f;
      --engaged:#5b9cf0;
      --customer:#34c477;
      --danger:#e5484d;
      --scoreboard:#14161b;
      --shadow:0 2px 12px rgba(0,0,0,0.45);
    }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--surround); font-family:var(--font-sans); color:var(--text); -webkit-font-smoothing:antialiased; }
  /* The serif is for single moments — a screen title, one question, one big
     number. Repeated down a feed it gets heavy, so card titles and section
     headings stay sans. */
  h1,h2,.onb-title,.onb-rev-title,.next-t,.lvname,.stat-v,.mhead h2 {
    font-family:var(--font-display); font-weight:600; letter-spacing:-0.015em; font-optical-sizing:auto;
  }
  .title,.hcard-t,.sec-t,.pc-name { font-family:var(--font-sans); font-weight:600; letter-spacing:-0.022em; }
  .kicker { font-weight:600; }
  .stat-v, .econ-inline, .econ, .money, .strength, .lvcount, .lvsec-c { font-variant-numeric:tabular-nums; }
  .stat-v { font-weight:700; }
  .app { max-width:430px; margin:0 auto; background:var(--bg); min-height:100vh; position:relative; padding-bottom:76px; }
  .screen { display:none; padding:16px; }
  .screen.active { display:block; }
  .top h1 { font-size:22px; margin:6px 0 2px; }
  .top .sub { color:var(--text-dim); font-size:13px; margin-bottom:12px; }
  .filters { display:flex; gap:8px; overflow-x:auto; margin-bottom:6px; }
  .chipbtn { border:1px solid var(--panel-border); background:var(--panel); color:var(--text-dim); border-radius:999px; padding:7px 14px; font-size:13px; cursor:pointer; white-space:nowrap; transition:border-color .15s, color .15s, background .15s; }
  .chipbtn:hover { border-color:var(--accent); }
  .chipbtn.on { background:var(--accent-soft); color:var(--text); border-color:var(--accent); font-weight:600; }
  .card { background:var(--panel); border:1px solid var(--panel-border); border-radius:16px; overflow:hidden; margin-bottom:16px; box-shadow:var(--shadow); }
  .head { cursor:pointer; }
  .hero { height:170px; background-size:cover; background-position:center; position:relative; }
  .chips { position:absolute; left:14px; bottom:14px; display:flex; gap:8px; }
  .chip { color:#fff; font-size:12px; font-weight:600; padding:4px 10px; border-radius:999px; }
  .chip-dark { background:rgba(0,0,0,0.55); font-weight:500; }
  .match-badge { position:absolute; right:14px; top:14px; background:var(--accent); color:var(--on-accent); font-size:11px; font-weight:600; padding:4px 10px; border-radius:999px; display:none; }
  .card.match .match-badge { display:block; }
  .card.match { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent), var(--shadow); }
  .body { padding:14px 16px; }
  .titlerow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .kicker { color:var(--text-dim); font-size:11px; text-transform:uppercase; letter-spacing:0.4px; }
  .title { font-size:18px; font-weight:600; margin-top:2px; }
  .tagline { color:var(--text-dim); font-size:14px; margin-top:3px; line-height:1.4; }
  .econ-inline { font-size:14px; font-variant:tabular-nums; margin-top:5px; }

  /* Evidence that a product is actually working — the thing that separates
     a researched feed from a list of ideas. */
  .ev-strip { position:absolute; left:14px; top:14px; display:flex; gap:6px; }
  .ev-chip { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:4px 9px; border-radius:999px; background:rgba(255,255,255,.92); color:#7a4a2a; }
  .ev-chip.rising { color:#8a3a1a; }
  .ev-chip.fresh { color:#3d6b52; }
  .ev-box { border:1px solid var(--panel-border); border-left:3px solid var(--engaged); border-radius:0 12px 12px 0; padding:11px 13px; margin-top:12px; background:var(--input-bg); }
  .ev-k { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--engaged); }
  .ev-t { font-size:13px; line-height:1.5; margin-top:4px; }
  .ev-m { font-size:12px; color:var(--text-dim); margin-top:6px; display:flex; flex-wrap:wrap; gap:10px; }
  .ev-m a { color:var(--accent); text-decoration:none; font-weight:600; }
  .ev-stale { color:var(--danger); }
  .dom-h { font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim); margin:22px 0 10px; }
  .chev { color:var(--text-dim); font-size:12px; padding-top:4px; transition:transform .15s; }
  .card.open .chev { transform:rotate(180deg); }
  .expand { display:none; padding:0 16px 16px; }
  .card.open .expand { display:block; }
  .para { font-size:14px; line-height:1.6; margin:12px 0 0; }
  .mini { background:var(--input-bg); border-radius:12px; padding:10px 12px; margin-top:12px; }
  .mini-t { font-size:12px; font-weight:600; color:var(--text-dim); }
  .econ { font-size:15px; font-variant:tabular-nums; margin-top:2px; }
  .cost { color:var(--text-dim); } .arrow { color:var(--text-dim); margin:0 8px; } .resale { color:var(--customer); font-weight:700; }
  .src-b { font-size:14px; margin-top:2px; }
  .who { background:var(--input-bg); border-radius:12px; padding:12px 14px; margin:14px 0; }
  .who-t { font-size:13px; font-weight:600; } .who-b { font-size:13px; color:var(--text-dim); margin-top:4px; line-height:1.5; }
  .sec { margin-top:16px; } .sec-t { font-size:15px; font-weight:600; margin-bottom:8px; }
  .row { display:flex; gap:10px; font-size:13px; color:var(--text-dim); line-height:1.5; margin-bottom:7px; }
  .mk { width:15px; text-align:center; flex:0 0 15px; } .m-good{color:var(--customer);} .m-bad{color:var(--danger);} .m-dot{color:var(--text-dim);}
  .play { border:1.5px solid var(--accent); background:var(--accent-soft); border-radius:12px; padding:12px 14px; margin-top:18px; }
  .play-t { color:var(--accent); font-weight:600; font-size:13px; margin-bottom:4px; }
  .play div:last-child { font-size:13px; line-height:1.6; }
  .btn { display:block; text-align:center; font-weight:600; font-size:14px; padding:13px; border-radius:999px; margin-top:12px; text-decoration:none; border:none; width:100%; cursor:pointer; transition:transform .1s, opacity .15s; }
  .btn:hover { opacity:.92; transform:translateY(-1px); }
  .btn.ghost { background:transparent; color:var(--text); border:1px solid var(--panel-border); }
  .btn.ghost:hover { border-color:var(--accent); }
  .btn.primary { background:var(--accent); color:var(--on-accent); }
  .banner { background:var(--accent-soft); border:1px solid var(--accent); color:var(--text); font-size:13px; padding:10px 14px; border-radius:12px; margin-bottom:14px; display:none; }
  .banner.on { display:block; }
  .progress-card { background:var(--scoreboard); border:1px solid var(--panel-border); color:#fdf7f4; border-radius:16px; padding:16px; margin-bottom:16px; }
  .pc-level { font-size:13px; opacity:.75; }
  .pc-name { font-size:22px; font-weight:600; margin:2px 0 12px; }
  .pc-bar { height:10px; background:rgba(255,255,255,.16); border-radius:999px; overflow:hidden; }
  .pc-fill { height:100%; border-radius:999px; background:linear-gradient(90deg, var(--accent), var(--customer)); width:0%; transition:width .6s ease; }
  .pc-xp { font-size:12px; opacity:.75; margin-top:8px; }
  .level { margin-bottom:8px; }
  .level-h { display:flex; align-items:center; gap:8px; margin:18px 0 10px; }
  .lv-num { width:24px; height:24px; border-radius:50%; background:var(--panel-border); color:var(--panel); font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; }
  .level.unlocked .lv-num { background:var(--accent); color:var(--on-accent); }
  .level.done .lv-num { background:var(--customer); color:#fff; }
  .lv-name { font-size:16px; font-weight:600; }
  .lv-title { font-size:13px; color:var(--text-dim); }
  .lv-lock { margin-left:auto; font-size:13px; }
  .level.unlocked .lv-lock, .level.done .lv-lock { display:none; }
  .ms { display:flex; gap:12px; align-items:flex-start; background:var(--panel); border:1px solid var(--panel-border); border-radius:14px; padding:14px; margin-bottom:10px; box-shadow:var(--shadow); }
  .ms-check { width:22px; height:22px; border-radius:50%; border:2px solid var(--panel-border); flex:0 0 22px; margin-top:1px; position:relative; }
  .ms.done .ms-check { background:var(--customer); border-color:var(--customer); }
  .ms.done .ms-check:after { content:'\\2713'; color:#fff; font-size:13px; position:absolute; left:4px; top:-1px; }
  .ms-main { flex:1; }
  .ms-title { font-size:15px; font-weight:600; }
  .ms.done .ms-title { color:var(--text-dim); text-decoration:line-through; }
  .ms-detail { font-size:13px; color:var(--text-dim); margin-top:2px; line-height:1.45; }
  .ms-action { margin-top:8px; }
  .ms.done .ms-action { display:none; }
  .mini-btn { border:1px solid var(--accent); background:transparent; color:var(--accent); font-size:13px; font-weight:600; padding:7px 14px; border-radius:999px; cursor:pointer; transition:background .15s; }
  .mini-btn:hover { background:var(--accent-soft); }
  .inline-form { display:flex; gap:8px; }
  .name-in { flex:1; border:1px solid var(--panel-border); background:var(--input-bg); color:var(--text); border-radius:10px; padding:8px 12px; font-size:13px; transition:border-color .15s; }
  .name-in:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
  .ms-where { font-size:10px; font-weight:600; padding:3px 8px; border-radius:999px; white-space:nowrap; }
  .ms-where.inapp { background:var(--accent-soft); color:var(--accent); }
  .ms-where.out { background:var(--input-bg); color:var(--text-dim); }
  .level.locked { opacity:.5; }
  .level.locked .ms-action { display:none; }
  .you-row { background:var(--panel); border:1px solid var(--panel-border); border-radius:14px; padding:14px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow); }
  .you-k { font-size:13px; color:var(--text-dim); } .you-v { font-size:15px; font-weight:600; }
  .reset { background:none; border:none; color:var(--danger); font-size:13px; margin-top:10px; cursor:pointer; }

  /* ---- You: the hub. Ported from the old web app's tabbed business area ---- */
  /* ---- Top bar + the missions panel it opens (the old app's rail) ---- */
  .topbar { position:sticky; top:0; z-index:15; background:var(--bg); display:flex; align-items:center; justify-content:space-between; padding:12px 16px 10px; border-bottom:1px solid var(--panel-border); }
  .brand { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--accent); }
  .brand-mark { width:20px; height:20px; border-radius:6px; background:var(--accent); color:var(--on-accent); display:flex; align-items:center; justify-content:center; font-size:11px; }
  .mbtn { position:relative; display:flex; align-items:center; gap:9px; border:1px solid var(--panel-border); background:var(--panel); color:var(--text); border-radius:999px; padding:7px 13px; font-size:13px; font-weight:600; font-family:inherit; cursor:pointer; transition:border-color .15s, background .15s; }
  .mbtn:hover { border-color:var(--accent); }
  .mbtn.hasnew { border-color:var(--accent); background:var(--accent-soft); }
  .mbtn-ring { position:relative; width:18px; height:18px; border-radius:50%; background:conic-gradient(var(--accent) var(--pct,0%), var(--panel-border) 0); display:flex; align-items:center; justify-content:center; }
  .mbtn-ring:after { content:''; width:11px; height:11px; border-radius:50%; background:var(--panel); }
  .mbtn.hasnew .mbtn-ring:after { background:var(--bg); }
  .mdot { position:absolute; top:-2px; right:-2px; width:9px; height:9px; background:var(--danger); border-radius:50%; border:2px solid var(--bg); display:none; }
  .mbtn.hasnew .mdot { display:block; }

  /* The journey sheet — slides up over whatever you were doing. */
  .mscrim { position:fixed; inset:0; background:rgba(30,18,22,.42); z-index:55; opacity:0; pointer-events:none; transition:opacity .25s; }
  .mscrim.on { opacity:1; pointer-events:auto; }
  .mpanel { position:fixed; left:0; right:0; bottom:0; margin:0 auto; max-width:430px; height:90vh; background:var(--bg); border-radius:22px 22px 0 0; z-index:60; overflow-y:auto; transform:translateY(101%); transition:transform .3s cubic-bezier(.32,.72,0,1); padding:0 16px 32px; box-shadow:0 -10px 44px rgba(60,30,40,.22); }
  .mpanel.on { transform:translateY(0); }
  .mgrab { width:38px; height:4px; border-radius:999px; background:var(--panel-border); margin:9px auto 2px; }
  .mhead { position:sticky; top:0; background:var(--bg); display:flex; align-items:flex-start; justify-content:space-between; padding:6px 0 12px; z-index:2; }
  .mhead h2 { font-size:21px; margin:0; }
  .mhead .msub { font-size:13px; color:var(--text-dim); margin-top:2px; }
  .mclose { background:none; border:none; color:var(--text-dim); font-size:24px; cursor:pointer; line-height:1; padding:0 2px; }
  .mclose:hover { color:var(--accent); }

  /* Level progression as segments, not a single bar. */
  .lvhead { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px; }
  .lvname { font-size:17px; font-weight:600; }
  .lvcount { font-size:12px; color:var(--text-dim); font-variant:tabular-nums; }
  .lvbar { display:flex; gap:5px; margin-bottom:20px; }
  .lvseg { flex:1; height:6px; border-radius:999px; background:var(--panel-border); transition:background .3s; }
  .lvseg.done { background:var(--customer); }
  .lvseg.cur { background:var(--accent); }

  /* "Next up" — the one thing to do, front and centre. */
  .nextcard { border:1.5px solid var(--accent); background:var(--accent-soft); border-radius:16px; padding:15px 16px; margin-bottom:22px; }
  .next-k { font-size:11px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--accent); }
  .next-t { font-size:17px; font-weight:600; margin-top:5px; line-height:1.3; }
  .next-d { font-size:13px; color:var(--text-dim); margin-top:4px; line-height:1.45; }
  .next-act { margin-top:12px; }
  .next-done { text-align:center; padding:6px 0 2px; }

  .lvsec { border-top:1px solid var(--panel-border); }
  .lvsec-h { display:flex; align-items:center; gap:10px; padding:14px 2px; cursor:pointer; }
  .lvsec-h .lv-num { flex:0 0 24px; }
  .lvsec-t { flex:1; }
  .lvsec-n { font-size:15px; font-weight:600; }
  .lvsec-s { font-size:12px; color:var(--text-dim); margin-top:1px; }
  .lvsec-c { font-size:12px; color:var(--text-dim); font-variant:tabular-nums; }
  .lvsec-x { color:var(--text-dim); font-size:11px; transition:transform .18s; }
  .lvsec.open .lvsec-x { transform:rotate(180deg); }
  .lvsec .ms-list { display:none; padding-bottom:8px; }
  .lvsec.open .ms-list { display:block; }
  .lvsec.locked .lvsec-n, .lvsec.locked .lvsec-s { opacity:.5; }

  .subtabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; margin-bottom:14px; }
  .subtab { display:flex; align-items:center; gap:6px; border:1px solid var(--panel-border); background:var(--panel); color:var(--text-dim); border-radius:999px; padding:7px 13px; font-size:13px; font-family:inherit; cursor:pointer; white-space:nowrap; }
  .subtab:hover { border-color:var(--accent); }
  .subtab.on { background:var(--accent-soft); border-color:var(--accent); color:var(--text); font-weight:600; }
  .pane { display:none; } .pane.on { display:block; }
  .statgrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-bottom:14px; }
  .statcard { background:var(--panel); border:1px solid var(--panel-border); border-radius:14px; padding:13px 15px; box-shadow:var(--shadow); }
  .stat-v { font-size:22px; font-weight:800; letter-spacing:-0.02em; }
  .stat-k { font-size:12px; color:var(--text-dim); margin-top:2px; }
  .hcard { background:var(--panel); border:1px solid var(--panel-border); border-radius:14px; padding:14px 16px; margin-bottom:12px; box-shadow:var(--shadow); }
  .hcard-h { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .hcard-t { font-size:15px; font-weight:600; }
  .hcard-a { background:none; border:none; color:var(--accent); font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; padding:0; }
  .lrow { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--panel-border); font-size:13px; }
  .lrow:last-child { border-bottom:none; }
  .lrow-main { flex:1; min-width:0; }
  .lrow-sub { color:var(--text-dim); font-size:12px; margin-top:2px; }
  .sdot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:7px; vertical-align:1px; }
  .s-PROSPECT { background:var(--prospect); } .s-ENGAGED { background:var(--engaged); } .s-CUSTOMER { background:var(--customer); }
  .strength { color:var(--customer); font-weight:700; font-variant:tabular-nums; }
  .fld { display:flex; flex-direction:column; gap:4px; margin-bottom:12px; }
  .fld label { font-size:13px; font-weight:500; color:var(--text-dim); }
  .fld input, .fld textarea, .fld select { background:var(--input-bg); color:var(--text); border:1px solid var(--panel-border); border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; width:100%; transition:border-color .15s; }
  .fld input:focus, .fld textarea:focus, .fld select:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
  .fld textarea { min-height:74px; resize:vertical; }
  .fld-row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 10px; }
  .chiprow { display:flex; flex-wrap:wrap; gap:7px; margin-top:4px; }
  .schip { background:var(--input-bg); border:1px solid var(--panel-border); color:var(--text-dim); border-radius:999px; padding:6px 13px; font-size:13px; font-family:inherit; cursor:pointer; }
  .schip.on { border-color:var(--accent); background:var(--accent-soft); color:var(--text); font-weight:600; }
  .btn-sm { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--accent); background:transparent; color:var(--accent); font-size:13px; font-weight:600; padding:8px 14px; border-radius:999px; font-family:inherit; cursor:pointer; }
  .hcard-a { display:inline-flex; align-items:center; gap:5px; }
  .btn-sm:hover { background:var(--accent-soft); }
  .btn-fill { background:var(--accent); color:var(--on-accent); border:none; font-size:14px; font-weight:600; padding:12px; border-radius:999px; width:100%; font-family:inherit; cursor:pointer; }
  .addbox { background:var(--input-bg); border-radius:12px; padding:12px 14px; margin-bottom:12px; display:none; }
  .addbox.on { display:block; }
  .note { font-size:13px; color:var(--text-dim); line-height:1.5; }
  .money { font-variant:tabular-nums; }
  .saved { color:var(--customer); font-size:12px; font-weight:600; margin-left:8px; opacity:0; transition:opacity .2s; }
  .saved.on { opacity:1; }
  .tabbar { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:430px; background:var(--panel); border-top:1px solid var(--panel-border); display:flex; height:64px; z-index:20; }
  .tab { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; cursor:pointer; color:var(--text-dim); font-size:11px; }
  .tab.on { color:var(--accent); }
  /* One stroke weight, one corner treatment — the icon set reads as a set. */
  svg.ic { width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; display:block; }
  svg.ic-sm { width:16px; height:16px; stroke-width:1.9; }
  svg.ic-xs { width:13px; height:13px; stroke-width:2; }
  .tab.on svg.ic { stroke-width:2; }
  .inline-ic { display:inline-flex; align-items:center; gap:7px; }

  /* Streak — a quiet reason to come back tomorrow. */
  .streak { display:flex; align-items:center; gap:5px; font-size:13px; font-weight:700; color:var(--engaged); font-variant-numeric:tabular-nums; }
  .streak svg { stroke:var(--engaged); }
  .streak.cold { color:var(--text-dim); } .streak.cold svg { stroke:var(--text-dim); }

  /* Save to shelf. */
  .savebtn { position:absolute; top:12px; right:12px; width:34px; height:34px; border-radius:50%; border:none; background:rgba(255,255,255,.86); color:#7a5560; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:transform .14s, background .14s; }
  .savebtn:hover { transform:scale(1.08); }
  .savebtn:active { transform:scale(.92); }
  .card.saved .savebtn { background:var(--accent); color:#fff; }
  .card.saved .savebtn svg { fill:currentColor; }
  .savebtn svg { width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; }

  /* Press feedback — small, but it's what makes a UI feel built. */
  .card .head:active { transform:scale(.994); }
  .card .head { transition:transform .12s; }
  .schip:active, .chipbtn:active, .subtab:active { transform:scale(.96); }
  .schip, .chipbtn, .subtab { transition:transform .1s, border-color .15s, background .15s, color .15s; }

  /* Level-up moment. */
  .burst { position:fixed; left:50%; top:38%; transform:translate(-50%,-50%); z-index:70; pointer-events:none; }
  .burst i { position:absolute; width:8px; height:8px; border-radius:2px; opacity:0; }
  @keyframes fly { 0%{opacity:1; transform:translate(0,0) rotate(0deg);} 100%{opacity:0; transform:translate(var(--dx),var(--dy)) rotate(var(--rot));} }
  .levelup { position:fixed; left:50%; top:34%; transform:translate(-50%,-50%) scale(.9); z-index:71; background:var(--panel); border:1.5px solid var(--accent); border-radius:20px; padding:22px 26px; text-align:center; box-shadow:0 18px 50px rgba(60,30,40,.28); opacity:0; pointer-events:none; transition:opacity .25s, transform .25s; }
  .levelup.on { opacity:1; transform:translate(-50%,-50%) scale(1); }
  .levelup-k { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--accent); }
  .levelup-t { font-family:var(--font-display); font-size:26px; font-weight:600; margin-top:6px; letter-spacing:-0.02em; }
  .levelup-s { font-size:13px; color:var(--text-dim); margin-top:4px; }
  .tab .dot { position:absolute; margin-left:16px; margin-top:-14px; width:8px; height:8px; background:var(--danger); border-radius:50%; display:none; }
  .tab.hasnew .dot { display:block; }
  .toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:var(--scoreboard); color:#fdf7f4; font-size:13px; font-weight:600; padding:10px 16px; border-radius:999px; opacity:0; transition:opacity .25s; z-index:30; }
  .toast.show { opacity:1; }
  .empty { color:var(--text-dim); font-size:14px; text-align:center; padding:30px 0; display:none; }

  /* ---- Onboarding: one question per screen, generous space, quiet chrome ---- */
  .onb { position:fixed; inset:0; z-index:100; background:var(--bg); display:none; }
  .onb.on { display:block; }
  .onb-inner { max-width:430px; margin:0 auto; height:100%; display:flex; flex-direction:column; padding:20px 28px 28px; }
  .onb-top { display:flex; align-items:center; gap:14px; min-height:32px; }
  .onb-back { background:none; border:none; color:var(--text-dim); font-size:20px; cursor:pointer; padding:0; width:20px; text-align:left; visibility:hidden; }
  .onb-back.show { visibility:visible; }
  .onb-track { flex:1; height:3px; background:var(--panel-border); border-radius:999px; overflow:hidden; }
  .onb-prog { height:100%; width:0%; background:var(--accent); border-radius:999px; transition:width .35s ease; }
  .onb-main { flex:1; display:flex; flex-direction:column; justify-content:center; overflow-y:auto; padding:24px 0; }
  .onb-fade { animation:onb-in .32s ease both; }
  @keyframes onb-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  .onb-chapter { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--accent); margin-bottom:14px; }
  .onb-title { font-size:30px; font-weight:600; line-height:1.2; letter-spacing:-0.02em; margin:0; }
  .onb-sub { font-size:15px; color:var(--text-dim); line-height:1.55; margin:10px 0 0; }
  .onb-meta { font-size:13px; color:var(--text-dim); margin-top:20px; }
  .onb-body { margin-top:28px; }
  .onb-in { width:100%; border:1px solid var(--panel-border); background:var(--input-bg); color:var(--text); border-radius:14px; padding:15px 16px; font-size:18px; font-family:inherit; transition:border-color .15s, box-shadow .15s; }
  .onb-in:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
  textarea.onb-in { min-height:110px; resize:none; font-size:16px; line-height:1.5; }
  .onb-opts { display:flex; flex-direction:column; gap:10px; }
  .onb-opt { text-align:left; width:100%; background:var(--panel); border:1.5px solid var(--panel-border); border-radius:14px; padding:15px 16px; cursor:pointer; font-family:inherit; color:var(--text); transition:border-color .15s, background .15s, transform .1s; }
  .onb-opt:hover { border-color:var(--accent); }
  .onb-opt:active { transform:scale(.99); }
  .onb-opt.sel { border-color:var(--accent); background:var(--accent-soft); }
  .onb-opt-l { font-size:16px; font-weight:600; }
  .onb-opt-h { font-size:13px; color:var(--text-dim); margin-top:3px; line-height:1.45; }
  .onb-chips { display:flex; flex-wrap:wrap; gap:9px; }
  .onb-chip { background:var(--panel); border:1.5px solid var(--panel-border); color:var(--text); border-radius:999px; padding:10px 16px; font-size:14px; font-family:inherit; cursor:pointer; transition:border-color .15s, background .15s; }
  .onb-chip:hover { border-color:var(--accent); }
  .onb-chip.sel { border-color:var(--accent); background:var(--accent-soft); font-weight:600; }
  .onb-foot { padding-top:12px; }
  .onb-cta { width:100%; background:var(--accent); color:var(--on-accent); border:none; border-radius:999px; padding:16px; font-size:15px; font-weight:600; font-family:inherit; cursor:pointer; transition:opacity .15s, transform .1s; }
  .onb-cta:disabled { opacity:.4; cursor:default; }
  .onb-cta:not(:disabled):hover { transform:translateY(-1px); }
  .onb-skip { display:block; width:100%; background:none; border:none; color:var(--text-dim); font-size:14px; font-family:inherit; padding:14px 0 2px; cursor:pointer; }
  .onb-skip:hover { color:var(--accent); }
  .onb-skip.hide { display:none; }
  .onb-plist { display:flex; flex-direction:column; gap:8px; }
  .onb-prompt { text-align:left; background:var(--panel); border:1px solid var(--panel-border); border-radius:12px; padding:14px 16px; font-size:15px; font-family:inherit; color:var(--text); cursor:pointer; transition:border-color .15s, background .15s; }
  .onb-prompt:hover { border-color:var(--accent); background:var(--accent-soft); }
  .onb-plabel { font-size:16px; font-weight:600; color:var(--accent); margin-bottom:12px; line-height:1.35; }
  .onb-change { background:none; border:none; color:var(--text-dim); font-size:13px; padding:12px 0 0; cursor:pointer; font-family:inherit; }
  .onb-change:hover { color:var(--accent); }
  .onb-rev-img { width:100%; height:170px; border-radius:16px; background-size:cover; background-position:center; margin-bottom:18px; }
  .onb-rev-lead { font-size:14px; color:var(--text-dim); margin-bottom:6px; }
  .onb-rev-title { font-size:24px; font-weight:600; line-height:1.25; letter-spacing:-0.02em; margin:0; }
  .onb-rev-blurb { font-size:14px; color:var(--text-dim); line-height:1.55; margin-top:10px; }
  .onb-rev-nums { display:flex; gap:26px; margin:18px 0; padding:14px 16px; background:var(--input-bg); border-radius:14px; }
  .onb-rev-k { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--text-dim); }
  .onb-rev-v { font-size:17px; font-weight:700; margin-top:3px; }
  .onb-rev-v.sell { color:var(--customer); }
  .onb-rev-model { font-size:14px; line-height:1.55; border-left:2px solid var(--accent); padding-left:14px; }
  .onb-rev-closer { font-size:14px; color:var(--text-dim); margin-top:18px; line-height:1.5; }
  .onb-center { text-align:center; }
  .onb-mark { width:54px; height:54px; border-radius:16px; background:var(--accent); color:var(--on-accent); font-size:26px; display:flex; align-items:center; justify-content:center; margin-bottom:22px; }
  .onb-center .onb-mark { margin-left:auto; margin-right:auto; }
  .onb-note { font-size:13px; color:var(--text-dim); line-height:1.5; margin-top:16px; }
</style></head><body>
<svg style="display:none" aria-hidden="true"><defs>
  <symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z"/></symbol>
  <symbol id="i-sprout" viewBox="0 0 24 24"><path d="M12 21v-7"/><path d="M12 14c0-3.3-2.7-6-6-6H4c0 3.3 2.7 6 6 6z"/><path d="M12 12c0-3.3 2.7-6 6-6h2c0 3.3-2.7 6-6 6z"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-6"/><path d="M22 20H2"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 13l4.5 4.5L19 7"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="i-out" viewBox="0 0 24 24"><path d="M8 16L16 8"/><path d="M9 8h7v7"/></symbol>
  <symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 21c3.6 0 6-2.4 6-5.6 0-4.2-4.4-5.6-3.4-10.4C11.4 6 9 8.4 9 11c0-1.2-.6-2.2-1.4-2.8C6.6 9.6 6 11.6 6 13.8 6 18 8.4 21 12 21z"/></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z"/></symbol>
  <symbol id="i-trophy" viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 5H5v2a3 3 0 003 3"/><path d="M16 5h3v2a3 3 0 01-3 3"/><path d="M12 13v4M9 20h6"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 017 0v3"/></symbol>
  <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 7h11M19 7h1M4 17h4M12 17h8"/><circle cx="17" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></symbol>
  <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1"/><path d="M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24"><path d="M5 4h9a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17h12"/></symbol>
  <symbol id="i-note" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.4"/></symbol>
  <symbol id="i-shop" viewBox="0 0 24 24"><path d="M4 9h16l-1 11H5z"/><path d="M8.5 9V6.5a3.5 3.5 0 017 0V9"/></symbol>
  <symbol id="i-tag" viewBox="0 0 24 24"><path d="M4 11V5h6l9 9-6 6z"/><circle cx="7.8" cy="8.2" r="1.1"/></symbol>
  <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></symbol>
</defs></svg>

<div class="app">
  <div class="topbar">
    <div class="brand"><span class="brand-mark"><svg class="ic-xs"><use href="#i-spark"/></svg></span> Sales Mechanic</div>
    <div style="display:flex; align-items:center; gap:10px">
      <div class="streak" id="streak" title="Days in a row"><svg class="ic-sm"><use href="#i-flame"/></svg><span id="streak-n">1</span></div>
      <button class="mbtn" id="mbtn" onclick="openMissions()">
        <span class="mbtn-ring" id="mbtn-ring"></span>Journey<span class="mdot"></span>
      </button>
    </div>
  </div>

  <!-- DISCOVER -->
  <div class="screen active" id="s-discover">
    <div class="top"><h1>Discover</h1><div class="sub">Trending products &mdash; and where to source them.</div></div>
    <div class="filters">
      <button class="chipbtn on" data-f="all" onclick="setFilter(this)">All</button>
      <button class="chipbtn" data-f="maker" onclick="setFilter(this)">Maker</button>
      <button class="chipbtn" data-f="reseller" onclick="setFilter(this)">Reseller</button>
      <button class="chipbtn" data-f="both" onclick="setFilter(this)">Both</button>
      <button class="chipbtn" data-f="saved" onclick="setFilter(this)" id="chip-saved">Saved</button>
    </div>
    <div class="banner" id="disc-banner" style="margin-top:12px"></div>
    ${domains.map((d) => `<section class="dom" data-dom="${attr(d)}">
      <div class="dom-h">${esc(d)}</div>
      ${products.filter((p) => p.niche?.domain === d).map(productCard).join('')}
    </section>`).join('')}
  </div>
  <!-- GROW -->
  <div class="screen" id="s-grow">
    <div class="top"><h1>Grow</h1><div class="sub">Where your customers already gather.</div></div>
    <div class="banner" id="grow-banner"></div>
    ${communities.map(communityCard).join('')}
  </div>
  <!-- JOURNEY — not a tab; a sheet the top bar opens. -->
  <div class="mscrim" id="mscrim" onclick="closeMissions()"></div>
  <div class="mpanel" id="s-journey">
    <div class="mgrab"></div>
    <div class="mhead">
      <div><h2>Your journey</h2><div class="msub" id="pc-xp">Idea to first sale, one step at a time.</div></div>
      <button class="mclose" onclick="closeMissions()" aria-label="Close"><svg class="ic-sm"><use href="#i-x"/></svg></button>
    </div>
    <div class="lvhead">
      <span class="lvname" id="pc-name">Explorer</span>
      <span class="lvcount" id="pc-level">Level 1</span>
    </div>
    <div class="lvbar" id="lvbar"></div>
    <div class="nextcard" id="nextcard"></div>
    ${levelsHtml}
  </div>
  <!-- BUSINESS — how the business is actually doing -->
  <div class="screen" id="s-shop">
    <div class="top"><h1 id="you-greet">Business</h1><div class="sub" id="you-sub">Your business at a glance.</div></div>
    <div class="subtabs">
      <button class="subtab on" data-pane="overview" onclick="setPane(this)"><svg class="ic-sm"><use href="#i-chart"/></svg>Overview</button>
      <button class="subtab" data-pane="clients" onclick="setPane(this)"><svg class="ic-sm"><use href="#i-book"/></svg>Clients</button>
      <button class="subtab" data-pane="money" onclick="setPane(this)"><svg class="ic-sm"><use href="#i-note"/></svg>Money</button>
    </div>

    <div class="pane on" id="p-overview">
      <div class="statgrid">
        <div class="statcard"><div class="stat-v" id="ov-people">0</div><div class="stat-k">people in your book</div></div>
        <div class="statcard"><div class="stat-v money" id="ov-revenue">$0</div><div class="stat-k">all-time revenue</div></div>
        <div class="statcard"><div class="stat-v" id="ov-listings">0</div><div class="stat-k">listings on the shelf</div></div>
        <div class="statcard"><div class="stat-v" id="ov-level">1</div><div class="stat-k" id="ov-levelname">Explorer</div></div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t inline-ic"><svg class="ic-sm"><use href="#i-flame"/></svg>Who needs you</div><button class="hcard-a" onclick="goPane('clients')">Open &rarr;</button></div>
        <div id="ov-attention"></div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t inline-ic"><svg class="ic-sm"><use href="#i-spark"/></svg>Recent moves</div></div>
        <div id="ov-activity"></div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t inline-ic"><svg class="ic-sm"><use href="#i-trophy"/></svg>Strongest relationships</div></div>
        <div id="ov-top"></div>
      </div>
    </div>

    <div class="pane" id="p-clients">
      <button class="btn-sm" onclick="toggleBox('add-contact')"><svg class="ic-sm"><use href="#i-plus"/></svg>New client</button>
      <div class="addbox" id="add-contact" style="margin-top:12px">
        <div class="fld"><label>Name</label><input id="nc-name" placeholder="Who are they?"></div>
        <div class="fld"><label>Where did you find them?</label><input id="nc-channel" placeholder="e.g. r/Pottery, Instagram, a market"></div>
        <div class="fld"><label>Notes <span style="opacity:.6">(optional)</span></label><textarea id="nc-notes" placeholder="What do you know about them?"></textarea></div>
        <div class="fld"><label>Where are they at?</label>
          <div class="chiprow" id="nc-status">
            <button class="schip on" data-v="PROSPECT" onclick="pickStatus(this)">&#127793; New lead</button>
            <button class="schip" data-v="ENGAGED" onclick="pickStatus(this)">&#128172; In conversation</button>
            <button class="schip" data-v="CUSTOMER" onclick="pickStatus(this)">&#11088; Customer</button>
          </div>
        </div>
        <button class="btn-fill" onclick="addContact()">Add to my book</button>
      </div>
      <div id="clients-list"></div>
    </div>

    <div class="pane" id="p-money">
      <div class="statgrid">
        <div class="statcard"><div class="stat-v money" id="mn-total">$0</div><div class="stat-k">all time</div></div>
        <div class="statcard"><div class="stat-v money" id="mn-avg">$0</div><div class="stat-k">average sale</div></div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t inline-ic"><svg class="ic-sm"><use href="#i-note"/></svg>Record a sale</div></div>
        <div class="fld-row">
          <div class="fld"><label>Amount</label><input id="ns-amount" inputmode="decimal" placeholder="0.00"></div>
          <div class="fld"><label>Who bought?</label><input id="ns-who" placeholder="Name (optional)"></div>
        </div>
        <div class="fld"><label>What was it? <span style="opacity:.6">(optional)</span></label><input id="ns-note" placeholder="e.g. two mugs"></div>
        <button class="btn-fill" onclick="addSale()">Log the sale</button>
        <div id="sales-list" style="margin-top:14px"></div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t inline-ic"><svg class="ic-sm"><use href="#i-tag"/></svg>The shelf</div><button class="hcard-a" onclick="toggleBox('add-product')">+ Add</button></div>
        <div class="addbox" id="add-product">
          <div class="fld"><label>Product name</label><input id="np-name" placeholder="What are you selling?"></div>
          <div class="fld-row">
            <div class="fld"><label>Price</label><input id="np-price" inputmode="decimal" placeholder="0.00"></div>
            <div class="fld"><label>Stock <span style="opacity:.6">(optional)</span></label><input id="np-stock" inputmode="numeric" placeholder="—"></div>
          </div>
          <button class="btn-fill" onclick="addProduct()">Add to the shelf</button>
        </div>
        <div id="products-list"></div>
      </div>
    </div>
  </div>

  <!-- YOU — who you are and how the app is set up -->
  <div class="screen" id="s-you">
    <div class="top"><h1>You</h1><div class="sub">Your profile, your links, your settings.</div></div>
    <div class="subtabs">
      <button class="subtab on" data-pane="profile" onclick="setPane(this)"><svg class="ic-sm"><use href="#i-shop"/></svg>Profile</button>
      <button class="subtab" data-pane="socials" onclick="setPane(this)"><svg class="ic-sm"><use href="#i-link"/></svg>Socials</button>
      <button class="subtab" data-pane="settings" onclick="setPane(this)"><svg class="ic-sm"><use href="#i-sliders"/></svg>Settings</button>
    </div>

    <div class="pane on" id="p-profile">
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t">Your business<span class="saved" id="sv-biz">Saved &#10003;</span></div></div>
        <div class="fld"><label>Business name</label><input id="bp-name" oninput="saveBiz()"></div>
        <div class="fld"><label>Product / niche</label><input id="bp-niche" oninput="saveBiz()"></div>
        <div class="fld"><label>Describe it in a sentence</label><textarea id="bp-desc" oninput="saveBiz()" placeholder="What you make or do, and who it's for."></textarea></div>
        <div class="fld"><label>Where should people land? (shop, site, linktree)</label><input id="bp-url" oninput="saveBiz()" placeholder="etsy.com/shop/yourshop"></div>
        <div class="fld"><label>What kind of business?</label>
          <div class="chiprow" id="bp-type">
            <button class="schip" data-v="PRODUCT_SALES" onclick="pickBizType(this)">I sell products</button>
            <button class="schip" data-v="SERVICE" onclick="pickBizType(this)">I offer services</button>
            <button class="schip" data-v="KNOWLEDGE" onclick="pickBizType(this)">I teach or coach</button>
            <button class="schip" data-v="OTHER" onclick="pickBizType(this)">Something else</button>
          </div>
        </div>
        <div class="fld"><label>Where can people buy from you?</label>
          <div class="chiprow" id="bp-avenues"></div>
        </div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t">About you<span class="saved" id="sv-me">Saved &#10003;</span></div></div>
        <div class="fld"><label>Your name</label><input id="me-name" oninput="saveMe()"></div>
        <div class="fld-row">
          <div class="fld"><label>Email</label><input id="me-email" oninput="saveMe()" placeholder="you@example.com"></div>
          <div class="fld"><label>Location</label><input id="me-loc" oninput="saveMe()" placeholder="e.g. Austin, TX"></div>
        </div>
        <div class="fld"><label>Bio</label><textarea id="me-bio" oninput="saveMe()" placeholder="A sentence about you — people buy from people."></textarea></div>
        <div class="fld"><label>What do you want from this business?</label><textarea id="me-goals" oninput="saveMe()" placeholder="e.g. Replace my day-job income within two years"></textarea></div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t">All your ventures</div></div>
        <div id="ventures-list"></div>
        <div class="note" style="margin-top:8px">Each venture keeps its own clients, sales and Growth communities.</div>
      </div>
    </div>

    <div class="pane" id="p-socials">
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t">Where your business lives<span class="saved" id="sv-soc">Saved &#10003;</span></div></div>
        <div class="note" style="margin-bottom:12px">Growth uses these to meet customers where you already are.</div>
        <div id="socials-fields"></div>
        <div class="note" id="soc-count"></div>
      </div>
    </div>

    <div class="pane" id="p-settings">
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t">Appearance</div></div>
        <div class="note">This preview follows your system light/dark setting — the artisan palette in daylight, the charcoal-and-gold one at night.</div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t">Relationship reminders</div></div>
        <div class="note" style="margin-bottom:10px">How long someone can go quiet before they show up in "Who needs you".</div>
        <div style="display:flex; align-items:center; gap:12px;">
          <input type="range" min="1" max="30" id="set-cooling" oninput="saveCooling()" style="flex:1">
          <span style="font-size:14px; white-space:nowrap"><strong id="set-cooling-v">7</strong> days</span>
        </div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t">Your AI<span class="saved" id="sv-ai">Saved &#10003;</span></div></div>
        <div class="note" style="margin-bottom:12px">Point the app at a model you run yourself (Ollama, LM Studio — anything OpenAI-compatible) for recommendations tailored to your exact business.</div>
        <div class="fld"><label>Server URL</label><input id="ai-url" oninput="saveAi()" placeholder="http://localhost:11434/v1"></div>
        <div class="fld"><label>Model name</label><input id="ai-model" oninput="saveAi()" placeholder="qwen2.5:7b"></div>
        <div class="note" id="ai-state"></div>
      </div>
      <div class="hcard">
        <div class="hcard-h"><div class="hcard-t">Start over</div></div>
        <div class="note">Clears your profile, clients, sales and Journey progress on this device.</div>
        <button class="reset" onclick="resetAll()">Reset everything</button>
      </div>
    </div>
  </div>

  <div class="onb" id="onb">
    <div class="onb-inner">
      <div class="onb-top" id="onb-top">
        <button class="onb-back" id="onb-back" onclick="onbBack()">&#8592;</button>
        <div class="onb-track"><div class="onb-prog" id="onb-prog"></div></div>
      </div>
      <div class="onb-main" id="onb-main"></div>
      <div class="onb-foot" id="onb-foot"></div>
    </div>
  </div>

  <div class="tabbar">
    <div class="tab on" data-tab="discover" onclick="setTab('discover')"><svg class="ic"><use href="#i-compass"/></svg>Discover</div>
    <div class="tab" data-tab="grow" onclick="setTab('grow')"><svg class="ic"><use href="#i-sprout"/></svg>Grow</div>
    <div class="tab" data-tab="shop" onclick="setTab('shop')"><svg class="ic"><use href="#i-chart"/></svg>Business</div>
    <div class="tab" data-tab="you" onclick="setTab('you')"><svg class="ic"><use href="#i-user"/></svg>You</div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
  var LEVELS = ${JSON.stringify(missions.levels)};
  var FINAL = ${JSON.stringify(missions.finalName)};
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function attr(s){ return esc(s).replace(/"/g,'&quot;'); }
  var TITLES = {}; document.querySelectorAll('.ms').forEach(function(el){ TITLES[el.dataset.id] = el.querySelector('.ms-title').textContent; });
  var S = load();

  function load(){
    try { return JSON.parse(localStorage.getItem('sm_app')) || {}; } catch(e){ return {}; }
    }
  function save(){ localStorage.setItem('sm_app', JSON.stringify(S)); }
  function done(){ S.done = S.done || []; return S.done; }
  function isDone(id){ return done().indexOf(id) !== -1; }

  function levelDone(lv){
    var ms = Array.prototype.slice.call(document.querySelectorAll('.ms[data-level="'+lv+'"]'));
    return ms.length > 0 && ms.every(function(el){ return isDone(el.dataset.id); });
  }
  function levelUnlocked(lv){ return lv === 1 || levelDone(lv-1); }

  function complete(id, silent){
    if(!id || isDone(id)) return;
    var el = document.querySelector('.ms[data-id="'+id+'"]');
    if(!el) return;
    var lv = parseInt(el.dataset.level,10);
    if(!levelUnlocked(lv)) return;
    var wasDone = levelDone(lv);
    done().push(id); save();
    // Finishing a level is the moment worth marking.
    if(!wasDone && levelDone(lv) && !silent){
      var meta = LEVELS.filter(function(l){ return l.level===lv; })[0];
      if(meta) celebrate(meta.name, meta.title);
    } else if(!silent){
      toast('\\u2713 ' + (TITLES[id]||'Milestone complete'));
    }
    refresh();
  }
  function fire(trigger){
    var el = document.querySelector('.ms[data-trigger="'+trigger+'"]');
    if(el) complete(el.dataset.id);
  }

  // Journey is no longer a tab — it's a sheet the top bar opens.
  function openMissions(){
    document.getElementById('s-journey').classList.add('on');
    document.getElementById('mscrim').classList.add('on');
    refresh();
    // Open straight onto wherever they actually are.
    var cur = LEVELS.filter(function(lv){ return !levelDone(lv.level) && levelUnlocked(lv.level); })[0];
    document.querySelectorAll('.lvsec').forEach(function(s){
      s.classList.toggle('open', !!cur && Number(s.dataset.level) === cur.level);
    });
  }
  function closeMissions(){
    document.getElementById('s-journey').classList.remove('on');
    document.getElementById('mscrim').classList.remove('on');
  }
  function toggleLevel(lv){
    var sec = document.querySelector('.lvsec[data-level="'+lv+'"]');
    if(sec) sec.classList.toggle('open');
  }

  // The single next thing to do, lifted out of the list so it's unmissable.
  function renderNext(){
    var card = document.getElementById('nextcard');
    if(!card) return;
    var el = document.querySelector('.level.unlocked .ms:not(.done)');
    if(!el){
      card.innerHTML = '<div class="next-done"><div class="next-k">All done</div>' +
        '<div class="next-t">You\\'ve walked the whole journey.</div>' +
        '<div class="next-d">Keep selling — the app tracks it all from here.</div></div>';
      return;
    }
    var title = el.querySelector('.ms-title').textContent;
    var detail = el.querySelector('.ms-detail').textContent;
    var outside = el.querySelector('.ms-where').classList.contains('out');
    var goBtn = el.querySelector('.mini-btn[data-tab]');
    card.innerHTML = '<div class="next-k">Next up</div>' +
      '<div class="next-t">' + esc(title) + '</div>' +
      '<div class="next-d">' + esc(detail) + '</div>' +
      '<div class="next-act"><button class="btn-fill" onclick="doNext()">' +
      (goBtn ? 'Go do it \\u2197' : (outside ? 'Show me where' : 'Take me to it')) +
      '</button></div>';
  }
  function doNext(){
    var el = document.querySelector('.level.unlocked .ms:not(.done)');
    if(!el) return;
    var goBtn = el.querySelector('.mini-btn[data-tab]');
    if(goBtn){ goBtn.click(); return; }
    // No destination — open its level and put it in front of them instead.
    var sec = document.querySelector('.lvsec[data-level="'+el.dataset.level+'"]');
    if(sec) sec.classList.add('open');
    el.scrollIntoView({ behavior:'smooth', block:'center' });
    el.style.transition = 'background .3s';
    el.style.background = 'var(--accent-soft)';
    setTimeout(function(){ el.style.background = ''; }, 1300);
  }

  function setTab(name){
    if(name === 'journey'){ openMissions(); return; }
    closeMissions();
    document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
    document.getElementById('s-'+name).classList.add('active');
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('on', t.dataset.tab===name); });
    S.tab = name; save();
    window.scrollTo(0,0);
    if(name==='discover') fire('open-discover');
    if(name==='grow') fire('open-grow');
  }
  function goTab(btn){ setTab(btn.dataset.tab); }

  function toggleCard(head, trigger){
    var card = head.parentElement;
    card.classList.toggle('open');
    if(card.classList.contains('open')) fire(trigger);
  }

  function setFilter(btn){
    document.querySelectorAll('#s-discover .chipbtn').forEach(function(b){ b.classList.toggle('on', b===btn); });
    var f = btn.dataset.f;
    document.querySelectorAll('#s-discover .product').forEach(function(c){
      var show = f==='all' ? true
        : f==='saved' ? c.classList.contains('saved')
        : c.getAttribute('data-aud')===f;
      c.style.display = show ? '' : 'none';
    });
  }

  /* ---- Save to shelf ---- */
  function toggleSave(slug, btn){
    S.saved = S.saved || [];
    var card = btn.closest('.card');
    var at = S.saved.indexOf(slug);
    if(at === -1){ S.saved.push(slug); card.classList.add('saved'); toast('Saved to your shelf'); }
    else { S.saved.splice(at,1); card.classList.remove('saved'); }
    save(); renderSavedChip();
  }
  function renderSavedChip(){
    var n = (S.saved||[]).length;
    var chip = document.getElementById('chip-saved');
    if(chip) chip.textContent = n ? ('Saved \\u00b7 ' + n) : 'Saved';
  }
  function applySaved(){
    (S.saved||[]).forEach(function(slug){
      var c = document.querySelector('#s-discover .product[data-slug="'+slug+'"]');
      if(c) c.classList.add('saved');
    });
    renderSavedChip();
  }

  /* ---- Streak: days in a row, counted honestly ---- */
  function today(){ return new Date().toISOString().slice(0,10); }
  function tickStreak(){
    S.streak = S.streak || { n:0, last:null };
    var t = today();
    if(S.streak.last !== t){
      var y = new Date(Date.now()-86400000).toISOString().slice(0,10);
      S.streak.n = (S.streak.last === y) ? S.streak.n + 1 : 1;
      S.streak.last = t;
      save();
    }
    var el = document.getElementById('streak-n');
    if(el) el.textContent = S.streak.n;
    document.getElementById('streak').classList.toggle('cold', S.streak.n < 2);
  }

  /* ---- Level-up moment ---- */
  var COLORS = ['#c2647e','#5f9b7a','#cf8f2e','#a8536c','#4a7c61'];
  function burst(){
    var wrap = document.createElement('div'); wrap.className = 'burst';
    for(var i=0;i<26;i++){
      var b = document.createElement('i');
      var a = Math.random()*Math.PI*2, d = 90 + Math.random()*150;
      b.style.background = COLORS[i % COLORS.length];
      b.style.setProperty('--dx', Math.cos(a)*d + 'px');
      b.style.setProperty('--dy', Math.sin(a)*d + 'px');
      b.style.setProperty('--rot', (Math.random()*540-270) + 'deg');
      b.style.animation = 'fly ' + (700 + Math.random()*500) + 'ms cubic-bezier(.2,.7,.3,1) forwards';
      wrap.appendChild(b);
    }
    document.body.appendChild(wrap);
    setTimeout(function(){ wrap.remove(); }, 1400);
  }
  function celebrate(levelName, title){
    burst();
    var el = document.createElement('div');
    el.className = 'levelup';
    el.innerHTML = '<div class="levelup-k">Level up</div><div class="levelup-t">' + esc(levelName) + '</div>' +
      '<div class="levelup-s">' + esc(title) + '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('on'); });
    setTimeout(function(){ el.classList.remove('on'); setTimeout(function(){ el.remove(); }, 300); }, 2100);
  }

  /* ---- Numbers that count up rather than snap ---- */
  function countTo(el, target, prefix){
    if(!el) return;
    var from = Number(String(el.dataset.v || 0));
    el.dataset.v = target;
    // rAF never fires on a hidden tab, so animating there would leave the
    // number frozen at its old value. Snap instead — and honour anyone who
    // has asked for less motion.
    var snap = from === target || document.hidden ||
      (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(snap){ el.textContent = (prefix||'') + fmtNum(target, prefix); return; }
    var t0 = performance.now(), dur = 550;
    function step(t){
      var k = Math.min(1, (t-t0)/dur), e = 1 - Math.pow(1-k, 3);
      el.textContent = (prefix||'') + fmtNum(from + (target-from)*e, prefix);
      if(k < 1) requestAnimationFrame(step);
      else el.textContent = (prefix||'') + fmtNum(target, prefix);
    }
    requestAnimationFrame(step);
  }
  function fmtNum(v, prefix){
    return prefix ? Math.round(v).toLocaleString('en-US') : String(Math.round(v));
  }

  function chooseNiche(btn){
    var slug = btn.dataset.slug;
    if(S.niche && S.niche.slug && S.niche.slug !== slug){
      fire('pick-second-niche');
    }
    S.niche = { slug: slug, name: btn.dataset.name, tags: btn.dataset.tags }; save();
    fire('pick-niche');
    matchGrow();
    toast('Niche set: ' + btn.dataset.name);
    refresh();
  }
  function focusCommunity(btn){
    S.comm = { slug: btn.dataset.slug, title: btn.dataset.title }; save();
    fire('pick-community');
    toast('Focused: ' + btn.dataset.title);
    refresh();
  }
  function saveName(btn){
    var v = btn.parentElement.querySelector('.name-in').value.trim();
    if(!v){ return; }
    S.biz = v; save();
    complete('name-business');
  }
  function startBiz(){ if(!S.biz){ toast('Name your business first'); return; } complete('start-business'); }
  // The Journey milestone hands off to the real place sales get recorded.
  function logSale(){ goPane('money'); toast('Record it here'); }
  function markDone(btn){ complete(btn.closest('.ms').dataset.id); }

  var STOP = ['and','the','for','with','your','from','that','this','are','you','our','its','all','who','what','how','made','only',
              'like','want','anything','can','make','sell','some','into','love','really','just','stuff','things','maybe'];
  // Split on commas AND whitespace: curated content carries comma-separated
  // tags, but anything typed during onboarding is a free-text phrase
  // ("handmade stoneware mugs and bowls") that has to be tokenized too.
  function tokens(text){
    return String(text || '').toLowerCase().split(/[^a-z0-9]+/)
      .filter(function(t){ return t.length >= 3 && STOP.indexOf(t) === -1; });
  }

  function matchDiscover(){
    var banner = document.getElementById('disc-banner');
    var want = tokens(S.interests);
    if(!want.length){ banner.classList.remove('on'); return; }
    var count = 0;
    document.querySelectorAll('#s-discover .product').forEach(function(c){
      var have = (c.getAttribute('data-text') || '');
      var hit = want.some(function(t){ return have.indexOf(t) !== -1; });
      c.classList.toggle('match', hit);
      if(hit) count++;
    });
    banner.textContent = count
      ? 'Highlighted ' + count + ' products from what you said you\\'re into'
      : 'Nothing matched exactly — browse everything, something will click';
    banner.classList.add('on');
  }

  // With a large library almost everything overlaps on a token or two, so a
  // plain hit/miss flag ends up badging most of the feed and means nothing.
  // Score by how many tokens match, float the strongest to the top, and only
  // badge a genuine shortlist.
  var GROW_TOP = 8;
  function matchGrow(){
    var banner = document.getElementById('grow-banner');
    var screen = document.getElementById('s-grow');
    var cards = [].slice.call(screen.querySelectorAll('.community'));
    if(!S.niche){
      banner.classList.remove('on');
      cards.forEach(function(c){ c.classList.remove('match'); });
      return;
    }
    var want = tokens(S.niche.tags);
    var scored = cards.map(function(c){
      var have = (c.getAttribute('data-tags')||'').toLowerCase();
      var score = 0;
      want.forEach(function(t){ if(t && have.indexOf(t) !== -1) score++; });
      return { el: c, score: score };
    });
    scored.sort(function(a,b){ return b.score - a.score; });
    var top = scored.filter(function(s){ return s.score > 0; }).slice(0, GROW_TOP);
    var inTop = new Set(top.map(function(s){ return s.el; }));
    scored.forEach(function(s){
      s.el.classList.toggle('match', inTop.has(s.el));
      screen.appendChild(s.el);
    });
    banner.textContent = top.length
      ? 'Your best ' + top.length + ' communities for ' + S.niche.name + ' — sorted by fit'
      : 'No close match yet for ' + S.niche.name + ' — the general ones still apply';
    banner.classList.add('on');
  }

  function refresh(){
    // milestone + level states
    LEVELS.forEach(function(lv){
      var sec = document.querySelector('.level[data-level="'+lv.level+'"]');
      var unlocked = levelUnlocked(lv.level), ldone = levelDone(lv.level);
      sec.classList.toggle('unlocked', unlocked && !ldone);
      sec.classList.toggle('done', ldone);
      sec.classList.toggle('locked', !unlocked);
    });
    document.querySelectorAll('.ms').forEach(function(el){ el.classList.toggle('done', isDone(el.dataset.id)); });
    // progress
    var total = document.querySelectorAll('.ms').length;
    var d = done().length;
    var cur = LEVELS.find(function(lv){ return !levelDone(lv.level); });
    var name = cur ? cur.name : FINAL;
    var num = cur ? cur.level : LEVELS.length;
    document.getElementById('pc-level').textContent = cur ? ('Level ' + num + ' of ' + LEVELS.length) : 'Complete';
    document.getElementById('pc-name').textContent = name;
    document.getElementById('pc-xp').textContent = d === total
      ? 'Every step done — the rest is just doing it again, bigger.'
      : d + ' of ' + total + ' steps done';

    // One segment per level: filled when finished, accented when current.
    document.getElementById('lvbar').innerHTML = LEVELS.map(function(lv){
      var done = levelDone(lv.level);
      return '<div class="lvseg' + (done ? ' done' : (lv.level === num && cur ? ' cur' : '')) + '"></div>';
    }).join('');

    // Per-level counts on the collapsed rows.
    LEVELS.forEach(function(lv){
      var all = document.querySelectorAll('.ms[data-level="'+lv.level+'"]');
      var got = 0;
      all.forEach(function(el){ if(isDone(el.dataset.id)) got++; });
      var c = document.getElementById('lvc-'+lv.level);
      if(c) c.textContent = levelDone(lv.level) ? '\\u2713' : got + '/' + all.length;
    });

    // The ring in the top-bar button doubles as a progress readout.
    var ring = document.getElementById('mbtn-ring');
    if(ring) ring.style.setProperty('--pct', Math.round(d/total*100) + '%');

    renderNext();
    renderYou(num, name);
    // Badge the top-bar icon whenever there's an unlocked step waiting.
    var hasNew = !!document.querySelector('.level.unlocked .ms:not(.done)');
    document.getElementById('mbtn').classList.toggle('hasnew', hasNew);
    save();
  }

  var toastT;
  function toast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('show'); },1600); }
  function resetAll(){ localStorage.removeItem('sm_app'); S={}; location.reload(); }

  /* ---------------- You: the hub ---------------- */
  var STATUS_META = {
    PROSPECT: { emoji:'\\uD83C\\uDF31', title:'New lead' },
    ENGAGED:  { emoji:'\\uD83D\\uDCAC', title:'In conversation' },
    CUSTOMER: { emoji:'\\u2B50',        title:'Customer' }
  };
  var AVENUES = [
    ['ETSY','Etsy'],['SHOPIFY','Shopify'],['INSTAGRAM_SHOP','Instagram'],['DEPOP','Depop'],
    ['AMAZON','Amazon'],['EBAY','eBay'],['OWN_WEBSITE','My own site'],['IN_PERSON','In person'],['OTHER','Elsewhere']
  ];
  var SOCIALS = [
    ['INSTAGRAM','\\uD83D\\uDCF8 Instagram','instagram.com/yourshop'],
    ['TIKTOK','\\uD83C\\uDFB5 TikTok','tiktok.com/@yourshop'],
    ['TWITTER','\\uD83D\\uDCAC X','x.com/yourshop'],
    ['YOUTUBE','\\u25B6\\uFE0F YouTube','youtube.com/@yourshop'],
    ['REDDIT','\\uD83D\\uDC7D Reddit','reddit.com/u/yourname'],
    ['FACEBOOK','\\uD83D\\uDC65 Facebook','facebook.com/yourshop'],
    ['PINTEREST','\\uD83D\\uDCCC Pinterest','pinterest.com/yourshop']
  ];
  // Interaction weights, carried over from the old app's scoring.
  var TOUCH = { MESSAGE:1, MEETING:3, PURCHASE:5, REVIEW:4 };

  function money(n){ return '$' + (Math.round((n||0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}); }
  function daysSince(iso){ if(!iso) return null; return Math.floor((Date.now()-new Date(iso).getTime())/86400000); }
  function ago(iso){
    var m = Math.floor((Date.now()-new Date(iso).getTime())/60000);
    if(m<1) return 'just now'; if(m<60) return m+'m ago';
    var h=Math.floor(m/60); if(h<24) return h+'h ago';
    return Math.floor(h/24)+'d ago';
  }
  function coolingDays(){ return (S.settings && S.settings.cooling) || 7; }

  // Which tab owns each pane, now that they're split across two screens.
  var PANE_TAB = { overview:'shop', clients:'shop', money:'shop', profile:'you', socials:'you', settings:'you' };
  function setPane(btn){
    var screen = btn.closest('.screen');
    screen.querySelectorAll('.subtab').forEach(function(b){ b.classList.toggle('on', b===btn); });
    screen.querySelectorAll('.pane').forEach(function(p){ p.classList.toggle('on', p.id === 'p'+'-'+btn.dataset.pane); });
    window.scrollTo(0,0);
  }
  function goPane(name){
    var btn = document.querySelector('.subtab[data-pane="'+name+'"]');
    if(!btn) return;
    setTab(PANE_TAB[name] || 'you');
    setPane(btn);
  }
  function toggleBox(id){ document.getElementById(id).classList.toggle('on'); }
  function pickStatus(btn){ btn.parentElement.querySelectorAll('.schip').forEach(function(b){ b.classList.toggle('on', b===btn); }); }
  function flash(id){ var e=document.getElementById(id); if(!e) return; e.classList.add('on'); setTimeout(function(){ e.classList.remove('on'); }, 1400); }

  function addContact(){
    var name = document.getElementById('nc-name').value.trim();
    if(!name){ toast('They need a name'); return; }
    var st = document.querySelector('#nc-status .schip.on');
    S.contacts = S.contacts || [];
    S.contacts.push({
      id: 'c'+Date.now(), name: name,
      channel: document.getElementById('nc-channel').value.trim(),
      notes: document.getElementById('nc-notes').value.trim(),
      status: st ? st.dataset.v : 'PROSPECT',
      strength: 0, touches: [], createdAt: new Date().toISOString(), lastAt: null
    });
    save();
    ['nc-name','nc-channel','nc-notes'].forEach(function(i){ document.getElementById(i).value=''; });
    document.getElementById('add-contact').classList.remove('on');
    toast('Added to your book');
    refresh();
  }
  function logTouch(id, type){
    var c = (S.contacts||[]).filter(function(x){ return x.id===id; })[0];
    if(!c) return;
    c.touches = c.touches || [];
    c.touches.push({ type: type, at: new Date().toISOString() });
    c.strength = (c.strength||0) + (TOUCH[type]||1);
    c.lastAt = new Date().toISOString();
    // Status climbs on its own as the relationship does.
    if(type==='PURCHASE') c.status='CUSTOMER';
    else if(c.status==='PROSPECT') c.status='ENGAGED';
    save(); toast(type.toLowerCase()+' logged'); refresh();
  }
  function delContact(id){
    S.contacts = (S.contacts||[]).filter(function(c){ return c.id!==id; });
    save(); refresh();
  }

  function addSale(){
    var amt = parseFloat(document.getElementById('ns-amount').value);
    if(!(amt>0)){ toast('Enter an amount'); return; }
    S.payments = S.payments || [];
    S.payments.push({
      id:'p'+Date.now(), amount: amt,
      who: document.getElementById('ns-who').value.trim(),
      note: document.getElementById('ns-note').value.trim(),
      at: new Date().toISOString()
    });
    S.sales = (S.sales||0)+1;
    save();
    ['ns-amount','ns-who','ns-note'].forEach(function(i){ document.getElementById(i).value=''; });
    complete('log-sale');
    toast('Sale recorded \\u2014 ' + money(amt));
    refresh();
  }
  function addProduct(){
    var n = document.getElementById('np-name').value.trim();
    if(!n){ toast('Name the product'); return; }
    S.products = S.products || [];
    S.products.push({
      id:'pr'+Date.now(), name:n,
      price: parseFloat(document.getElementById('np-price').value) || 0,
      stock: document.getElementById('np-stock').value.trim()==='' ? null : parseInt(document.getElementById('np-stock').value,10)
    });
    save();
    ['np-name','np-price','np-stock'].forEach(function(i){ document.getElementById(i).value=''; });
    document.getElementById('add-product').classList.remove('on');
    toast('On the shelf');
    refresh();
  }
  function delProduct(id){ S.products=(S.products||[]).filter(function(p){ return p.id!==id; }); save(); refresh(); }

  function saveBiz(){
    S.bizProfile = S.bizProfile || {};
    S.bizProfile.name = document.getElementById('bp-name').value;
    S.bizProfile.niche = document.getElementById('bp-niche').value;
    S.bizProfile.desc = document.getElementById('bp-desc').value;
    S.bizProfile.url  = document.getElementById('bp-url').value;
    if(S.bizProfile.name) S.biz = S.bizProfile.name;
    // Editing the niche here re-tunes Growth, same as picking one in Discover.
    if(S.bizProfile.niche){
      S.niche = { slug:'my-business', name:S.bizProfile.niche, tags:S.bizProfile.niche };
      matchGrow();
    }
    save(); flash('sv-biz');
  }
  function pickBizType(btn){
    pickStatus(btn);
    S.bizProfile = S.bizProfile || {}; S.bizProfile.type = btn.dataset.v; save(); flash('sv-biz');
  }
  function toggleAvenue(btn){
    S.bizProfile = S.bizProfile || {}; S.bizProfile.avenues = S.bizProfile.avenues || [];
    var v = btn.dataset.v, at = S.bizProfile.avenues.indexOf(v);
    if(at===-1) S.bizProfile.avenues.push(v); else S.bizProfile.avenues.splice(at,1);
    btn.classList.toggle('on', at===-1);
    save(); flash('sv-biz');
  }
  function saveMe(){
    S.me = S.me || {};
    S.me.name = document.getElementById('me-name').value;
    S.me.email = document.getElementById('me-email').value;
    S.me.loc = document.getElementById('me-loc').value;
    S.me.bio = document.getElementById('me-bio').value;
    S.me.goals = document.getElementById('me-goals').value;
    if(S.me.name){ S.profile = S.profile || {}; S.profile.name = S.me.name; }
    save(); flash('sv-me');
  }
  function saveSocial(p){
    S.socialLinks = S.socialLinks || {};
    S.socialLinks[p] = document.getElementById('soc-'+p).value;
    save(); flash('sv-soc'); renderSocialCount();
  }
  function saveCooling(){
    S.settings = S.settings || {};
    S.settings.cooling = Number(document.getElementById('set-cooling').value);
    document.getElementById('set-cooling-v').textContent = S.settings.cooling;
    save(); refresh();
  }
  function saveAi(){
    S.settings = S.settings || {};
    S.settings.aiUrl = document.getElementById('ai-url').value;
    S.settings.aiModel = document.getElementById('ai-model').value;
    save(); flash('sv-ai'); renderAiState();
  }
  function renderAiState(){
    var s = S.settings || {};
    document.getElementById('ai-state').textContent = (s.aiUrl && s.aiModel)
      ? '\\uD83E\\uDDE0 Connected \\u00b7 ' + s.aiModel
      : '\\u2699\\uFE0F Not connected \\u2014 using the built-in engine';
  }
  function renderSocialCount(){
    var n = Object.values(S.socialLinks||{}).filter(Boolean).length;
    document.getElementById('soc-count').textContent = n + ' connected';
  }

  var youBuilt = false;
  function buildYouOnce(){
    if(youBuilt) return; youBuilt = true;
    document.getElementById('bp-avenues').innerHTML = AVENUES.map(function(a){
      return '<button class="schip" data-v="'+a[0]+'" onclick="toggleAvenue(this)">'+esc(a[1])+'</button>';
    }).join('');
    document.getElementById('socials-fields').innerHTML = SOCIALS.map(function(s){
      return '<div class="fld"><label>'+s[1]+'</label><input id="soc-'+s[0]+'" placeholder="'+attr(s[2])+'" oninput="saveSocial(\\''+s[0]+'\\')"></div>';
    }).join('');
  }

  function renderYou(levelNum, levelName){
    buildYouOnce();
    var contacts = S.contacts || [], products = S.products || [], payments = S.payments || [];
    var total = payments.reduce(function(a,p){ return a+p.amount; }, 0);

    document.getElementById('you-greet').textContent = S.me && S.me.name ? ('Hi, ' + S.me.name.split(' ')[0])
      : (S.profile && S.profile.name ? ('Hi, ' + S.profile.name.split(' ')[0]) : 'You');
    document.getElementById('you-sub').textContent = S.biz ? ('Here\\'s where ' + S.biz + ' stands.') : 'Your business at a glance.';

    countTo(document.getElementById('ov-people'), contacts.length);
    countTo(document.getElementById('ov-revenue'), total, '$');
    countTo(document.getElementById('ov-listings'), products.length);
    document.getElementById('ov-level').textContent = levelNum;
    document.getElementById('ov-levelname').textContent = levelName;

    // Who needs you — quiet longer than the cooling-off setting.
    var cool = coolingDays();
    var quiet = contacts.map(function(c){ return { c:c, d:daysSince(c.lastAt) }; })
      .filter(function(x){ return x.d===null || x.d>=cool; })
      .sort(function(a,b){ return (b.c.strength||0)-(a.c.strength||0); }).slice(0,4);
    document.getElementById('ov-attention').innerHTML = contacts.length===0
      ? '<div class="note">Every business starts with one person who cared. Add yours.</div>'
      : (quiet.length===0 ? '<div class="note">You\\'re on top of everyone. Nothing\\'s going cold. \\uD83D\\uDD25</div>'
        : quiet.map(function(x){
            return '<div class="lrow"><div class="lrow-main"><span class="sdot s-'+x.c.status+'"></span>'+esc(x.c.name)+
              '<div class="lrow-sub">'+(x.d===null?'never contacted':x.d+' days quiet')+(x.c.channel?' \\u00b7 '+esc(x.c.channel):'')+'</div></div>'+
              '<button class="hcard-a" onclick="logTouch(\\''+x.c.id+'\\',\\'MESSAGE\\')">Check in \\u2192</button></div>';
          }).join(''));

    // Recent moves across everything logged.
    var feed = [];
    contacts.forEach(function(c){ (c.touches||[]).forEach(function(t){ feed.push({ at:t.at, text:esc(c.name)+' \\u00b7 '+t.type.toLowerCase() }); }); });
    payments.forEach(function(p){ feed.push({ at:p.at, text:money(p.amount)+' sale'+(p.who?' \\u00b7 '+esc(p.who):'') }); });
    feed.sort(function(a,b){ return new Date(b.at)-new Date(a.at); });
    document.getElementById('ov-activity').innerHTML = feed.length===0
      ? '<div class="note">No activity yet \\u2014 log your first interaction and the story starts here.</div>'
      : feed.slice(0,5).map(function(f){
          return '<div class="lrow"><div class="lrow-main">'+f.text+'</div><span class="lrow-sub">'+ago(f.at)+'</span></div>';
        }).join('');

    var top = contacts.filter(function(c){ return (c.strength||0)>0; })
      .sort(function(a,b){ return b.strength-a.strength; }).slice(0,3);
    document.getElementById('ov-top').innerHTML = top.length===0
      ? '<div class="note">Log a few interactions and your strongest relationships surface here.</div>'
      : top.map(function(c,i){
          return '<div class="lrow"><div class="lrow-main">'+['\\uD83E\\uDD47','\\uD83E\\uDD48','\\uD83E\\uDD49'][i]+' '+esc(c.name)+'</div><span class="strength">'+Math.round(c.strength)+'</span></div>';
        }).join('');

    // Clients
    document.getElementById('clients-list').innerHTML = contacts.length===0
      ? '<div class="hcard"><div class="note">Nobody in your book yet. Add the first person who showed interest \\u2014 even if they haven\\'t bought.</div></div>'
      : contacts.slice().sort(function(a,b){ return (b.strength||0)-(a.strength||0); }).map(function(c){
          var m = STATUS_META[c.status] || STATUS_META.PROSPECT;
          return '<div class="hcard"><div class="hcard-h"><div class="hcard-t">'+esc(c.name)+'</div>'+
            '<span class="lrow-sub">'+m.emoji+' '+m.title+'</span></div>'+
            (c.channel? '<div class="lrow-sub">Found via '+esc(c.channel)+'</div>':'')+
            (c.notes? '<div class="note" style="margin-top:6px">'+esc(c.notes)+'</div>':'')+
            '<div class="lrow" style="border:none; padding-bottom:0"><div class="lrow-main lrow-sub">'+
              (c.lastAt? 'Last touch '+ago(c.lastAt) : 'No contact yet')+' \\u00b7 strength <span class="strength">'+Math.round(c.strength||0)+'</span></div></div>'+
            '<div class="chiprow" style="margin-top:8px">'+
              '<button class="schip" onclick="logTouch(\\''+c.id+'\\',\\'MESSAGE\\')">Messaged</button>'+
              '<button class="schip" onclick="logTouch(\\''+c.id+'\\',\\'MEETING\\')">Met</button>'+
              '<button class="schip" onclick="logTouch(\\''+c.id+'\\',\\'PURCHASE\\')">Bought</button>'+
              '<button class="schip" onclick="delContact(\\''+c.id+'\\')" style="color:var(--danger)">Remove</button>'+
            '</div></div>';
        }).join('');

    // Money
    document.getElementById('mn-total').textContent = money(total);
    document.getElementById('mn-avg').textContent = money(payments.length ? total/payments.length : 0);
    document.getElementById('sales-list').innerHTML = payments.length===0
      ? '<div class="note">The first dollar is the hardest \\u2014 and the sweetest. Record it when it lands.</div>'
      : payments.slice().reverse().slice(0,8).map(function(p){
          return '<div class="lrow"><div class="lrow-main"><strong class="money">'+money(p.amount)+'</strong>'+
            (p.note? ' \\u00b7 '+esc(p.note):'')+'<div class="lrow-sub">'+(p.who? esc(p.who)+' \\u00b7 ':'')+ago(p.at)+'</div></div></div>';
        }).join('');
    document.getElementById('products-list').innerHTML = products.length===0
      ? '<div class="note">Give people something to say yes to \\u2014 add your first product.</div>'
      : products.map(function(p){
          return '<div class="lrow"><div class="lrow-main">'+esc(p.name)+
            '<div class="lrow-sub">'+(p.price? money(p.price):'no price')+(p.stock!==null&&p.stock!==undefined? ' \\u00b7 '+p.stock+' in stock':'')+'</div></div>'+
            '<button class="hcard-a" onclick="delProduct(\\''+p.id+'\\')" style="color:var(--danger)">Remove</button></div>';
        }).join('');

    // Ventures
    document.getElementById('ventures-list').innerHTML =
      '<div class="lrow"><div class="lrow-main"><strong>'+esc(S.biz || 'Your first venture')+'</strong>'+
      '<div class="lrow-sub">'+esc((S.niche && S.niche.name) || 'No niche picked yet')+'</div></div>'+
      '<span class="lrow-sub">active</span></div>';
  }

  // Fill the You forms from saved state on load.
  function hydrateYou(){
    buildYouOnce();
    var b = S.bizProfile || {}, me = S.me || {}, set = S.settings || {};
    document.getElementById('bp-name').value = b.name || S.biz || '';
    document.getElementById('bp-niche').value = b.niche || (S.niche? S.niche.name : '');
    document.getElementById('bp-desc').value = b.desc || '';
    document.getElementById('bp-url').value = b.url || '';
    if(b.type) document.querySelectorAll('#bp-type .schip').forEach(function(x){ x.classList.toggle('on', x.dataset.v===b.type); });
    (b.avenues||[]).forEach(function(v){
      var el = document.querySelector('#bp-avenues .schip[data-v="'+v+'"]'); if(el) el.classList.add('on');
    });
    document.getElementById('me-name').value = me.name || (S.profile? S.profile.name : '') || '';
    document.getElementById('me-email').value = me.email || '';
    document.getElementById('me-loc').value = me.loc || '';
    document.getElementById('me-bio').value = me.bio || '';
    document.getElementById('me-goals').value = me.goals || '';
    Object.entries(S.socialLinks||{}).forEach(function(kv){
      var el = document.getElementById('soc-'+kv[0]); if(el) el.value = kv[1] || '';
    });
    document.getElementById('set-cooling').value = set.cooling || 7;
    document.getElementById('set-cooling-v').textContent = set.cooling || 7;
    document.getElementById('ai-url').value = set.aiUrl || '';
    document.getElementById('ai-model').value = set.aiModel || '';
    renderAiState(); renderSocialCount();
  }

  /* ---------------- Onboarding ---------------- */
  var ONB = ${JSON.stringify(onboarding)};
  var NICHES = ${JSON.stringify(
    products.map((p: any) => ({
      slug: p.nicheSlug, name: p.niche?.name ?? '', domain: p.niche?.domain ?? '',
      tags: p.niche?.tags ?? '', imageUrl: p.imageUrl,
      productTitle: p.title, blurb: p.blurb,
      sourcingType: p.sourcingType, sourceName: p.sourceName,
      sourceCost: p.sourceCost, typicalResale: p.typicalResale,
    }))
  )};
  // Beginner-friendly fallbacks when an answer matches nothing — low cost to
  // start, and between them they cover three different ways in.
  var STARTERS = ['stickers-decals','apparel-pod','digital-planners','candles-fragrance','hair-accessories'];
  var O = { i: -1, answers: {}, skipped: [] };

  function onbSteps(){
    var p = O.answers.path;
    // The beginner path is where the world gets opened up: two prompts they
    // pick themselves, each followed by a reveal built from their own words.
    if(p === 'new') return ONB.shared.concat([
      { id:'p1', type:'prompt', n:1 },
      { id:'r1', type:'reveal', n:1 },
      { id:'p2', type:'prompt', n:2 },
      { id:'r2', type:'reveal', n:2 }
    ]);
    return ONB.shared.concat(p && ONB.forks[p] ? ONB.forks[p] : []);
  }
  function onbVal(id){ return O.answers[id]; }

  function onbValid(step){
    if(step.type === 'reveal') return true;
    if(step.type === 'prompt'){
      var a = O.answers['p' + step.n];
      return !!(a && a.promptId && String(a.text || '').trim());
    }
    var v = onbVal(step.id);
    if(step.optional && !step.required) return true;
    if(step.type === 'multi') return Array.isArray(v) && v.length >= (step.min || 1);
    return typeof v === 'string' ? v.trim().length > 0 : v !== undefined && v !== null;
  }

  // Nothing to buy, nothing to store — what we show someone who told us
  // they're blocked or worried.
  var ZERO_START = ['digital-planners','notion-templates','design-assets','apparel-pod','stickers-decals'];

  function firstNum(s){
    var m = String(s || '').match(/(\\d[\\d,]*)/);
    return m ? Number(m[1].replace(/,/g, '')) : 0;
  }

  // Pick the niche that best answers what they typed. Reveal two avoids the
  // first one's sourcing model so they leave knowing there's more than one
  // way to do this. For "unblock" the mode decides, not the answer — the
  // whole point is showing something that asks nothing of them.
  function revealFor(text, excludeType, mode){
    if(mode === 'unblock'){
      // Honour ZERO_START's order, not the content file's — the first entries
      // genuinely cost nothing, and "nothing to buy up front" next to a $20
      // price tag reads as a lie.
      var zero = ZERO_START.map(function(slug){
        return NICHES.filter(function(n){ return n.slug === slug; })[0];
      }).filter(function(n){
        return n && (!excludeType || n.sourcingType !== excludeType);
      });
      if(zero.length) return { niche: zero[0], matched: true };
    }
    var want = tokens(text);
    var best = null, bestScore = 0;
    NICHES.forEach(function(n){
      if(excludeType && n.sourcingType === excludeType) return;
      var hay = (n.name + ' ' + n.domain + ' ' + n.tags + ' ' + n.productTitle + ' ' + n.blurb).toLowerCase();
      var score = 0;
      want.forEach(function(t){ if(hay.indexOf(t) !== -1) score++; });
      if(score > bestScore){ bestScore = score; best = n; }
    });
    if(best) return { niche: best, matched: true };
    var pool = NICHES.filter(function(n){
      return STARTERS.indexOf(n.slug) !== -1 && (!excludeType || n.sourcingType !== excludeType);
    });
    return { niche: pool[0] || NICHES[0], matched: false };
  }

  function onbRender(){
    var main = document.getElementById('onb-main');
    var foot = document.getElementById('onb-foot');
    var back = document.getElementById('onb-back');
    var steps = onbSteps();

    // Welcome
    if(O.i < 0){
      document.getElementById('onb-prog').style.width = '0%';
      back.classList.remove('show');
      main.className = 'onb-main onb-fade';
      main.innerHTML = '<div class="onb-mark">&#128295;</div>' +
        '<div class="onb-chapter">' + esc(ONB.welcome.eyebrow) + '</div>' +
        '<h1 class="onb-title">' + esc(ONB.welcome.title) + '</h1>' +
        '<p class="onb-sub">' + esc(ONB.welcome.body) + '</p>' +
        '<div class="onb-meta">' + esc(ONB.welcome.meta) + '</div>';
      foot.innerHTML = '<button class="onb-cta" onclick="onbNext()">' + esc(ONB.welcome.cta) + '</button>';
      return;
    }

    // Finish
    if(O.i >= steps.length){
      var p = O.answers.path || 'new';
      var f = ONB.finish[p];
      var nm = (O.answers.name || '').split(' ')[0];
      document.getElementById('onb-prog').style.width = '100%';
      back.classList.remove('show');
      main.className = 'onb-main onb-fade onb-center';
      main.innerHTML = '<div class="onb-mark">&#10003;</div>' +
        '<div class="onb-chapter">' + esc(f.eyebrow) + '</div>' +
        '<h1 class="onb-title">' + esc(f.title.replace('{name}', nm)) + '</h1>' +
        '<p class="onb-sub">' + esc(f.body.replace('{biz}', O.answers.bizName || 'Your business')) + '</p>' +
        (O.skipped.length ? '<div class="onb-note">' + esc(ONB.finish.note) + '</div>' : '');
      foot.innerHTML = '<button class="onb-cta" onclick="onbDone()">' + esc(f.cta) + '</button>';
      return;
    }

    var step = steps[O.i];
    document.getElementById('onb-prog').style.width = Math.round((O.i) / steps.length * 100) + '%';
    back.classList.toggle('show', O.i > 0);
    main.className = 'onb-main onb-fade';

    // Reveal: not a question. Which prompt they CHOSE decides how we answer
    // — someone who picked "what's stopped you" needs a different response
    // than someone who picked "what could you talk about for an hour".
    if(step.type === 'reveal'){
      var R = ONB.reveal;
      var src = O.answers['p' + step.n] || {};
      var opt = R && ONB.prompts.options.filter(function(o){ return o.id === src.promptId; })[0] || {};
      var mode = opt.mode || 'product';
      var M = R.modes[mode] || R.modes.product;
      var res = revealFor(src.text, step.n === 2 ? O.firstModel : null, mode);
      var n = res.niche;
      if(step.n === 1) O.firstModel = n.sourcingType;

      var extra = '';
      if(mode === 'math'){
        var margin = Math.max(1, firstNum(n.typicalResale) - firstNum(n.sourceCost));
        extra = '<div class="onb-rev-model">' +
          esc(R.mathTemplate.replace('{margin}', margin).replace('{count}', Math.ceil(500 / margin))) +
          '</div>';
      }

      main.innerHTML =
        '<div class="onb-chapter">' + esc(M.chapter) + '</div>' +
        (n.imageUrl ? '<div class="onb-rev-img" style="background-image:url(\\'' + attr(n.imageUrl) + '\\')"></div>' : '') +
        '<div class="onb-rev-lead">' + esc(opt.lead || '') + '</div>' +
        '<h1 class="onb-rev-title">' + esc(n.productTitle) + '</h1>' +
        '<p class="onb-rev-blurb">' + esc(res.matched ? n.blurb : R.fallbackNote + ' ' + n.blurb) + '</p>' +
        '<div class="onb-rev-nums">' +
          '<div><div class="onb-rev-k">' + esc(R.costLabel) + '</div><div class="onb-rev-v">' + esc(n.sourceCost) + '</div></div>' +
          '<div><div class="onb-rev-k">' + esc(R.sellLabel) + '</div><div class="onb-rev-v sell">' + esc(n.typicalResale) + '</div></div>' +
        '</div>' +
        extra +
        '<div class="onb-rev-model">' + esc(R.models[n.sourcingType] || '') + '</div>' +
        '<div class="onb-rev-closer">' + esc(step.n === 1 ? M.closer : R.closerSecond) + '</div>';
      foot.innerHTML = '<button class="onb-cta" onclick="onbNext()">' +
        esc(step.n === 1 ? R.ctaSecond : R.cta) + '</button>';
      return;
    }

    // Prompt: they choose which question to answer, then answer it openly.
    if(step.type === 'prompt'){
      var P = ONB.prompts;
      var key = 'p' + step.n;
      var cur = O.answers[key] || {};
      var otherId = (O.answers[step.n === 1 ? 'p2' : 'p1'] || {}).promptId;
      var pick = P.options.filter(function(o){ return o.id === cur.promptId; })[0];
      var inner = '<div class="onb-chapter">' + esc(P.chapter) + '</div>' +
        '<h1 class="onb-title">' + esc(step.n === 1 ? P.title : P.titleSecond) + '</h1>' +
        '<p class="onb-sub">' + esc(step.n === 1 ? P.subtitle : P.subtitleSecond) + '</p><div class="onb-body">';
      if(!pick){
        inner += '<div class="onb-plist">' + P.options
          .filter(function(o){ return o.id !== otherId; })
          .map(function(o){
            return '<button class="onb-prompt" onclick="onbPickPrompt(' + step.n + ',\\'' + o.id + '\\')">' +
              esc(o.label) + '</button>';
          }).join('') + '</div>';
      } else {
        inner += '<div class="onb-plabel">' + esc(pick.label) + '</div>' +
          '<textarea class="onb-in" id="onb-input" placeholder="' + attr(pick.placeholder) + '">' +
          esc(cur.text || '') + '</textarea>' +
          '<button class="onb-change" onclick="onbClearPrompt(' + step.n + ')">' + esc(P.change) + '</button>';
      }
      main.innerHTML = inner + '</div>';
      foot.innerHTML = pick
        ? '<button class="onb-cta" id="onb-cta" onclick="onbNext()"' + (onbValid(step) ? '' : ' disabled') + '>Continue</button>'
        : '';
      var pin = document.getElementById('onb-input');
      if(pin){
        pin.focus();
        pin.oninput = function(){
          O.answers[key] = { promptId: cur.promptId, text: pin.value };
          document.getElementById('onb-cta').disabled = !onbValid(step);
        };
      }
      return;
    }

    var html = '<div class="onb-chapter">' + esc(step.chapter) + '</div>' +
      '<h1 class="onb-title">' + esc(step.title) + '</h1>' +
      '<p class="onb-sub">' + esc(step.subtitle) + '</p><div class="onb-body">';

    var v = onbVal(step.id);
    if(step.type === 'text' || step.type === 'number'){
      html += '<input class="onb-in" id="onb-input" type="' + (step.type === 'number' ? 'tel' : 'text') +
        '" placeholder="' + attr(step.placeholder || '') + '" value="' + attr(v || '') + '">';
    } else if(step.type === 'textarea'){
      html += '<textarea class="onb-in" id="onb-input" placeholder="' + attr(step.placeholder || '') + '">' + esc(v || '') + '</textarea>';
    } else if(step.type === 'single' || step.type === 'fork'){
      html += '<div class="onb-opts">' + step.options.map(function(o){
        return '<button class="onb-opt' + (v === o.value ? ' sel' : '') + '" onclick="onbPick(\\'' + o.value + '\\')">' +
          '<div class="onb-opt-l">' + esc(o.label) + '</div>' +
          (o.hint ? '<div class="onb-opt-h">' + esc(o.hint) + '</div>' : '') + '</button>';
      }).join('') + '</div>';
    } else if(step.type === 'multi'){
      var sel = Array.isArray(v) ? v : [];
      html += '<div class="onb-chips">' + step.options.map(function(o){
        return '<button class="onb-chip' + (sel.indexOf(o.value) !== -1 ? ' sel' : '') +
          '" onclick="onbToggle(\\'' + String(o.value).replace(/'/g, "\\\\'") + '\\')">' + esc(o.label) + '</button>';
      }).join('') + '</div>';
    }
    html += '</div>';
    main.innerHTML = html;

    var last = O.i === steps.length - 1;
    foot.innerHTML = '<button class="onb-cta" id="onb-cta" onclick="onbNext()"' + (onbValid(step) ? '' : ' disabled') + '>' +
      (last ? 'Finish' : 'Continue') + '</button>' +
      (step.optional ? '<button class="onb-skip" onclick="onbSkip()">Skip for now</button>' : '');

    var input = document.getElementById('onb-input');
    if(input){
      input.focus();
      input.oninput = function(){
        O.answers[step.id] = input.value;
        document.getElementById('onb-cta').disabled = !onbValid(step);
      };
      input.onkeydown = function(e){ if(e.key === 'Enter' && step.type !== 'textarea' && onbValid(step)){ onbNext(); } };
    }
  }

  function onbPickPrompt(n, id){
    O.answers['p' + n] = { promptId: id, text: '' };
    onbRender();
  }
  function onbClearPrompt(n){
    delete O.answers['p' + n];
    onbRender();
  }
  function onbPick(val){
    var step = onbSteps()[O.i];
    O.answers[step.id] = val;
    onbRender();
    setTimeout(onbNext, 240);
  }
  function onbToggle(val){
    var step = onbSteps()[O.i];
    var cur = Array.isArray(O.answers[step.id]) ? O.answers[step.id].slice() : [];
    var at = cur.indexOf(val);
    if(at === -1) cur.push(val); else cur.splice(at, 1);
    O.answers[step.id] = cur;
    onbRender();
  }
  function onbSkip(){
    var step = onbSteps()[O.i];
    if(O.skipped.indexOf(step.id) === -1) O.skipped.push(step.id);
    delete O.answers[step.id];
    O.i++;
    onbRender();
  }
  function onbNext(){
    if(O.i >= 0){
      var step = onbSteps()[O.i];
      if(step && !onbValid(step)) return;
      var at = O.skipped.indexOf(step ? step.id : '');
      if(at !== -1) O.skipped.splice(at, 1);
    }
    O.i++;
    onbRender();
  }
  function onbBack(){ if(O.i > 0){ O.i--; onbRender(); } }

  function onbDone(){
    var a = O.answers;
    S.profile = { name: a.name };
    S.path = a.path;
    S.skipped = O.skipped;
    S.onboarded = true;

    if(a.path === 'have'){
      S.biz = a.bizName;
      // Their own words drive Grow matching from the very first screen.
      S.niche = { slug: 'my-business', name: a.bizNiche, tags: a.bizNiche };
      S.idealCustomer = a.idealCustomer || '';
      save();
      // They've already lived the early stages, so credit them in order —
      // levels gate sequentially, and Journey should reflect where they
      // actually are rather than starting them at step one.
      ['open-discover','open-niche','pick-niche','name-business','start-business']
        .forEach(function(id){ complete(id, true); });
    } else {
      // Both prompt answers together are what Discover tunes to.
      S.prompts = [a.p1, a.p2].filter(Boolean);
      S.interests = S.prompts.map(function(p){ return p.text; }).join(' ');
      save();
    }
    save();
    document.getElementById('onb').classList.remove('on');
    matchDiscover();
    matchGrow();
    refresh();
    setTab(a.path === 'have' ? 'grow' : 'discover');
  }

  function onbOpen(){
    O = { i: -1, answers: {}, skipped: [] };
    document.getElementById('onb').classList.add('on');
    onbRender();
  }

  matchDiscover();
  matchGrow();
  hydrateYou();
  applySaved();
  tickStreak();
  refresh();
  if(S.tab){ setTab(S.tab); }
  if(!S.onboarded){ onbOpen(); }
</script>
</body></html>`;
}

createServer((req, res) => {
  try {
    const niches = JSON.parse(readFileSync(`${dir}/niches.json`, 'utf8'));
    // The product database: one file per category, all loaded and joined to
    // their niche. Adding a category is just another file in the folder.
    const nicheBySlug: Record<string, any> = {};
    for (const n of niches) nicheBySlug[n.slug] = n;
    const products = readdirSync(`${dir}/products`)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(`${dir}/products/${f}`, 'utf8')))
      .map((p: any) => ({ ...p, niche: nicheBySlug[p.nicheSlug] }))
      .filter((p: any) => p.niche);
    const communities = readdirSync(`${dir}/communities`)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(`${dir}/communities/${f}`, 'utf8')));
    const missions = JSON.parse(readFileSync(`${dir}/missions.json`, 'utf8'));
    const onboarding = JSON.parse(readFileSync(`${dir}/onboarding.json`, 'utf8'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(products, communities, missions, onboarding));
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Could not render: ${err.message}`);
  }
}).listen(PORT, () => {
  console.log(`Sales Mechanic base app: http://localhost:${PORT}`);
  console.log('Discover + Grow + Journey in one shell. Ctrl+C to stop.');
});
