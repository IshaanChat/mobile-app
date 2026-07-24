/**
 * Niche & product explorer — the base version of Discover, rendered as the
 * app's mobile accordion cards (same pattern as growth:preview).
 *
 *   npm run niches:preview                      (serves content/niches.json)
 *   npm run niches:preview -- content/other.json
 *
 * Collapsed: image hero + niche + product teaser. Tap a card to expand the
 * full write-up (blurb, economics, sourcing link) in place. Filter by
 * audience or search. Re-reads the JSON on every request — edit the file,
 * refresh the browser. Preview only; nothing touches the database or app.
 */

import { readFileSync } from 'fs';
import { createServer } from 'http';

const PORT = Number(process.env.PREVIEW_PORT ?? 4200);
const file = process.argv.slice(2).find((a) => !a.startsWith('-')) ?? 'content/niches.json';

const SOURCING_LABELS: Record<string, string> = {
  DROPSHIP: 'Dropship',
  WHOLESALE: 'Wholesale',
  PRINT_ON_DEMAND: 'Print on demand',
  MATERIALS: 'Materials',
  MAKE_YOUR_OWN: 'Make your own',
};
const AUDIENCE_LABELS: Record<string, string> = {
  maker: 'Maker', reseller: 'Reseller', both: 'Maker + reseller',
};
const AUDIENCE_COLORS: Record<string, string> = {
  maker: '#188038', reseller: '#8a4ddb', both: '#208aef',
};

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function card(n: any, i: number) {
  const p = n.product ?? {};
  const aud = AUDIENCE_COLORS[n.audience] ?? '#60646c';
  return `<div class="card" data-i="${i}" data-aud="${esc(n.audience)}" data-text="${esc((n.name + ' ' + n.domain + ' ' + (p.title ?? '') + ' ' + n.tags).toLowerCase())}">
    <div class="head" onclick="toggle(${i})">
      <div class="hero" style="background-image:url('${esc(n.imageUrl ?? '')}')">
        <div class="chips">
          <span class="chip" style="background:${aud}">${esc(AUDIENCE_LABELS[n.audience] ?? n.audience)}</span>
          <span class="chip chip-dark">${esc(SOURCING_LABELS[p.sourcingType] ?? p.sourcingType ?? '')}</span>
        </div>
      </div>
      <div class="body">
        <div class="titlerow">
          <div>
            <div class="domain">${esc(n.domain)}</div>
            <div class="title">${esc(n.name)}</div>
            <div class="tagline">${esc(p.title ?? '')}</div>
          </div>
          <div class="chev">&#9660;</div>
        </div>
      </div>
    </div>
    <div class="expand">
      <p class="blurb">${esc(p.blurb ?? '')}</p>
      <div class="econ">
        <div class="econ-t">The math</div>
        <div class="econ-row">
          <span class="cost">${esc(p.sourceCost ?? '')}</span>
          <span class="arrow">&rarr;</span>
          <span class="resale">${esc(p.typicalResale ?? '')}</span>
        </div>
      </div>
      <div class="srcbox">
        <div class="src-t">Where to source</div>
        <div class="src-b">${esc(p.sourceName ?? '')} &middot; ${esc(SOURCING_LABELS[p.sourcingType] ?? '')}</div>
      </div>
      <a class="source" href="${esc(p.sourcingUrl ?? '#')}" target="_blank" rel="noreferrer">Source it &#8599;</a>
      ${n.imageCredit ? `<div class="credit">Photo: ${esc(n.imageCredit)}</div>` : ''}
    </div>
  </div>`;
}

