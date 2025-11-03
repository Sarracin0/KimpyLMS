-- Extend gamification content types and scenario attempts for Practice Arena
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type typ
    JOIN pg_enum enm ON enm.enumtypid = typ.oid
    WHERE typ.typname = 'GamificationContentType' AND enm.enumlabel = 'ARENA'
  ) THEN
    ALTER TYPE "GamificationContentType" ADD VALUE 'ARENA';
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE "ScenarioAttemptType" AS ENUM ('SCENARIO', 'ARENA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'ScenarioAttempt'
  ) THEN
    CREATE TABLE "ScenarioAttempt" (
      "id" TEXT NOT NULL,
      "gamificationBlockId" TEXT NOT NULL,
      "userProfileId" TEXT NOT NULL,
      "attemptType" "ScenarioAttemptType" NOT NULL DEFAULT 'SCENARIO',
      "path" JSONB NOT NULL,
      "score" INTEGER NOT NULL DEFAULT 0,
      "riskLevel" INTEGER,
      "reflections" JSONB,
      "insightTokens" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ScenarioAttempt_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "ScenarioAttempt_gamificationBlockId_fkey"
        FOREIGN KEY ("gamificationBlockId") REFERENCES "GamificationBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ScenarioAttempt_userProfileId_fkey"
        FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "ScenarioAttempt_gamificationBlockId_idx" ON "ScenarioAttempt"("gamificationBlockId");
    CREATE INDEX IF NOT EXISTS "ScenarioAttempt_userProfileId_idx" ON "ScenarioAttempt"("userProfileId");
  END IF;
END
$$;

ALTER TABLE "ScenarioAttempt"
  ADD COLUMN IF NOT EXISTS "attemptType" "ScenarioAttemptType" NOT NULL DEFAULT 'SCENARIO';

ALTER TABLE "ScenarioAttempt"
  ADD COLUMN IF NOT EXISTS "insightTokens" INTEGER NOT NULL DEFAULT 0;

-- Ensure existing rows have a concrete attempt type
UPDATE "ScenarioAttempt"
SET "attemptType" = 'SCENARIO'
WHERE "attemptType" IS NULL;
