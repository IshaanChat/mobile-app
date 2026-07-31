-- Attribution for community images.
--
-- `growth:images` has been writing a photographer credit into
-- content/communities/*.json since it was written, and the importer had nowhere
-- to put it. All 166 credits existed on disk and none reached the database.
--
-- Nullable and no backfill here: `npm run growth:import` refills it from the
-- JSON that already holds every value.

-- AlterTable
ALTER TABLE "CommunityPost" ADD COLUMN "imageCredit" TEXT;
