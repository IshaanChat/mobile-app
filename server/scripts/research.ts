/**
 * Product research bench — capture what's actually working, then find the source.
 *
 *   npm run research        (serves http://localhost:4400)
 *
 * The workflow this supports:
 *   1. Browse TikTok Creative Center's Top Ads (or Meta's Ad Library) for ads
 *      running in your categories. A long-running ad is the strongest signal
 *      there is — someone is paying for it daily and hasn't stopped.
 *   2. Note the advertiser, how long it's been live, and the engagement.
 *   3. Find the same product on AliExpress / Alibaba and grab the unit cost.
 *   4. Paste it all in here. It writes a proper product entry, with its
 *      research record, into the right content/products/ file.
 *
 * Nothing is scraped. Those sites' terms forbid automated collection and
 * their anti-bot would break it anyway — this tool assumes you looked with
 * your own eyes, and just makes recording it fast.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { createServer } from 'http';

const PORT = Number(process.env.RESEARCH_PORT ?? 4400);
const DIR = 'content';

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s: any) => esc(s).replace(/"/g, '&quot;');
const slugify = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 52);

const fileForDomain = (d: string) =>
  d.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/--+/g, '-');

function loadNiches(): any[] {
  return JSON.parse(readFileSync(`${DIR}/niches.json`, 'utf8'));
}
function loadProducts(): any[] {
  return readdirSync(`${DIR}/products`)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(`${DIR}/products/${f}`, 'utf8')).map((p: any) => ({ ...p, _file: f })));
}

const DAY = 86400000;
function daysRunning(r: any): number | null {
  if (!r?.firstSeen) return null;
  const end = r.lastSeen ? new Date(r.lastSeen) : new Date();
  const d = Math.round((end.getTime() - new Date(r.firstSeen).getTime()) / DAY);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

function addProduct(body: any) {
  const niches = loadNiches();
  const niche = niches.find((n) => n.slug === body.nicheSlug);
  if (!niche) throw new Error('Unknown niche: ' + body.nicheSlug);
  if (!body.title?.trim()) throw new Error('The product needs a title');

  const file = `${DIR}/products/${fileForDomain(niche.domain)}.json`;
  const list = JSON.parse(readFileSync(file, 'utf8'));
  const slug = slugify(body.title);
  if (list.some((p: any) => p.slug === slug)) throw new Error('Already have a product with that slug: ' + slug);

  const suppliers = [];
  if (body.supplierUrl?.trim()) {
    suppliers.push({
      supplier: body.supplierName?.trim() || 'AliExpress',
      url: body.supplierUrl.trim(),
      unitCost: body.unitCost?.trim() || '',
      moq: body.moq?.trim() || '',
      shipDays: body.shipDays?.trim() || '',
    });
  }

  const entry: any = {
    slug,
    nicheSlug: body.nicheSlug,
    title: body.title.trim(),
    blurb: body.blurb?.trim() || '',
    sourcingType: body.sourcingType || 'DROPSHIP',
    sourceName: suppliers[0]?.supplier || 'AliExpress',
    sourcingUrl: suppliers[0]?.url || '',
    sourceCost: body.unitCost?.trim() || '',
    typicalResale: body.resale?.trim() || '',
    hotness: Number(body.hotness) || 60,
    imageQuery: body.imageQuery?.trim() || body.title.trim(),
    research: {
      adPlatform: body.adPlatform || 'TikTok',
      adUrl: body.adUrl?.trim() || '',
      advertiser: body.advertiser?.trim() || '',
      storeUrl: body.storeUrl?.trim() || '',
      firstSeen: body.firstSeen || '',
      lastSeen: body.lastSeen || '',
      adCount: Number(body.adCount) || 0,
      engagement: body.engagement?.trim() || '',
      saturation: body.saturation || 'medium',
      trend: body.trend || 'rising',
      sourceCandidates: suppliers,
      checkedAt: new Date().toISOString().slice(0, 10),
      notes: body.notes?.trim() || '',
    },
  };

  list.push(entry);
  writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
  return { slug, file, days: daysRunning(entry.research) };
}

function page() {
  const niches = loadNiches();
  const products = loadProducts();
  const researched = products.filter((p) => p.research?.firstSeen || p.research?.adUrl);
  researched.sort((a, b) => (daysRunning(b.research) ?? 0) - (daysRunning(a.research) ?? 0));
  const byDomain: Record<string, any[]> = {};
  for (const n of niches) (byDomain[n.domain] = byDomain[n.domain] || []).push(n);

  const today = new Date().toISOString().slice(0, 10);

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Research bench</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#fbf4f0; --panel:#fff; --bd:#eedbd4; --in:#f8ede8; --tx:#34262b; --dim:#98818a; --ac:#c2647e; --ok:#5f9b7a; --hot:#cf8f2e; --bad:#cc4f4f; }
  @media (prefers-color-scheme:dark){ :root{ --bg:#0b0c0f; --panel:#14161b; --bd:#262a33; --in:#0b0c0f; --tx:#edeef2; --dim:#8b92a0; --ac:#e3a82b; --ok:#34c477; --hot:#5b9cf0; } }
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--tx);font-family:'Plus Jakarta Sans',-apple-system,sans-serif;}
  .wrap{max-width:940px;margin:0 auto;padding:22px 18px 60px}
  h1{font-size:24px;margin:0 0 4px} .sub{color:var(--dim);font-size:14px;margin-bottom:20px;line-height:1.55}
  .cols{display:grid;grid-template-columns:1fr;gap:20px} @media(min-width:820px){.cols{grid-template-columns:minmax(0,420px) minmax(0,1fr)}}
  .card{background:var(--panel);border:1px solid var(--bd);border-radius:16px;padding:18px}
  h2{font-size:16px;margin:0 0 14px}
  .f{display:flex;flex-direction:column;gap:4px;margin-bottom:11px}
  .f label{font-size:12px;font-weight:600;color:var(--dim)}
  .f input,.f select,.f textarea{background:var(--in);border:1px solid var(--bd);color:var(--tx);border-radius:9px;padding:8px 11px;font-size:13px;font-family:inherit;width:100%}
  .f input:focus,.f select:focus,.f textarea:focus{outline:none;border-color:var(--ac)}
  .f textarea{min-height:56px;resize:vertical}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 10px}
  .sec{border-top:1px solid var(--bd);margin:16px 0 12px;padding-top:14px;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--ac)}
  button.go{background:var(--ac);color:#fff;border:none;border-radius:999px;padding:12px;font-size:14px;font-weight:700;width:100%;cursor:pointer;font-family:inherit}
  .msg{margin-top:10px;font-size:13px;font-weight:600}
  .msg.ok{color:var(--ok)} .msg.err{color:var(--bad)}
  .item{border:1px solid var(--bd);border-radius:12px;padding:12px 14px;margin-bottom:10px;background:var(--panel)}
  .item-h{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
  .item-t{font-weight:600;font-size:14px}
  .days{font-size:13px;font-weight:700;color:var(--hot);white-space:nowrap;font-variant-numeric:tabular-nums}
  .item-m{font-size:12px;color:var(--dim);margin-top:3px;line-height:1.5}
  .item-m a{color:var(--ac);text-decoration:none;font-weight:600}
  .tips{font-size:13px;color:var(--dim);line-height:1.6}
  .tips li{margin-bottom:6px}
  .tips a{color:var(--ac)}
  .empty{color:var(--dim);font-size:13px;line-height:1.6}
</style></head><body><div class="wrap">
<h1>Research bench</h1>
<div class="sub">Find ads that are still running, then find the source. Long-running ads are the signal &mdash; nobody keeps paying for one that loses money.</div>

<div class="cols">
  <div>
    <div class="card">
      <h2>Log a find</h2>
      <div class="f"><label>Product title</label><input id="title" placeholder="Self-watering globe planters"></div>
      <div class="f"><label>Category</label><select id="nicheSlug">
        ${Object.entries(byDomain).map(([d, list]) => `<optgroup label="${attr(d)}">${
          (list as any[]).map((n) => `<option value="${attr(n.slug)}">${esc(n.name)}</option>`).join('')
        }</optgroup>`).join('')}
      </select></div>
      <div class="f"><label>Your own description</label><textarea id="blurb" placeholder="Why this works, in your words — never copy theirs."></textarea></div>

      <div class="sec">The ad</div>
      <div class="row">
        <div class="f"><label>Platform</label><select id="adPlatform"><option>TikTok</option><option>Meta</option><option>YouTube</option><option>Pinterest</option></select></div>
        <div class="f"><label>Advertiser / store</label><input id="advertiser" placeholder="shop name"></div>
      </div>
      <div class="row">
        <div class="f"><label>First seen</label><input id="firstSeen" type="date"></div>
        <div class="f"><label>Last seen</label><input id="lastSeen" type="date" value="${today}"></div>
      </div>
      <div class="row">
        <div class="f"><label>Creatives running</label><input id="adCount" inputmode="numeric" placeholder="12"></div>
        <div class="f"><label>Engagement</label><input id="engagement" placeholder="3.2M views · 48k likes"></div>
      </div>
      <div class="f"><label>Link to the ad</label><input id="adUrl" placeholder="https://ads.tiktok.com/business/creativecenter/..."></div>
      <div class="f"><label>Their store</label><input id="storeUrl" placeholder="https://..."></div>
      <div class="row">
        <div class="f"><label>Saturation</label><select id="saturation"><option value="low">low — few sellers</option><option value="medium" selected>medium</option><option value="high">high — crowded</option></select></div>
        <div class="f"><label>Trend</label><select id="trend"><option value="rising" selected>rising</option><option value="steady">steady</option><option value="fading">fading</option></select></div>
      </div>

      <div class="sec">The source</div>
      <div class="row">
        <div class="f"><label>Supplier</label><input id="supplierName" value="AliExpress"></div>
        <div class="f"><label>Unit cost</label><input id="unitCost" placeholder="$4.20"></div>
      </div>
      <div class="f"><label>Supplier link</label><input id="supplierUrl" placeholder="https://www.aliexpress.com/item/..."></div>
      <div class="row3">
        <div class="f"><label>MOQ</label><input id="moq" placeholder="1"></div>
        <div class="f"><label>Ship days</label><input id="shipDays" placeholder="12–20"></div>
        <div class="f"><label>Sells for</label><input id="resale" placeholder="$24–38"></div>
      </div>
      <div class="row">
        <div class="f"><label>Sourcing type</label><select id="sourcingType">
          <option value="DROPSHIP">Dropship</option><option value="WHOLESALE">Wholesale</option>
          <option value="PRINT_ON_DEMAND">Print on demand</option><option value="MATERIALS">Materials</option>
          <option value="MAKE_YOUR_OWN">Make your own</option></select></div>
        <div class="f"><label>Hotness 0–100</label><input id="hotness" inputmode="numeric" value="70"></div>
      </div>
      <div class="f"><label>Image search words</label><input id="imageQuery" placeholder="self watering planter globe"></div>
      <div class="f"><label>Notes</label><textarea id="notes" placeholder="Anything worth remembering"></textarea></div>

      <button class="go" onclick="submit()">Add to the database</button>
      <div class="msg" id="msg"></div>
    </div>

    <div class="card" style="margin-top:16px">
      <h2>How to find them</h2>
      <ul class="tips">
        <li><a href="https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en" target="_blank" rel="noreferrer">TikTok Creative Center &rarr; Top Ads</a> — filter by region and industry, sort by how long they've run.</li>
        <li><a href="https://www.facebook.com/ads/library/" target="_blank" rel="noreferrer">Meta Ad Library</a> — search a store name, every live ad shows its start date.</li>
        <li>An ad live <strong>30+ days</strong> is profitable. Under a week tells you nothing yet.</li>
        <li>Several creatives for one product means real budget behind it.</li>
        <li>Then search the product on <a href="https://www.aliexpress.com/" target="_blank" rel="noreferrer">AliExpress</a> by image to find the unit cost.</li>
        <li>Write your own description. Never paste theirs — that's their copyright.</li>
      </ul>
    </div>
  </div>

  <div class="card">
    <h2>Researched products (${researched.length})</h2>
    ${researched.length === 0
      ? `<div class="empty">Nothing logged yet. Every product in the database has a hand-written case for it, but none has ad evidence behind it &mdash; that is what this bench is for.</div>`
      : researched.map((p) => {
          const r = p.research, d = daysRunning(r);
          return `<div class="item">
            <div class="item-h"><span class="item-t">${esc(p.title)}</span>${d !== null ? `<span class="days">${d}d live</span>` : ''}</div>
            <div class="item-m">${[esc(r.adPlatform), r.advertiser ? esc(r.advertiser) : '', r.engagement ? esc(r.engagement) : '', r.saturation ? esc(r.saturation) + ' saturation' : ''].filter(Boolean).join(' · ')}</div>
            <div class="item-m">${esc(p.sourceCost || '?')} &rarr; ${esc(p.typicalResale || '?')}${
              r.adUrl ? ` · <a href="${attr(r.adUrl)}" target="_blank" rel="noreferrer">ad ↗</a>` : ''
            }${r.sourceCandidates?.[0]?.url ? ` · <a href="${attr(r.sourceCandidates[0].url)}" target="_blank" rel="noreferrer">source ↗</a>` : ''}</div>
          </div>`;
        }).join('')}
  </div>
</div>

<script>
  var FIELDS = ['title','nicheSlug','blurb','adPlatform','advertiser','firstSeen','lastSeen','adCount','engagement',
    'adUrl','storeUrl','saturation','trend','supplierName','unitCost','supplierUrl','moq','shipDays','resale',
    'sourcingType','hotness','imageQuery','notes'];
  function submit(){
    var body = {};
    FIELDS.forEach(function(f){ var el = document.getElementById(f); if(el) body[f] = el.value; });
    var msg = document.getElementById('msg');
    msg.className = 'msg'; msg.textContent = 'Saving…';
    fetch('/add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(j.error){ msg.className='msg err'; msg.textContent = j.error; return; }
        msg.className='msg ok';
        msg.textContent = 'Added ' + j.slug + ' to ' + j.file + (j.days!=null ? ' · ' + j.days + ' days live' : '');
        setTimeout(function(){ location.reload(); }, 900);
      })
      .catch(function(e){ msg.className='msg err'; msg.textContent = String(e); });
  }
</script>
</div></body></html>`;
}

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/add') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      try {
        res.end(JSON.stringify(addProduct(JSON.parse(raw))));
      } catch (err: any) {
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  try {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page());
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Could not render: ' + err.message);
  }
}).listen(PORT, () => {
  console.log(`Research bench: http://localhost:${PORT}`);
  console.log('Log ads you found running, and where to source the product. Ctrl+C to stop.');
});
