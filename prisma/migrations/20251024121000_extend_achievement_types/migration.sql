-- Extend achievement unlock enum with Practice Arena and Course Points support
DO $$
BEGIN
  ALTER TYPE "AchievementUnlockType" ADD VALUE 'ARENA_PERFORMANCE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "AchievementUnlockType" ADD VALUE 'COURSE_POINTS';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
