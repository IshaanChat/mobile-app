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

import { readFileSync } from 'fs';
import { createServer } from 'http';

const PORT = Number(process.env.PREVIEW_PORT ?? 4300);
const dir = 'content';

const SOURCING_LABELS: Record<string, string> = {
  DROPSHIP: 'Dropship', WHOLESALE: 'Wholesale', PRINT_ON_DEMAND: 'Print on demand',
  MATERIALS: 'Materials', MAKE_YOUR_OWN: 'Make your own',
};
const AUDIENCE_LABELS: Record<string, string> = { maker: 'Maker', reseller: 'Reseller', both: 'Maker + reseller' };
const AUDIENCE_COLORS: Record<string, string> = { maker: '#188038', reseller: '#8a4ddb', both: '#208aef' };
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

function nicheCard(n: any) {
  const p = n.product ?? {};
  const aud = AUDIENCE_COLORS[n.audience] ?? '#60646c';
  return `<div class="card niche" data-slug="${attr(n.slug)}" data-aud="${attr(n.audience)}">
    <div class="head" onclick="toggleCard(this,'open-niche')">
      <div class="hero" style="background-image:url('${attr(n.imageUrl)}')">
        <div class="chips"><span class="chip" style="background:${aud}">${esc(AUDIENCE_LABELS[n.audience] ?? n.audience)}</span><span class="chip chip-dark">${esc(SOURCING_LABELS[p.sourcingType] ?? '')}</span></div>
      </div>
      <div class="body"><div class="titlerow"><div><div class="kicker">${esc(n.domain)}</div><div class="title">${esc(n.name)}</div><div class="tagline">${esc(p.title)}</div></div><div class="chev">&#9660;</div></div></div>
    </div>
    <div class="expand">
      <p class="para">${esc(p.blurb)}</p>
      <div class="mini"><div class="mini-t">The math</div><div class="econ"><span class="cost">${esc(p.sourceCost)}</span><span class="arrow">&rarr;</span><span class="resale">${esc(p.typicalResale)}</span></div></div>
      <div class="mini"><div class="mini-t">Where to source</div><div class="src-b">${esc(p.sourceName)} &middot; ${esc(SOURCING_LABELS[p.sourcingType] ?? '')}</div></div>
      <a class="btn ghost" href="${attr(p.sourcingUrl)}" target="_blank" rel="noreferrer" onclick="fire('view-source')">Source it &#8599;</a>
      <button class="btn primary pick-niche" data-slug="${attr(n.slug)}" data-name="${attr(n.name)}" data-tags="${attr(n.tags)}" onclick="chooseNiche(this)">Choose this niche</button>
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

function page(niches: any[], communities: any[], missions: any) {
  const domains = [...new Set(niches.map((n) => n.domain))];
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
  * { box-sizing:border-box; }
  body { margin:0; background:#e9e9ec; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#111; }
  .app { max-width:430px; margin:0 auto; background:#f4f4f6; min-height:100vh; position:relative; padding-bottom:76px; }
  .screen { display:none; padding:16px; }
  .screen.active { display:block; }
  .top h1 { font-size:22px; margin:6px 0 2px; }
  .top .sub { color:#60646c; font-size:13px; margin-bottom:12px; }
  .filters { display:flex; gap:8px; overflow-x:auto; margin-bottom:6px; }
  .chipbtn { border:1px solid #d0d2d8; background:#fff; border-radius:999px; padding:7px 14px; font-size:13px; cursor:pointer; white-space:nowrap; }
  .chipbtn.on { background:#111; color:#fff; border-color:#111; }
  .card { background:#fff; border-radius:16px; overflow:hidden; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
  .head { cursor:pointer; }
  .hero { height:170px; background-size:cover; background-position:center; position:relative; }
  .chips { position:absolute; left:14px; bottom:14px; display:flex; gap:8px; }
  .chip { color:#fff; font-size:12px; font-weight:600; padding:4px 10px; border-radius:999px; }
  .chip-dark { background:rgba(0,0,0,0.55); font-weight:500; }
  .match-badge { position:absolute; right:14px; top:14px; background:#208aef; color:#fff; font-size:11px; font-weight:600; padding:4px 10px; border-radius:999px; display:none; }
  .card.match .match-badge { display:block; }
  .card.match { outline:2px solid #208aef; }
  .body { padding:14px 16px; }
  .titlerow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .kicker { color:#9095a0; font-size:11px; text-transform:uppercase; letter-spacing:0.4px; }
  .title { font-size:18px; font-weight:600; margin-top:2px; }
  .tagline { color:#60646c; font-size:14px; margin-top:3px; line-height:1.4; }
  .chev { color:#9095a0; font-size:12px; padding-top:4px; transition:transform .15s; }
  .card.open .chev { transform:rotate(180deg); }
  .expand { display:none; padding:0 16px 16px; }
  .card.open .expand { display:block; }
  .para { font-size:14px; line-height:1.6; margin:12px 0 0; }
  .mini { background:#f4f4f6; border-radius:12px; padding:10px 12px; margin-top:12px; }
  .mini-t { font-size:12px; font-weight:600; color:#60646c; }
  .econ { font-size:15px; font-variant:tabular-nums; margin-top:2px; }
  .cost { color:#60646c; } .arrow { color:#9095a0; margin:0 8px; } .resale { color:#188038; font-weight:700; }
  .src-b { font-size:14px; margin-top:2px; }
  .who { background:#f4f4f6; border-radius:12px; padding:12px 14px; margin:14px 0; }
  .who-t { font-size:13px; font-weight:600; } .who-b { font-size:13px; color:#60646c; margin-top:4px; line-height:1.5; }
  .sec { margin-top:16px; } .sec-t { font-size:15px; font-weight:600; margin-bottom:8px; }
  .row { display:flex; gap:10px; font-size:13px; color:#60646c; line-height:1.5; margin-bottom:7px; }
  .mk { width:15px; text-align:center; flex:0 0 15px; } .m-good{color:#188038;} .m-bad{color:#d93025;} .m-dot{color:#9095a0;}
  .play { border:1.5px solid #208aef; border-radius:12px; padding:12px 14px; margin-top:18px; }
  .play-t { color:#208aef; font-weight:600; font-size:13px; margin-bottom:4px; }
  .play div:last-child { font-size:13px; line-height:1.6; }
  .btn { display:block; text-align:center; font-weight:600; font-size:14px; padding:13px; border-radius:12px; margin-top:12px; text-decoration:none; border:none; width:100%; cursor:pointer; }
  .btn.ghost { background:#fff; color:#208aef; border:1px solid #cfe0f5; }
  .btn.primary { background:#208aef; color:#fff; }
  .banner { background:#eaf3ff; border:1px solid #cfe0f5; color:#0c447c; font-size:13px; padding:10px 14px; border-radius:12px; margin-bottom:14px; display:none; }
  .banner.on { display:block; }
  .progress-card { background:#111; color:#fff; border-radius:16px; padding:16px; margin-bottom:16px; }
  .pc-level { font-size:13px; opacity:.75; }
  .pc-name { font-size:22px; font-weight:600; margin:2px 0 12px; }
  .pc-bar { height:8px; background:rgba(255,255,255,.18); border-radius:999px; overflow:hidden; }
  .pc-fill { height:100%; background:#4da3ff; width:0%; transition:width .3s; }
  .pc-xp { font-size:12px; opacity:.75; margin-top:8px; }
  .level { margin-bottom:8px; }
  .level-h { display:flex; align-items:center; gap:8px; margin:18px 0 10px; }
  .lv-num { width:24px; height:24px; border-radius:50%; background:#d0d2d8; color:#fff; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; }
  .level.unlocked .lv-num { background:#208aef; }
  .level.done .lv-num { background:#188038; }
  .lv-name { font-size:16px; font-weight:600; }
  .lv-title { font-size:13px; color:#9095a0; }
  .lv-lock { margin-left:auto; font-size:13px; }
  .level.unlocked .lv-lock, .level.done .lv-lock { display:none; }
  .ms { display:flex; gap:12px; align-items:flex-start; background:#fff; border-radius:14px; padding:14px; margin-bottom:10px; box-shadow:0 1px 2px rgba(0,0,0,0.05); }
  .ms-check { width:22px; height:22px; border-radius:50%; border:2px solid #d0d2d8; flex:0 0 22px; margin-top:1px; position:relative; }
  .ms.done .ms-check { background:#188038; border-color:#188038; }
  .ms.done .ms-check:after { content:'\\2713'; color:#fff; font-size:13px; position:absolute; left:4px; top:-1px; }
  .ms-main { flex:1; }
  .ms-title { font-size:15px; font-weight:600; }
  .ms.done .ms-title { color:#9095a0; text-decoration:line-through; }
  .ms-detail { font-size:13px; color:#60646c; margin-top:2px; line-height:1.45; }
  .ms-action { margin-top:8px; }
  .ms.done .ms-action { display:none; }
  .mini-btn { border:1px solid #208aef; background:#fff; color:#208aef; font-size:13px; font-weight:600; padding:7px 12px; border-radius:9px; cursor:pointer; }
  .inline-form { display:flex; gap:8px; }
  .name-in { flex:1; border:1px solid #d0d2d8; border-radius:9px; padding:7px 10px; font-size:13px; }
  .ms-where { font-size:10px; font-weight:600; padding:3px 8px; border-radius:999px; white-space:nowrap; }
  .ms-where.inapp { background:#eaf3ff; color:#0c447c; }
  .ms-where.out { background:#f1efe8; color:#5f5e5a; }
  .level.locked { opacity:.5; }
  .level.locked .ms-action { display:none; }
  .you-row { background:#fff; border-radius:14px; padding:14px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; }
  .you-k { font-size:13px; color:#60646c; } .you-v { font-size:15px; font-weight:600; }
  .reset { background:none; border:none; color:#d93025; font-size:13px; margin-top:10px; cursor:pointer; }
  .tabbar { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:430px; background:#fff; border-top:1px solid #e0e1e6; display:flex; height:64px; z-index:20; }
  .tab { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; cursor:pointer; color:#9095a0; font-size:11px; }
  .tab.on { color:#208aef; }
  .tab .ic { font-size:20px; line-height:1; }
  .tab .dot { position:absolute; margin-left:16px; margin-top:-14px; width:8px; height:8px; background:#d93025; border-radius:50%; display:none; }
  .tab.hasnew .dot { display:block; }
  .toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#111; color:#fff; font-size:13px; font-weight:600; padding:10px 16px; border-radius:999px; opacity:0; transition:opacity .25s; z-index:30; }
  .toast.show { opacity:1; }
  .empty { color:#60646c; font-size:14px; text-align:center; padding:30px 0; display:none; }
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
    ${domains.map((d) => `<div class="dom" data-dom="${attr(d)}">${niches.filter((n) => n.domain === d).map(nicheCard).join('')}</div>`).join('')}
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
    document.querySelectorAll('#s-discover .niche').forEach(function(c){
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

  function matchGrow(){
    var banner = document.getElementById('grow-banner');
    if(!S.niche){ banner.classList.remove('on'); return; }
    var want = (S.niche.tags||'').toLowerCase().split(',').map(function(t){return t.trim();}).filter(Boolean);
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

  matchGrow();
  refresh();
  if(S.tab){ setTab(S.tab); }
</script>
</body></html>`;
}

createServer((req, res) => {
  try {
    const niches = JSON.parse(readFileSync(`${dir}/niches.json`, 'utf8'));
    const communities = JSON.parse(readFileSync(`${dir}/communities.json`, 'utf8'));
    const missions = JSON.parse(readFileSync(`${dir}/missions.json`, 'utf8'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(niches, communities, missions));
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Could not render: ${err.message}`);
  }
}).listen(PORT, () => {
  console.log(`Sales Mechanic base app: http://localhost:${PORT}`);
  console.log('Discover + Grow + Journey in one shell. Ctrl+C to stop.');
});
