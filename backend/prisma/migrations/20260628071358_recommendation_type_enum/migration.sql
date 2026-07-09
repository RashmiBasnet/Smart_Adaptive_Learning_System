/*
  Warnings:

  - Changed the type of `type` on the `recommendations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('REVISE_PREREQUISITE', 'PRACTISE_CURRENT', 'ADVANCE_NEXT', 'ALL_MASTERED');

-- AlterTable
ALTER TABLE "recommendations" DROP COLUMN "type",
ADD COLUMN     "type" "RecommendationType" NOT NULL;
