-- AlterEnum
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'LIVE_SESSION';

-- AlterTable
ALTER TABLE "LessonBlock" ADD COLUMN IF NOT EXISTS "liveSessionId" TEXT;
ALTER TABLE "LessonBlock" ADD COLUMN IF NOT EXISTS "liveSessionConfig" JSONB;

-- Foreign key to LiveSession will be added in a later migration, after LiveSession table exists.
