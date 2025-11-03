-- Alter enum to include new unlock types
ALTER TYPE "AchievementUnlockType" ADD VALUE IF NOT EXISTS 'LESSON_COMPLETION';
ALTER TYPE "AchievementUnlockType" ADD VALUE IF NOT EXISTS 'QUIZ_SCORE';
ALTER TYPE "AchievementUnlockType" ADD VALUE IF NOT EXISTS 'SCENARIO_PERFORMANCE';

-- Add criteria column for flexible rules
ALTER TABLE "CourseAchievement" ADD COLUMN IF NOT EXISTS "criteria" JSONB;
