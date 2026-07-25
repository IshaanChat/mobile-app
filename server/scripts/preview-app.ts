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
  youtube: '#CC0000', etsy: '#F1641E', pinterest: '#E60023', facebook: '#1877F2', forum: '#5A67D8',
};
const KIND_LABELS: Record<string, string> = {
  community: 'Community', hashtag: 'Hashtag', marketplace: 'Marketplace', search: 'Search recipe', event: 'Event',
};

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s: any) => esc(s).replace(/"/g, '&quot;');
const lines = (s: any) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const pColor = (p: string) => PLATFORM_COLORS[String(p).toLowerCase()] ?? '#5A67D8';

// Discover is a feed of PRODUCTS — the niche is a label on the card, not the
// unit you scroll. Each product carries its niche so filtering, matching and
// "choose this" still work at the niche level.
function productCard(p: any) {
  const n = p.niche ?? {};
  const aud = AUDIENCE_COLORS[n.audience] ?? '#60646c';
  const searchText = [p.title, p.blurb, n.name, n.domain, n.tags].filter(Boolean).join(' ').toLowerCase();
  return `<div class="card product" data-slug="${attr(p.slug)}" data-niche="${attr(p.nicheSlug)}" data-aud="${attr(n.audience)}" data-text="${attr(searchText)}">
    <div class="head" onclick="toggleCard(this,'open-niche')">
      <div class="hero" style="background-image:url('${attr(p.imageUrl)}')">
        <div class="chips"><span class="chip" style="background:${aud}">${esc(AUDIENCE_LABELS[n.audience] ?? n.audience ?? '')}</span><span class="chip chip-dark">${esc(SOURCING_LABELS[p.sourcingType] ?? '')}</span></div>
        <span class="match-badge">&#9733; your kind of thing</span>
      </div>
      <div class="body"><div class="titlerow"><div><div class="kicker">${esc(n.name ?? '')}</div><div class="title">${esc(p.title)}</div><div class="econ-inline"><span class="cost">${esc(p.sourceCost)}</span><span class="arrow">&rarr;</span><span class="resale">${esc(p.typicalResale)}</span></div></div><div class="chev">&#9660;</div></div></div>
    </div>
    <div class="expand">
      <p class="para">${esc(p.blurb)}</p>
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
    <section class="level" data-level="${lv.level}">
      <div class="level-h"><span class="lv-num">${lv.level}</span><span class="lv-name">${esc(lv.name)}</span><span class="lv-title">${esc(lv.title)}</span><span class="lv-lock">&#128274;</span></div>
      <div class="ms-list">${byLevel(lv.level).map(milestoneRow).join('')}</div>
    </section>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sales Mechanic — base app</title>
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
    --engaged:#cf8f2e;
    --customer:#5f9b7a;
    --danger:#cc4f4f;
    --scoreboard:#34262b;
    --shadow:0 2px 12px rgba(90,50,60,0.07);
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
      --engaged:#5b9cf0;
      --customer:#34c477;
      --danger:#e5484d;
      --scoreboard:#14161b;
      --shadow:0 2px 12px rgba(0,0,0,0.45);
    }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--surround); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:var(--text); }
  h1,h2,h3 { letter-spacing:-0.02em; }
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
  .tabbar { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:430px; background:var(--panel); border-top:1px solid var(--panel-border); display:flex; height:64px; z-index:20; }
  .tab { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; cursor:pointer; color:var(--text-dim); font-size:11px; }
  .tab.on { color:var(--accent); }
  .tab .ic { font-size:20px; line-height:1; }
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
<div class="app">
  <!-- DISCOVER -->
  <div class="screen active" id="s-discover">
    <div class="top"><h1>Discover</h1><div class="sub">Trending products &mdash; and where to source them.</div></div>
    <div class="filters">
      <button class="chipbtn on" data-f="all" onclick="setFilter(this)">All</button>
      <button class="chipbtn" data-f="maker" onclick="setFilter(this)">Maker</button>
      <button class="chipbtn" data-f="reseller" onclick="setFilter(this)">Reseller</button>
      <button class="chipbtn" data-f="both" onclick="setFilter(this)">Both</button>
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
  <!-- JOURNEY -->
  <div class="screen" id="s-journey">
    <div class="top"><h1>Journey</h1><div class="sub">Level up from idea to first sale.</div></div>
    <div class="progress-card">
      <div class="pc-level" id="pc-level">Level 1</div>
      <div class="pc-name" id="pc-name">Explorer</div>
      <div class="pc-bar"><div class="pc-fill" id="pc-fill"></div></div>
      <div class="pc-xp" id="pc-xp">0 XP</div>
    </div>
    ${levelsHtml}
  </div>
  <!-- YOU -->
  <div class="screen" id="s-you">
    <div class="top"><h1>You</h1><div class="sub">Your business at a glance.</div></div>
    <div class="you-row"><span class="you-k">Business</span><span class="you-v" id="you-biz">Not started</span></div>
    <div class="you-row"><span class="you-k">Your niche</span><span class="you-v" id="you-niche">Not picked</span></div>
    <div class="you-row"><span class="you-k">Focus community</span><span class="you-v" id="you-comm">None yet</span></div>
    <div class="you-row"><span class="you-k">Level</span><span class="you-v" id="you-level">1 &middot; Explorer</span></div>
    <div class="you-row"><span class="you-k">Sales logged</span><span class="you-v" id="you-sales">0</span></div>
    <button class="reset" onclick="resetAll()">Reset progress</button>
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
    <div class="tab on" data-tab="discover" onclick="setTab('discover')"><span class="ic">&#129517;</span>Discover</div>
    <div class="tab" data-tab="grow" onclick="setTab('grow')"><span class="ic">&#127793;</span>Grow</div>
    <div class="tab" data-tab="journey" onclick="setTab('journey')"><span class="dot"></span><span class="ic">&#128640;</span>Journey</div>
    <div class="tab" data-tab="you" onclick="setTab('you')"><span class="ic">&#128100;</span>You</div>
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
    if(!levelUnlocked(parseInt(el.dataset.level,10))) return;
    done().push(id); save();
    if(!silent){ toast('\\u2713 ' + (TITLES[id]||'Milestone complete')); }
    refresh();
  }
  function fire(trigger){
    var el = document.querySelector('.ms[data-trigger="'+trigger+'"]');
    if(el) complete(el.dataset.id);
  }

  function setTab(name){
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
      var aud = c.getAttribute('data-aud');
      var show = (f==='all') || aud===f;
      c.style.display = show ? '' : 'none';
    });
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
  function startBiz(){ if(!S.biz){ setTab('journey'); toast('Name your business first'); return; } complete('start-business'); }
  function logSale(){ S.sales = (S.sales||0)+1; save(); complete('log-sale'); toast('Sale logged'); }
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

  function matchGrow(){
    var banner = document.getElementById('grow-banner');
    if(!S.niche){ banner.classList.remove('on'); return; }
    var want = tokens(S.niche.tags);
    var count = 0;
    document.querySelectorAll('#s-grow .community').forEach(function(c){
      var have = (c.getAttribute('data-tags')||'').toLowerCase();
      var hit = want.some(function(t){ return t && have.indexOf(t) !== -1; });
      c.classList.toggle('match', hit);
      if(hit) count++;
    });
    banner.textContent = count ? ('Highlighted ' + count + ' communities for ' + S.niche.name) : ('No exact community match yet for ' + S.niche.name);
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
    document.getElementById('pc-level').textContent = cur ? ('Level ' + num) : 'Complete';
    document.getElementById('pc-name').textContent = name;
    document.getElementById('pc-fill').style.width = Math.round(d/total*100) + '%';
    document.getElementById('pc-xp').textContent = d + ' / ' + total + ' milestones';
    // you tab
    document.getElementById('you-biz').textContent = S.biz || 'Not started';
    document.getElementById('you-niche').textContent = S.niche ? S.niche.name : 'Not picked';
    document.getElementById('you-comm').textContent = S.comm ? S.comm.title : 'None yet';
    document.getElementById('you-level').textContent = num + ' \\u00b7 ' + name;
    document.getElementById('you-sales').textContent = S.sales || 0;
    // journey tab dot when new unlockable steps exist
    var hasNew = !!document.querySelector('.level.unlocked .ms:not(.done)');
    document.querySelector('.tab[data-tab="journey"]').classList.toggle('hasnew', hasNew && S.tab!=='journey');
    save();
  }

  var toastT;
  function toast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('show'); },1600); }
  function resetAll(){ localStorage.removeItem('sm_app'); S={}; location.reload(); }

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
    const communities = JSON.parse(readFileSync(`${dir}/communities.json`, 'utf8'));
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
