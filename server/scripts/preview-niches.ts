/**
 * Niche & product explorer — the curator/base version of Discover.
 *
 *   npm run niches:preview                      (serves content/niches.json)
 *   npm run niches:preview -- content/other.json
 *
 * A local page for browsing every niche: image, audience, and one starter
 * product with cost → resale and a real sourcing link. Filter by audience
 * (maker / reseller / both) or search. Re-reads the JSON on every request —
 * edit the file, refresh the browser. Preview only; nothing touches the
 * database or the app.
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

function card(n: any) {
  const p = n.product ?? {};
  const aud = AUDIENCE_COLORS[n.audience] ?? '#60646c';
  return `<div class="card" data-aud="${esc(n.audience)}" data-text="${esc((n.name + ' ' + n.domain + ' ' + (p.title ?? '') + ' ' + n.tags).toLowerCase())}">
    <div class="hero" style="background-image:url('${esc(n.imageUrl ?? '')}')">
      <span class="aud" style="background:${aud}">${esc(AUDIENCE_LABELS[n.audience] ?? n.audience)}</span>
    </div>
    <div class="body">
      <div class="domain">${esc(n.domain)}</div>
      <div class="name">${esc(n.name)}</div>
      <div class="product">
        <div class="p-head">
          <span class="p-kind">${esc(SOURCING_LABELS[p.sourcingType] ?? p.sourcingType ?? '')}</span>
        </div>
        <div class="p-title">${esc(p.title ?? '')}</div>
        <div class="p-blurb">${esc(p.blurb ?? '')}</div>
        <div class="p-econ">
          <span class="cost">${esc(p.sourceCost ?? '')}</span>
          <span class="arrow">&rarr;</span>
          <span class="resale">${esc(p.typicalResale ?? '')}</span>
        </div>
        <a class="source" href="${esc(p.sourcingUrl ?? '#')}" target="_blank" rel="noreferrer">Source it on ${esc(p.sourceName ?? 'the web')} &#8599;</a>
      </div>
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
  .wrap { max-width:960px; margin:0 auto; padding:16px; }
  h1 { font-size:24px; margin:8px 0 2px; }
  .sub { color:#60646c; font-size:13px; margin-bottom:14px; }
  .controls { position:sticky; top:0; background:#f4f4f6; padding:10px 0; z-index:5; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .controls input { flex:1; min-width:180px; border:1px solid #d0d2d8; border-radius:10px; padding:9px 12px; font-size:14px; }
  .chipbtn { border:1px solid #d0d2d8; background:#fff; border-radius:999px; padding:7px 14px; font-size:13px; cursor:pointer; }
  .chipbtn.on { background:#111; color:#fff; border-color:#111; }
  h2.domain-h { font-size:17px; margin:22px 0 10px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
  .card { background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06); display:flex; flex-direction:column; }
  .hero { height:140px; background-size:cover; background-position:center; position:relative; }
  .aud { position:absolute; left:12px; bottom:12px; color:#fff; font-size:11px; font-weight:600; padding:4px 10px; border-radius:999px; }
  .body { padding:12px 14px 14px; display:flex; flex-direction:column; flex:1; }
  .domain { color:#9095a0; font-size:11px; text-transform:uppercase; letter-spacing:0.4px; }
  .name { font-size:17px; font-weight:600; margin:2px 0 10px; }
  .product { background:#f7f7f9; border-radius:12px; padding:12px; flex:1; display:flex; flex-direction:column; }
  .p-kind { color:#60646c; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.4px; }
  .p-title { font-size:14px; font-weight:600; margin:5px 0 4px; }
  .p-blurb { font-size:13px; color:#60646c; line-height:1.5; flex:1; }
  .p-econ { margin:10px 0 8px; font-size:13px; font-variant:tabular-nums; }
  .cost { color:#60646c; }
  .arrow { color:#9095a0; margin:0 6px; }
  .resale { color:#188038; font-weight:600; }
  .source { display:block; text-align:center; background:#208aef; color:#fff; font-weight:600; font-size:13px; padding:10px; border-radius:10px; text-decoration:none; }
  .credit { color:#b0b3ba; font-size:10px; margin-top:8px; text-align:right; }
  .empty { color:#60646c; font-size:14px; padding:40px 0; text-align:center; display:none; }
</style></head><body>
<div class="wrap">
  <h1>Niche &amp; product explorer</h1>
  <div class="sub">${niches.length} niches &middot; ${domains.length} categories &middot; from ${esc(file)} &middot; base version, not the live app</div>
  <div class="controls">
    <input id="q" placeholder="Search niches, products, tags…" oninput="apply()">
    <button class="chipbtn on" data-f="all" onclick="setF(this)">All</button>
    <button class="chipbtn" data-f="maker" onclick="setF(this)">Maker</button>
    <button class="chipbtn" data-f="reseller" onclick="setF(this)">Reseller</button>
    <button class="chipbtn" data-f="both" onclick="setF(this)">Both</button>
  </div>
  ${domains.map((d) => `
    <section class="domain-sec">
      <h2 class="domain-h">${esc(d)}</h2>
      <div class="grid">${niches.filter((n) => n.domain === d).map(card).join('')}</div>
    </section>`).join('')}
  <div class="empty" id="empty">Nothing matches — clear the search or filter.</div>
</div>
<script>
  var f = 'all';
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
