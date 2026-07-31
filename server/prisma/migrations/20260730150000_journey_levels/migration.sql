-- The journey: five named levels, 34 milestones, five playbooks.
--
-- Replaces nothing yet. MissionCompletion and the existing /api/missions stay
-- where they are so the older client keeps working; the new board is served
-- from /api/journey and the two can run side by side until the app has moved.
--
-- Completions are keyed to the USER, not the business. The journey is personal:
-- an explorer has no business at all, and somebody running two ventures has not
-- walked the path twice.

-- CreateTable
CREATE TABLE "JourneyLevel" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "JourneyLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "where" TEXT NOT NULL,
    "trigger" TEXT,
    "tab" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 10,
    "position" INTEGER NOT NULL DEFAULT 0,
    "levelId" TEXT NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneCompletion" (
    "id" TEXT NOT NULL,
    "milestoneSlug" TEXT NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MilestoneCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JourneyLevel_level_key" ON "JourneyLevel"("level");
CREATE UNIQUE INDEX "Milestone_slug_key" ON "Milestone"("slug");
CREATE INDEX "Milestone_levelId_position_idx" ON "Milestone"("levelId", "position");
CREATE UNIQUE INDEX "Playbook_slug_key" ON "Playbook"("slug");
CREATE UNIQUE INDEX "MilestoneCompletion_userId_milestoneSlug_key" ON "MilestoneCompletion"("userId", "milestoneSlug");
CREATE INDEX "MilestoneCompletion_userId_idx" ON "MilestoneCompletion"("userId");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "JourneyLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneCompletion" ADD CONSTRAINT "MilestoneCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
