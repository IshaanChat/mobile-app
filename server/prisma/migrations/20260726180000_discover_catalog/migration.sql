-- Discover catalog: TrendCard becomes TrendProduct, and niches get a table.
--
-- HAND-WRITTEN ON PURPOSE. `prisma migrate dev` sees a model rename as
-- DROP TABLE + CREATE TABLE, and TrendCard is the parent of SavedTrend with
-- ON DELETE CASCADE — running Prisma's own output would silently delete
-- every idea shelf in the database. Renaming in place keeps the rows, their
-- ids, and every save pointing at them.
--
-- Verify after editing:
--   npx prisma migrate diff \
--     --from-migrations ./prisma/migrations \
--     --to-schema-datamodel ./prisma/schema.prisma \
--     --shadow-database-url <a scratch db> --exit-code
-- Exit code 0 means this file and schema.prisma agree.

-- 1. Rename the table. Postgres carries the primary key, the unique index,
--    and SavedTrend's foreign key across automatically; only the constraint
--    *names* keep the old string, which the renames below fix so a future
--    diff doesn't see drift.
ALTER TABLE "TrendCard" RENAME TO "TrendProduct";

ALTER INDEX "TrendCard_pkey" RENAME TO "TrendProduct_pkey";
ALTER INDEX "TrendCard_slug_key" RENAME TO "TrendProduct_slug_key";
ALTER INDEX "TrendCard_status_idx" RENAME TO "TrendProduct_status_idx";

-- SavedTrend's FK column keeps its name (it appears in emitted trend.saved
-- payloads), but the constraint is repointed by the rename above. Rename the
-- constraint itself so it doesn't read as pointing at a table that's gone.
ALTER TABLE "SavedTrend"
  RENAME CONSTRAINT "SavedTrend_trendCardId_fkey" TO "SavedTrend_trendProductId_fkey";

-- 2. Niches become a real table so Discover can group by domain and filter
--    by audience without the client knowing the taxonomy.
CREATE TABLE "Niche" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "imageQuery" TEXT,
    "imageUrl" TEXT,
    "imageCredit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Niche_slug_key" ON "Niche"("slug");
CREATE INDEX "Niche_domain_idx" ON "Niche"("domain");

-- 3. New columns. Every one is nullable or defaulted, so existing rows stay
--    valid without a backfill.
ALTER TABLE "TrendProduct"
    ADD COLUMN "nicheId" TEXT,
    ADD COLUMN "sourcingType" TEXT,
    ADD COLUMN "sourcingUrl" TEXT,
    ADD COLUMN "sourceCost" TEXT,
    ADD COLUMN "typicalResale" TEXT,
    ADD COLUMN "imageQuery" TEXT,
    ADD COLUMN "imageCredit" TEXT,
    ADD COLUMN "heat" INTEGER,
    ADD COLUMN "heatPrev" INTEGER,
    ADD COLUMN "unitsSold" INTEGER,
    ADD COLUMN "listings" INTEGER,
    ADD COLUMN "priceLow" DOUBLE PRECISION,
    ADD COLUMN "priceHigh" DOUBLE PRECISION,
    ADD COLUMN "adCount" INTEGER,
    ADD COLUMN "adDaysLive" INTEGER,
    ADD COLUMN "adReach" INTEGER,
    ADD COLUMN "signalSources" TEXT,
    ADD COLUMN "signalsPolledAt" TIMESTAMP(3),
    ADD COLUMN "adSource" TEXT,
    ADD COLUMN "adEvidenceUrl" TEXT,
    ADD COLUMN "adAdvertiser" TEXT,
    ADD COLUMN "adCoverage" TEXT,
    ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'CATALOG';

-- 4. Rows that existed before this migration came from the old trends
--    importer and have no niche. Mark them LEGACY so the catalog feed can
--    exclude them (it filters on nicheId) and so --archive-missing can never
--    mistake them for catalog rows that disappeared from the JSON. They stay
--    readable on the saved shelf, which is the whole point of not dropping
--    the table.
UPDATE "TrendProduct" SET "origin" = 'LEGACY';

CREATE INDEX "TrendProduct_nicheId_idx" ON "TrendProduct"("nicheId");
CREATE INDEX "TrendProduct_status_heat_idx" ON "TrendProduct"("status", "heat");

ALTER TABLE "TrendProduct"
  ADD CONSTRAINT "TrendProduct_nicheId_fkey"
  FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;
