-- AlterTable
ALTER TABLE "Business" ADD COLUMN "businessType" TEXT;

-- CreateTable
CREATE TABLE "AppEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "businessId" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AppEvent_businessId_type_idx" ON "AppEvent"("businessId", "type");
