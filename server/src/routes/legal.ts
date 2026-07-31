// Publicly readable legal pages.
//
// Mounted ABOVE requireAuth, and outside /api entirely. App Store Connect
// requires a Privacy Policy URL that anyone can open — a reviewer, a regulator,
// or someone deciding whether to sign up — and a URL that 401s is not a privacy
// policy. Everything under /api sits behind authentication, so these cannot
// live there.
//
// The source of truth is content/legal/*.md, edited as Markdown like the rest
// of the content in this repo. It is rendered to HTML here rather than being
// kept as a second HTML copy, because two copies of a legal document is how you
// end up publishing the stale one.
//
// The file lives under server/ deliberately. render.yaml sets `rootDir: server`,
// so anything above that directory is outside what the service is built from —
// a policy at the repo root would work locally and 404 in production.

import { readFileSync } from 'fs';
import { join } from 'path';
import { Router } from 'express';

export const legalRouter = Router();

// App Store Connect requires both of these as public URLs before an app can be
// submitted, and both must stay reachable while it is listed.
const DOCS: Record<string, { file: string; title: string }> = {
  privacy: { file: 'privacy.md', title: 'Privacy Policy' },
  support: { file: 'support.md', title: 'Support' },
};

/**
 * A deliberately small Markdown subset: headings, paragraphs, lists, tables,
 * blockquotes, bold, italic, code and links. That is everything the policy
 * uses, and adding a Markdown dependency to render one document would be a
 * poor trade — every dependency in this service is one more thing to keep
 * patched.
 *
 * Escaping happens first and unconditionally, so no `<script>` can survive
 * even if a document is later edited carelessly.
 */
function renderMarkdown(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inline = (s: string) =>
    escape(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const out: string[] = [];
  let inList = false;
  let inTable = false;

  // Markdown wraps a paragraph across several source lines and joins them; a
  // blockquote does the same. Both therefore have to be buffered until a blank
  // line or a different block type ends them. Emitting per line instead turns
  // one paragraph into six, each with its own margin — which is what the first
  // version of this did, producing 64 paragraphs from a document that has
  // about twenty.
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
    quote = [];
  };
  const closeBlocks = () => {
    flushParagraph();
    flushQuote();
    if (inList) { out.push('</ul>'); inList = false; }
    if (inTable) { out.push('</tbody></table>'); inTable = false; }
  };

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();

    if (!line.trim()) { closeBlocks(); continue; }
    if (/^---+$/.test(line.trim())) { closeBlocks(); out.push('<hr>'); continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeBlocks();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith('>')) {
      flushParagraph();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }

    // Tables: a header row, a separator of dashes, then body rows.
    if (line.startsWith('|')) {
      flushParagraph();
      flushQuote();
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // the separator
      if (!inTable) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<table><thead><tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>');
        inTable = true;
      } else {
        out.push('<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      }
      continue;
    }

    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      flushParagraph();
      flushQuote();
      if (inTable) { out.push('</tbody></table>'); inTable = false; }
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(item[1])}</li>`);
      continue;
    }

    // A plain line continues whichever of the two wrapping blocks is open.
    if (quote.length) { quote.push(line); continue; }
    if (inList) { out.push(`<li>${inline(line.trim())}</li>`); continue; }
    paragraph.push(line);
  }

  closeBlocks();
  return out.join('\n');
}

/** Venturo's palette, so the policy does not look like a different product. */
function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Venturo</title>
<style>
  :root {
    --bg:#fbf4f0; --panel:#fff; --border:#eedbd4;
    --text:#34262b; --dim:#98818a; --accent:#6e4eab;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0b0c0f; --panel:#14161b; --border:#262a33;
            --text:#edeef2; --dim:#8b92a0; --accent:#d0b8f0; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); line-height:1.6;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    padding:40px 20px 80px; }
  main { max-width:720px; margin:0 auto; }
  h1 { font-size:32px; letter-spacing:-0.02em; margin:0 0 8px; }
  h2 { font-size:21px; letter-spacing:-0.015em; margin:36px 0 10px; }
  h3 { font-size:17px; margin:26px 0 8px; }
  p, li { font-size:16px; }
  a { color:var(--accent); }
  hr { border:none; border-top:1px solid var(--border); margin:32px 0; }
  blockquote { margin:20px 0; padding:12px 16px; border-left:3px solid var(--accent);
    background:var(--panel); border-radius:0 10px 10px 0; color:var(--dim); font-size:15px; }
  code { background:var(--panel); border:1px solid var(--border); border-radius:5px;
    padding:1px 5px; font-size:14px; }
  table { border-collapse:collapse; width:100%; margin:18px 0; font-size:15px;
    display:block; overflow-x:auto; }
  th, td { text-align:left; padding:9px 12px; border-bottom:1px solid var(--border); }
  th { font-weight:600; }
  ul { padding-left:22px; }
  li { margin:5px 0; }
  footer { margin-top:56px; padding-top:20px; border-top:1px solid var(--border);
    color:var(--dim); font-size:14px; }
</style>
</head><body><main>
${body}
<footer>Venturo</footer>
</main></body></html>`;
}

// Rendered once at startup rather than per request: the documents cannot change
// without a redeploy, so re-reading and re-rendering on every hit would be work
// with no possible different answer.
const rendered = new Map<string, string>();

for (const [slug, { file, title }] of Object.entries(DOCS)) {
  try {
    const md = readFileSync(join('content', 'legal', file), 'utf8');
    rendered.set(slug, page(title, renderMarkdown(md)));
  } catch (err) {
    // Loud, because a missing privacy policy in production is a blocked app
    // submission — and a silent 404 here would be discovered by a reviewer.
    console.error(
      `[legal] could not read content/legal/${file} — /${slug} will 404: ` +
        (err instanceof Error ? err.message : err)
    );
  }
}

legalRouter.get('/:slug', (req, res) => {
  const html = rendered.get(req.params.slug);
  if (!html) return res.status(404).type('text/plain').send('Not found');
  res
    .type('text/html; charset=utf-8')
    .setHeader('Cache-Control', 'public, max-age=3600');
  res.send(html);
});
