-- Add SCENARIO to gamification content type enum
ALTER TYPE "GamificationContentType" ADD VALUE IF NOT EXISTS 'SCENARIO';

-- Create scenario attempt table
CREATE TABLE IF NOT EXISTS "ScenarioAttempt" (
    "id" TEXT NOT NULL,
    "gamificationBlockId" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "path" JSONB NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" INTEGER,
    "reflections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScenarioAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScenarioAttempt"
  ADD CONSTRAINT "ScenarioAttempt_gamificationBlockId_fkey" FOREIGN KEY ("gamificationBlockId") REFERENCES "GamificationBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScenarioAttempt"
  ADD CONSTRAINT "ScenarioAttempt_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ScenarioAttempt_gamificationBlockId_idx" ON "ScenarioAttempt"("gamificationBlockId");
CREATE INDEX IF NOT EXISTS "ScenarioAttempt_userProfileId_idx" ON "ScenarioAttempt"("userProfileId");
