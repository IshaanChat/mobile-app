// Curator write endpoints: send content to the database without editing files.
//
//   POST /api/admin/products     one product or an array
//   POST /api/admin/communities  one community or an array
//   POST /api/admin/tips         one tip or an array
//   GET  /api/admin/counts       what is currently live
//
// Auth is ADMIN_TOKEN as a Bearer token, and it fails closed — see
// src/core/admin-auth.ts. These write GLOBAL rows, so a bad write reaches every
// user's feed rather than one account's.
//
// Three rules, shared with the file importers so the two cannot disagree:
//
//   1. Validate everything before writing anything. A half-applied batch is
//      worse than a rejected one, because the feed would serve it.
//   2. Upsert by slug. Re-sending the same item updates in place.
//   3. Never delete. Archiving is a status change, and there is no endpoint
//      for it here — losing curated content to a stray HTTP call is not a
//      risk worth the convenience.
//
// `content/*.json` stays the source of truth. Anything posted here should be
// written back into those files, or the next `content:sync` will not know
// about it. /api/admin/counts exists to make that drift visible.

import { Router } from 'express';
import { ah } from '../core/http';
import { HttpError } from '../core/auth';
import { prisma } from '../prisma';
import {
  findDuplicateSlugs,
  tipTooLong,
  validateCommunity,
  validateProduct,
  validateTip,
} from '../content/validate';

export const adminRouter = Router();

/** One item or many, always handled as many. */
function asArray(body: unknown): any[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') return [body];
  throw new HttpError(400, 'Send a JSON object or an array of them.');
}

/** A cap, so a runaway script cannot hold a connection open indefinitely. */
const MAX_BATCH = 500;

function guardBatch(items: any[]) {
  if (items.length === 0) throw new HttpError(400, 'Nothing to write.');
  if (items.length > MAX_BATCH) {
    throw new HttpError(400, `Too many at once (${items.length}). Maximum is ${MAX_BATCH}.`);
  }
}

function rejectProblems(problems: string[], dupes: string[]) {
  const all = [...problems];
  for (const slug of dupes) all.push(`duplicate slug "${slug}" in this payload`);
  if (all.length) throw new HttpError(400, `Nothing written. Fix these first:\n  ${all.join('\n  ')}`);
}

adminRouter.post(
  '/products',
  ah(async (req, res) => {
    const items = asArray(req.body);
    guardBatch(items);

    // Products reference a niche, so the valid set has to come from the
    // database rather than from the payload — you cannot introduce a product
    // and its niche in the same call. That is deliberate: niches are a small,
    // slow-changing taxonomy and belong in niches.json.
    const niches = await prisma.niche.findMany({ select: { slug: true } });
    const known = new Set(niches.map((n) => n.slug));

    const problems = items.flatMap((raw, i) =>
      validateProduct(raw, `[${i}] (${raw?.slug ?? 'no slug'})`, known)
    );
    rejectProblems(problems, findDuplicateSlugs(items));

    let created = 0;
    let updated = 0;
    for (const raw of items) {
      const niche = await prisma.niche.findUnique({ where: { slug: raw.nicheSlug } });
      const data = {
        title: String(raw.title).trim(),
        blurb: String(raw.blurb).trim(),
        sourcingType: String(raw.sourcingType).trim(),
        nicheId: niche!.id,
        // Both derived from the niche, never accepted from the caller —
        // `category` is the ranker's diversity key (so one domain cannot
        // wallpaper the feed) and `tags` is what interest-matching compares
        // against. Letting a POST set them by hand would let one product
        // quietly opt itself out of diversity or into every match. The file
        // importer derives them the same way.
        category: niche!.domain.trim(),
        tags: niche!.tags.trim(),
        sourceName: raw.sourceName?.trim() || null,
        sourcingUrl: raw.sourcingUrl?.trim() || null,
        sourceCost: raw.sourceCost?.trim() || null,
        typicalResale: raw.typicalResale?.trim() || null,
        imageUrl: raw.imageUrl?.trim() || null,
        hotness: raw.hotness ?? 50,
        status: 'ACTIVE',
      };
      const existing = await prisma.trendProduct.findUnique({ where: { slug: raw.slug } });
      if (existing) {
        await prisma.trendProduct.update({ where: { slug: raw.slug }, data });
        updated++;
      } else {
        await prisma.trendProduct.create({ data: { slug: raw.slug, ...data } });
        created++;
      }
    }

    const active = await prisma.trendProduct.count({ where: { status: 'ACTIVE' } });
    res.json({ written: items.length, created, updated, activeTotal: active });
  })
);

