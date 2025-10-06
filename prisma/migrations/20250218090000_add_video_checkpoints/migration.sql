-- Add videoCheckpoints JSON column to lesson blocks for interactive video timeline
ALTER TABLE "LessonBlock"
ADD COLUMN IF NOT EXISTS "videoCheckpoints" JSONB;
