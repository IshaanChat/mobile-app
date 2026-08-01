// Renders the legal pages to static HTML for Cloudflare Pages.
//
//   npm run legal:build
//
// These two URLs are an App Store Connect requirement, and they used to be
// served by the Express app. That app is going away, so they need somewhere
// that does not depend on anything staying running — static files in the repo,
// generated from the same markdown the app's own copy is reviewed against.
//
// Deliberately dependency-free. A markdown library for two documents would be
// more code to keep working than the subset actually used here.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'content', 'legal');
const OUT = join(process.cwd(), '..', 'docs');

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The subset of markdown these two files actually use. */
function render(md) {
  const lines = md.split('\n');
  const out = [];
  let inTable = false;
  let inQuote = false;
  let inList = false;

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const closeTable = () => { if (inTable) { out.push('</tbody></table>'); inTable = false; } };
  const closeQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false; } };

  const inline = (s) =>
    escape(s)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');

  for (const line of lines) {
    const t = line.trim();

    if (!t) { closeList(); closeQuote(); continue; }
    if (t === '---') { closeList(); closeTable(); closeQuote(); out.push('<hr>'); continue; }

    if (t.startsWith('> ')) {
      closeList();
      if (!inQuote) { out.push('<blockquote>'); inQuote = true; }
      out.push(`<p>${inline(t.slice(2))}</p>`);
      continue;
    }
    closeQuote();

    // Table separator row — skip it, but use it to know a table started.
    if (/^\|[\s|:-]+\|$/.test(t)) continue;

    if (t.startsWith('|')) {
      const cells = t.split('|').slice(1, -1).map((c) => c.trim());
      if (!inTable) {
        closeList();
        out.push('<table><thead><tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
        inTable = true;
      } else {
        out.push('<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      }
      continue;
    }
    closeTable();

    const heading = t.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (t.startsWith('- ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(t.slice(2))}</li>`);
      continue;
    }
    closeList();

    // Everything else is a paragraph. Consecutive lines join, because the
    // source is hard-wrapped at 79 columns and those breaks are not meaningful.
    const last = out[out.length - 1];
    if (last && last.startsWith('<p>') && last.endsWith('</p>')) {
      out[out.length - 1] = last.slice(0, -4) + ' ' + inline(t) + '</p>';
    } else {
      out.push(`<p>${inline(t)}</p>`);
    }
  }

  closeList(); closeTable(); closeQuote();
  return out.join('\n');
}

// The app's own palette, so the pages do not read as somebody else's site.
// Dark mode included: a policy page that blinds you at night is a small
// discourtesy that costs nothing to avoid.
const shell = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Venturo</title>
<style>
  :root {
    --bg: #fbf4f0; --panel: #fff; --text: #2b1f26; --muted: #7b6a72;
    --accent: #6e4eab; --border: #ece0da;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17131a; --panel: #1f1a23; --text: #f2ecf4; --muted: #a294ab;
      --accent: #d0b8f0; --border: #2e2733;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 20px 80px; background: var(--bg); color: var(--text);
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  main { max-width: 680px; margin: 0 auto; }
  .brand {
    display: inline-block; margin-bottom: 28px; color: var(--accent);
    font-size: 22px; font-weight: 700; text-decoration: none; letter-spacing: -0.3px;
  }
  h1 { font-size: 30px; line-height: 1.2; letter-spacing: -0.6px; margin: 0 0 6px; }
  h2 { font-size: 20px; letter-spacing: -0.3px; margin: 34px 0 10px; }
  h3 { font-size: 16px; margin: 24px 0 8px; }
  p, li { color: var(--text); }
  em { color: var(--muted); font-style: normal; }
  a { color: var(--accent); }
  hr { border: 0; border-top: 1px solid var(--border); margin: 30px 0; }
  blockquote {
    margin: 20px 0; padding: 12px 16px; background: var(--panel);
    border-left: 3px solid var(--accent); border-radius: 8px; color: var(--muted);
  }
  blockquote p { color: inherit; margin: 0; }
  ul { padding-left: 22px; }
  li { margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 18px 0; display: block; overflow-x: auto; }
  th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--border); }
  th { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--muted); font-size: 14px; }
  footer a { margin-right: 16px; }
</style>
</head>
<body>
<main>
<a class="brand" href="./">Venturo</a>
${body}
<footer>
  <a href="./privacy.html">Privacy</a>
  <a href="./support.html">Support</a>
</footer>
</main>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });

for (const [file, title] of [['privacy', 'Privacy Policy'], ['support', 'Support']]) {
  const md = readFileSync(join(SRC, `${file}.md`), 'utf8');
  // The in-app links are absolute paths from the old server. Static files sit
  // next to each other instead.
  const html = render(md).replace(/href="\/(privacy|support)"/g, 'href="./$1.html"');
  writeFileSync(join(OUT, `${file}.html`), shell(title, html));
  console.log(`  docs/${file}.html`);
}

// An index, so the Pages root is not a 404 for anyone who trims the URL.
writeFileSync(
  join(OUT, 'index.html'),
  shell('Venturo', '<h1>Venturo</h1><p>Walks somebody from "I want to start a business" to their first sale.</p><p><a href="./privacy.html">Privacy Policy</a> · <a href="./support.html">Support</a></p>')
);
console.log('  docs/index.html');

// Cloudflare serves these as-is. The headers are not required by anything —
// they cost one file and close off the ways a static page can still be turned
// against its reader.
writeFileSync(
  join(OUT, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self'
`
);
console.log('  docs/_headers');

// Clean URLs. Written here rather than left as a stray file so a rebuild
// cannot quietly drop it.
writeFileSync(
  join(OUT, '_redirects'),
  `# Clean URLs, so the App Store listing carries /privacy rather than
# /privacy.html. 200 rather than 301: the path is the canonical one and a
# redirect chain on a legal page is a needless extra hop.
/privacy   /privacy.html   200
/support   /support.html   200
`
);
console.log('  docs/_redirects');
