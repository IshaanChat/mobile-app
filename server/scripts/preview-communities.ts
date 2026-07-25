/**
 * Curator preview tool for the Growth library.
 *
 *   npm run growth:preview                         (previews content/communities.json)
 *   npm run growth:preview -- content/other.json
 *
 * Serves a local page that renders every community as the app's accordion
 * card — real images, real copy — so you can review your curation before
 * importing. It re-reads the JSON on every request, so the loop is: edit
 * the file, refresh the browser, repeat. This is a preview only; nothing
 * here touches the database (that's `growth:import`).
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { createServer } from 'http';

const PORT = Number(process.env.PREVIEW_PORT ?? 4100);
// Accepts either a single JSON file or the content/communities folder.
const file = process.argv.slice(2).find((a) => !a.startsWith('-')) ?? 'content/communities';

function loadPosts(): any[] {
  if (statSync(file).isDirectory()) {
    return readdirSync(file)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(`${file}/${f}`, 'utf8')));
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const PLATFORM_COLORS: Record<string, string> = {
  reddit: '#FF4500', instagram: '#C13584', tiktok: '#0F0F0F', x: '#1D1D1F',
  youtube: '#CC0000', etsy: '#F1641E', pinterest: '#E60023', facebook: '#1877F2',
  discord: '#5865F2', forum: '#5A67D8',
};
const KIND_LABELS: Record<string, string> = {
  community: 'Community', hashtag: 'Hashtag', marketplace: 'Marketplace',
  search: 'Search recipe', event: 'Event',
};

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lines = (s: string) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const color = (p: string) => PLATFORM_COLORS[p?.toLowerCase()] ?? '#5A67D8';

function bulletRows(text: string, mark: string, cls: string) {
  return lines(text)
    .map((li) => `<div class="row"><span class="mark ${cls}">${mark}</span><span>${esc(li)}</span></div>`)
    .join('');
}

function card(p: any, i: number) {
  const members = typeof p.memberCount === 'number' && p.memberCount > 0
    ? (p.memberCount >= 1000 ? `${Math.round(p.memberCount / 1000)}k members` : `${p.memberCount} members`)
    : '';
  const hero = p.imageUrl
    ? `<div class="hero" style="background-image:url('${esc(p.imageUrl)}')">
         <div class="chips">
           <span class="chip" style="background:${color(p.platform)}">${esc(p.platform)}</span>
           <span class="chip chip-dark">${esc(KIND_LABELS[p.kind] ?? p.kind)}</span>
         </div></div>`
    : `<div class="hero hero-solid" style="background:${color(p.platform)}">
         <div class="chips">
           <span class="chip chip-glass">${esc(p.platform)}</span>
           <span class="chip chip-glass">${esc(KIND_LABELS[p.kind] ?? p.kind)}</span>
         </div></div>`;

  const overview = String(p.overview ?? '').split(/\n\s*\n/).map((para: string) =>
    `<p>${esc(para.trim())}</p>`).join('');

  return `<div class="card" data-i="${i}">
    <div class="head" onclick="toggle(${i})">
      ${hero}
      <div class="body">
        <div class="titlerow">
          <div>
            <div class="title">${esc(p.title)}</div>
            <div class="tagline">${esc(p.tagline)}</div>
            ${members ? `<div class="members">${esc(members)}</div>` : ''}
          </div>
          <div class="chev" id="chev-${i}">&#9660;</div>
        </div>
        <div class="meta">${esc(p.slug)} &middot; hotness ${esc(String(p.hotness ?? 50))}${p.imageQuery ? ` &middot; img: “${esc(p.imageQuery)}”` : ''}</div>
      </div>
    </div>
    <div class="expand" id="exp-${i}">
      ${overview}
      <div class="who"><div class="who-t">Who you’ll find here</div><div class="who-b">${esc(p.audience)}</div></div>
      <div class="sec"><div class="sec-t">What they talk about</div>${bulletRows(p.discussions, '&bull;', 'm-dot')}</div>
      <div class="sec"><div class="sec-t">What wins them over</div>${bulletRows(p.loves, '&check;', 'm-good')}</div>
      <div class="sec"><div class="sec-t">What turns them off</div>${bulletRows(p.dislikes, '&times;', 'm-bad')}</div>
      <div class="sec"><div class="sec-t">House rules</div>${bulletRows(p.rules, '&sect;', 'm-dot')}</div>
      <div class="play"><div class="play-t">The play</div><div>${esc(p.approach)}</div></div>
      <a class="explore" href="${esc(p.url)}" target="_blank" rel="noreferrer">Explore ${esc(p.title)} &#8599;</a>
      ${p.imageCredit ? `<div class="credit">Photo: ${esc(p.imageCredit)}</div>` : ''}
    </div>
  </div>`;
}

function page(posts: any[]) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Growth content preview</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; background:#f4f4f6; color:#111; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:440px; margin:0 auto; padding:16px; }
  .bar { position:sticky; top:0; background:#f4f4f6; padding:12px 0; z-index:5; }
  .bar h1 { font-size:22px; margin:0; }
  .bar .sub { color:#60646c; font-size:13px; margin-top:2px; }
  .bar button { margin-top:10px; border:1px solid #d0d2d8; background:#fff; border-radius:10px; padding:8px 14px; font-size:14px; cursor:pointer; }
  .card { background:#fff; border-radius:16px; overflow:hidden; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
  .head { cursor:pointer; }
  .hero { height:180px; background-size:cover; background-position:center; position:relative; }
  .hero-solid { display:flex; align-items:flex-end; }
  .chips { position:absolute; left:14px; bottom:14px; display:flex; gap:8px; }
  .chip { color:#fff; font-size:12px; font-weight:600; padding:4px 10px; border-radius:999px; }
  .chip-dark { background:rgba(0,0,0,0.55); font-weight:500; }
  .chip-glass { background:rgba(255,255,255,0.24); }
  .body { padding:14px 16px; }
  .titlerow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .title { font-size:18px; font-weight:600; }
  .tagline { color:#60646c; font-size:14px; margin-top:3px; line-height:1.4; }
  .members { color:#60646c; font-size:13px; margin-top:4px; }
  .chev { color:#9095a0; font-size:12px; padding-top:4px; }
  .meta { color:#9095a0; font-size:12px; margin-top:10px; font-variant:tabular-nums; }
  .expand { display:none; padding:0 16px 18px; }
  .card.open .expand { display:block; }
  .card.open .chev { transform:rotate(180deg); }
  .expand p { font-size:14px; line-height:1.6; color:#111; margin:12px 0 0; }
  .who { background:#f4f4f6; border-radius:12px; padding:12px 14px; margin:16px 0; }
  .who-t { font-size:14px; font-weight:600; }
  .who-b { font-size:14px; color:#60646c; margin-top:4px; line-height:1.5; }
  .sec { margin-top:18px; }
  .sec-t { font-size:16px; font-weight:600; margin-bottom:8px; }
  .row { display:flex; gap:10px; font-size:14px; color:#60646c; line-height:1.5; margin-bottom:8px; }
  .mark { width:16px; text-align:center; flex:0 0 16px; }
  .m-good { color:#188038; } .m-bad { color:#d93025; } .m-dot { color:#9095a0; }
  .play { border:1.5px solid #208aef; border-radius:12px; padding:14px; margin-top:22px; }
  .play-t { color:#208aef; font-weight:600; font-size:14px; margin-bottom:4px; }
  .play div:last-child { font-size:14px; line-height:1.6; }
  .explore { display:block; text-align:center; background:#208aef; color:#fff; font-weight:600; font-size:14px; padding:14px; border-radius:12px; margin-top:14px; text-decoration:none; }
  .credit { color:#9095a0; font-size:11px; margin-top:10px; text-align:center; }
</style></head><body>
<div class="wrap">
  <div class="bar">
    <h1>Growth &mdash; content preview</h1>
    <div class="sub">${posts.length} communities &middot; from ${esc(file)} &middot; not the live app</div>
    <button onclick="expandAll()">Expand all</button>
  </div>
  ${posts.map(card).join('')}
</div>
<script>
  var allOpen = false;
  function toggle(i){ document.querySelector('.card[data-i="'+i+'"]').classList.toggle('open'); }
  function expandAll(){ allOpen=!allOpen; document.querySelectorAll('.card').forEach(function(c){ c.classList.toggle('open', allOpen); }); }
</script>
</body></html>`;
}

createServer((req, res) => {
  try {
    const posts = loadPosts();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(posts));
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Could not render ${file}: ${err.message}`);
  }
}).listen(PORT, () => {
  console.log(`Growth content preview: http://localhost:${PORT}`);
  console.log(`Rendering ${file} — edit it and refresh to see changes. Ctrl+C to stop.`);
});
