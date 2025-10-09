-- Player insight layer: event logging, comments, and AI coach messages

-- Create enums
CREATE TYPE "PlayerEventType" AS ENUM ('PAUSE', 'RESUME', 'REWATCH', 'COACH_PROMPT');
CREATE TYPE "ChapterCommentVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'HR_ONLY');
CREATE TYPE "ChapterCoachMessageRole" AS ENUM ('USER', 'AI');

-- Player event stream
CREATE TABLE "PlayerEvent" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "type" "PlayerEventType" NOT NULL,
    "playbackSecond" INTEGER,
    "timestampMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlayerEvent_chapterId_type_idx" ON "PlayerEvent"("chapterId", "type");
CREATE INDEX "PlayerEvent_chapterId_playbackSecond_idx" ON "PlayerEvent"("chapterId", "playbackSecond");

-- Chapter comments with visibility controls
CREATE TABLE "ChapterComment" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "visibility" "ChapterCommentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "content" TEXT NOT NULL,
    "playbackSecond" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChapterComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChapterComment_chapterId_visibility_idx" ON "ChapterComment"("chapterId", "visibility");
CREATE INDEX "ChapterComment_chapterId_playbackSecond_idx" ON "ChapterComment"("chapterId", "playbackSecond");

-- AI coach message log per session
CREATE TABLE "ChapterCoachMessage" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChapterCoachMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "playbackSecond" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterCoachMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChapterCoachMessage_sessionId_createdAt_idx" ON "ChapterCoachMessage"("sessionId", "createdAt");
CREATE INDEX "ChapterCoachMessage_chapterId_createdAt_idx" ON "ChapterCoachMessage"("chapterId", "createdAt");

-- Foreign keys
ALTER TABLE "PlayerEvent" ADD CONSTRAINT "PlayerEvent_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerEvent" ADD CONSTRAINT "PlayerEvent_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterComment" ADD CONSTRAINT "ChapterComment_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterComment" ADD CONSTRAINT "ChapterComment_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterCoachMessage" ADD CONSTRAINT "ChapterCoachMessage_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterCoachMessage" ADD CONSTRAINT "ChapterCoachMessage_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
