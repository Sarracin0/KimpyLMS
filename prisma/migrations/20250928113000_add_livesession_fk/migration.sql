-- Add FK for LessonBlock.liveSessionId after LiveSession exists
ALTER TABLE "LessonBlock"
  ADD CONSTRAINT "LessonBlock_liveSessionId_fkey"
  FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
