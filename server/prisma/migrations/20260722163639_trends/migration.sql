-- CreateTable
CREATE TABLE "TrendCard" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "priceRange" TEXT,
    "hotness" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedTrend" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "trendCardId" TEXT NOT NULL,

    CONSTRAINT "SavedTrend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrendCard_slug_key" ON "TrendCard"("slug");

-- CreateIndex
CREATE INDEX "TrendCard_status_idx" ON "TrendCard"("status");

-- CreateIndex
CREATE INDEX "SavedTrend_userId_state_idx" ON "SavedTrend"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SavedTrend_userId_trendCardId_key" ON "SavedTrend"("userId", "trendCardId");

-- AddForeignKey
ALTER TABLE "SavedTrend" ADD CONSTRAINT "SavedTrend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTrend" ADD CONSTRAINT "SavedTrend_trendCardId_fkey" FOREIGN KEY ("trendCardId") REFERENCES "TrendCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
