-- Interest signal (Wikimedia pageviews) and live sourcing (merchant catalogs).
--
-- Purely additive, unlike the last one — every column is nullable, so
-- existing rows stay valid and there is no rename hazard here.
--
-- `interest`/`interestTrend` come from a source that needs no credential, so
-- unlike every other measured column these can be populated today rather than
-- waiting on an approval.
--
-- `liveSourcingUrl`/`liveMerchant` are deliberately separate from the
-- curator's `sourcingUrl`. Same rule that keeps `heat` out of `hotness`:
-- ingest never overwrites authored work.

ALTER TABLE "TrendProduct"
    ADD COLUMN "interest" INTEGER,
    ADD COLUMN "interestTrend" DOUBLE PRECISION,
    ADD COLUMN "liveSourcingUrl" TEXT,
    ADD COLUMN "liveMerchant" TEXT;

-- The trending sort reads interestTrend when a row has no previous heat to
-- difference, which on a fresh catalog is every row.
CREATE INDEX "TrendProduct_status_interestTrend_idx"
    ON "TrendProduct"("status", "interestTrend");