adminRouter.post(
  '/communities',
  ah(async (req, res) => {
    const items = asArray(req.body);
    guardBatch(items);

    const problems = items.flatMap((raw, i) =>
      validateCommunity(raw, `[${i}] (${raw?.slug ?? 'no slug'})`)
    );
    rejectProblems(problems, findDuplicateSlugs(items));

    let created = 0;
    let updated = 0;
    for (const raw of items) {
      const data = {
        title: raw.title.trim(),
        platform: raw.platform.trim(),
        kind: raw.kind.trim(),
        url: raw.url.trim(),
        tagline: raw.tagline.trim(),
        audience: raw.audience.trim(),
        overview: raw.overview.trim(),
        discussions: raw.discussions.trim(),
        loves: raw.loves.trim(),
        dislikes: raw.dislikes.trim(),
        rules: raw.rules.trim(),
        approach: raw.approach.trim(),
        tags: raw.tags.trim(),
        imageUrl: raw.imageUrl?.trim() || null,
        imageCredit: raw.imageCredit?.trim() || null,
        memberCount: raw.memberCount ?? null,
        hotness: raw.hotness ?? 50,
        status: 'ACTIVE',
      };
      const existing = await prisma.communityPost.findUnique({ where: { slug: raw.slug } });
      if (existing) {
        await prisma.communityPost.update({ where: { slug: raw.slug }, data });
        updated++;
      } else {
        await prisma.communityPost.create({ data: { slug: raw.slug, ...data } });
        created++;
      }
    }

    const active = await prisma.communityPost.count({ where: { status: 'ACTIVE' } });
    res.json({ written: items.length, created, updated, activeTotal: active });
  })
);

adminRouter.post(
  '/tips',
  ah(async (req, res) => {
    const items = asArray(req.body);
    guardBatch(items);

    const problems = items.flatMap((raw, i) => validateTip(raw, `[${i}] (${raw?.id ?? 'no id'})`));
    rejectProblems(problems, findDuplicateSlugs(items, 'id'));

    // Length is a warning, not a rejection — the clamp depends on rendered
    // width, so this is a smell rather than a certainty. Returned so a script
    // can surface it instead of it being lost in server logs.
    const warnings = items.filter(tipTooLong).map((t) => `"${t.id}" is ${t.text.length} chars and may clip`);

    let created = 0;
    let updated = 0;
    for (const raw of items) {
      const data = {
        kind: raw.kind.trim(),
        text: raw.text.trim(),
        tab: (raw.where ?? 'any').trim(),
        level: raw.level ?? 1,
        status: 'ACTIVE',
      };
      const existing = await prisma.tip.findUnique({ where: { slug: raw.id } });
      if (existing) {
        await prisma.tip.update({ where: { slug: raw.id }, data });
        updated++;
      } else {
        await prisma.tip.create({ data: { slug: raw.id, ...data } });
        created++;
      }
    }

    const active = await prisma.tip.count({ where: { status: 'ACTIVE' } });
    res.json({ written: items.length, created, updated, activeTotal: active, warnings });
  })
);

/**
 * What is actually live. Worth having because the files and the database can
 * drift the moment anything is posted rather than synced — this is how you see
 * that before a `content:sync` overwrites or resurrects something.
 */
adminRouter.get(
  '/counts',
  ah(async (_req, res) => {
    const [niches, products, communities, tips] = await Promise.all([
      prisma.niche.count(),
      prisma.trendProduct.count({ where: { status: 'ACTIVE' } }),
      prisma.communityPost.count({ where: { status: 'ACTIVE' } }),
      prisma.tip.count({ where: { status: 'ACTIVE' } }),
    ]);
    res.json({ niches, products, communities, tips });
  })
);
