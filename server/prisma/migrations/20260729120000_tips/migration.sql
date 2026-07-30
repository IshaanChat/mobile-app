-- Tips: curator-owned global content, the same shape as CommunityPost.
--
-- No per-user rows. Which tips somebody has already seen stays client-side on
-- purpose: it is high-churn, low-value state and not worth a database write
-- per tap.
--
-- `tab` rather than `where` because WHERE is a SQL reserved word.

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tab" TEXT NOT NULL DEFAULT 'any',
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tip_slug_key" ON "Tip"("slug");

-- CreateIndex
CREATE INDEX "Tip_status_tab_level_idx" ON "Tip"("status", "tab", "level");
