-- Add isLeaderboardEnabled column to Course
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "isLeaderboardEnabled" BOOLEAN NOT NULL DEFAULT false;