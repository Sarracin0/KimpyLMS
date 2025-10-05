-- Add FK for UserLessonProgress.userProfileId after UserProfile exists
ALTER TABLE "UserLessonProgress"
  ADD CONSTRAINT "UserLessonProgress_userProfileId_fkey"
  FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
