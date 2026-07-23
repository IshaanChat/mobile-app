/*
  Warnings:

  - You are about to drop the column `body` on the `CommunityPost` table. All the data in the column will be lost.
  - Added the required column `approach` to the `CommunityPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discussions` to the `CommunityPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dislikes` to the `CommunityPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `loves` to the `CommunityPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `overview` to the `CommunityPost` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rules` to the `CommunityPost` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CommunityPost" DROP COLUMN "body",
ADD COLUMN     "approach" TEXT NOT NULL,
ADD COLUMN     "discussions" TEXT NOT NULL,
ADD COLUMN     "dislikes" TEXT NOT NULL,
ADD COLUMN     "loves" TEXT NOT NULL,
ADD COLUMN     "overview" TEXT NOT NULL,
ADD COLUMN     "rules" TEXT NOT NULL;
