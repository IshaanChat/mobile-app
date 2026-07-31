-- Which shelf a sourced product earned.
--
-- `sourcing.ts` has been writing `tier` into content/products/discovered.json
-- since it was written — 528 'proven' and 170 'upside' — and the importer had
-- nowhere to put it. All 698 values existed on disk and none reached the
-- database, so the High upside badge worked in the prototype (which reads the
-- JSON directly) and could not exist in any client that reads the API.
--
-- Nullable with no backfill and no default. `npm run catalog:import` refills it
-- from the JSON that already holds every value, and null is meaningful here:
-- the 188 hand-curated products are not tiered at all, which is a different
-- state from 'proven'. A DEFAULT would silently assert they were assessed.

-- AlterTable
ALTER TABLE "TrendProduct" ADD COLUMN "tier" TEXT;
