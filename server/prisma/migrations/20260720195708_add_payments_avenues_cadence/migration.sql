-- AlterTable
ALTER TABLE "Business" ADD COLUMN "salesAvenues" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT,
    CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MissionCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL DEFAULT 'once',
    "xpAwarded" INTEGER NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_MissionCompletion" ("businessId", "completedAt", "id", "missionId", "xpAwarded") SELECT "businessId", "completedAt", "id", "missionId", "xpAwarded" FROM "MissionCompletion";
DROP TABLE "MissionCompletion";
ALTER TABLE "new_MissionCompletion" RENAME TO "MissionCompletion";
CREATE UNIQUE INDEX "MissionCompletion_missionId_businessId_periodKey_key" ON "MissionCompletion"("missionId", "businessId", "periodKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