function page(niches: any[]) {
  const domains = [...new Set(niches.map((n) => n.domain))];
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Niche &amp; product explorer</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; background:#f4f4f6; color:#111; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:440px; margin:0 auto; padding:16px; }
  .bar { position:sticky; top:0; background:#f4f4f6; padding:12px 0 10px; z-index:5; }
  .bar h1 { font-size:22px; margin:0; }
  .bar .sub { color:#60646c; font-size:13px; margin:2px 0 10px; }
  .bar input { width:100%; border:1px solid #d0d2d8; border-radius:12px; padding:10px 14px; font-size:14px; margin-bottom:8px; }
  .filters { display:flex; gap:8px; overflow-x:auto; }
  .chipbtn { border:1px solid #d0d2d8; background:#fff; border-radius:999px; padding:7px 14px; font-size:13px; cursor:pointer; white-space:nowrap; }
  .chipbtn.on { background:#111; color:#fff; border-color:#111; }
  .domain-h { font-size:16px; font-weight:600; margin:20px 0 10px; }
  .card { background:#fff; border-radius:16px; overflow:hidden; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
  .head { cursor:pointer; }
  .hero { height:180px; background-size:cover; background-position:center; position:relative; }
  .chips { position:absolute; left:14px; bottom:14px; display:flex; gap:8px; }
  .chip { color:#fff; font-size:12px; font-weight:600; padding:4px 10px; border-radius:999px; }
  .chip-dark { background:rgba(0,0,0,0.55); font-weight:500; }
  .body { padding:14px 16px; }
  .titlerow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .domain { color:#9095a0; font-size:11px; text-transform:uppercase; letter-spacing:0.4px; }
  .title { font-size:18px; font-weight:600; margin-top:2px; }
  .tagline { color:#60646c; font-size:14px; margin-top:3px; line-height:1.4; }
  .chev { color:#9095a0; font-size:12px; padding-top:4px; transition:transform 0.15s; }
  .card.open .chev { transform:rotate(180deg); }
  .expand { display:none; padding:0 16px 18px; }
  .card.open .expand { display:block; }
  .blurb { font-size:14px; line-height:1.6; margin:4px 0 0; }
  .econ { background:#f4f4f6; border-radius:12px; padding:12px 14px; margin-top:14px; }
  .econ-t { font-size:13px; font-weight:600; margin-bottom:4px; }
  .econ-row { font-size:15px; font-variant:tabular-nums; }
  .cost { color:#60646c; }
  .arrow { color:#9095a0; margin:0 8px; }
  .resale { color:#188038; font-weight:700; }
  .srcbox { border:1.5px solid #208aef; border-radius:12px; padding:12px 14px; margin-top:12px; }
  .src-t { color:#208aef; font-size:13px; font-weight:600; }
  .src-b { font-size:14px; margin-top:3px; }
  .source { display:block; text-align:center; background:#208aef; color:#fff; font-weight:600; font-size:14px; padding:14px; border-radius:12px; margin-top:12px; text-decoration:none; }
  .credit { color:#b0b3ba; font-size:10px; margin-top:10px; text-align:center; }
  .empty { color:#60646c; font-size:14px; padding:40px 0; text-align:center; display:none; }
</style></head><body>
<div class="wrap">
  <div class="bar">
    <h1>Discover &mdash; base</h1>
    <div class="sub">${niches.length} niches &middot; tap a card for the full picture</div>
    <input id="q" placeholder="Search niches, products, tags…" oninput="apply()">
    <div class="filters">
      <button class="chipbtn on" data-f="all" onclick="setF(this)">All</button>
      <button class="chipbtn" data-f="maker" onclick="setF(this)">Maker</button>
      <button class="chipbtn" data-f="reseller" onclick="setF(this)">Reseller</button>
      <button class="chipbtn" data-f="both" onclick="setF(this)">Both</button>
    </div>
  </div>
  ${domains.map((d) => `
    <section class="domain-sec">
      <div class="domain-h">${esc(d)}</div>
      ${niches.map((n, i) => ({ n, i })).filter(({ n }) => n.domain === d).map(({ n, i }) => card(n, i)).join('')}
    </section>`).join('')}
  <div class="empty" id="empty">Nothing matches — clear the search or filter.</div>
</div>
<script>
  var f = 'all';
  function toggle(i){ document.querySelector('.card[data-i="'+i+'"]').classList.toggle('open'); }
  function setF(btn){
    f = btn.dataset.f;
    document.querySelectorAll('.chipbtn').forEach(function(b){ b.classList.toggle('on', b===btn); });
    apply();
  }
  function apply(){
    var q = document.getElementById('q').value.toLowerCase().trim();
    var any = false;
    document.querySelectorAll('.card').forEach(function(c){
      var okF = (f==='all') || (c.dataset.aud===f) || (f!=='both' && c.dataset.aud==='both');
      var okQ = !q || c.dataset.text.indexOf(q) !== -1;
      var show = okF && okQ;
      c.style.display = show ? '' : 'none';
      if(show) any = true;
    });
    document.querySelectorAll('.domain-sec').forEach(function(s){
      var visible = s.querySelectorAll('.card:not([style*="none"])').length > 0;
      s.style.display = visible ? '' : 'none';
    });
    document.getElementById('empty').style.display = any ? 'none' : 'block';
  }
</script>
</body></html>`;
}

createServer((req, res) => {
  try {
    const niches = JSON.parse(readFileSync(file, 'utf8'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(niches));
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Could not render ${file}: ${err.message}`);
  }
}).listen(PORT, () => {
  console.log(`Niche & product explorer: http://localhost:${PORT}`);
  console.log(`Rendering ${file} — edit it and refresh to see changes. Ctrl+C to stop.`);
});
