-- Ensure the GamificationContentType enum exists before attempting to extend it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE lower(typname) = 'gamificationcontenttype') THEN
    CREATE TYPE "GamificationContentType" AS ENUM ('QUIZ', 'FLASHCARDS', 'SCENARIO');
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE lower(t.typname) = 'gamificationcontenttype' AND e.enumlabel = 'SCENARIO'
  ) THEN
    ALTER TYPE "GamificationContentType" ADD VALUE IF NOT EXISTS 'SCENARIO';
  END IF;
END$$;

-- Add SCENARIO to gamification content type enum if the type already existed without it
ALTER TYPE "GamificationContentType" ADD VALUE IF NOT EXISTS 'SCENARIO';

DO $$
BEGIN
  -- Create the ScenarioAttempt table only when the GamificationBlock table is already present
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'GamificationBlock'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'ScenarioAttempt'
  ) THEN
    CREATE TABLE "ScenarioAttempt" (
        "id" TEXT NOT NULL,
        "gamificationBlockId" TEXT NOT NULL,
        "userProfileId" TEXT NOT NULL,
        "path" JSONB NOT NULL,
        "score" INTEGER NOT NULL DEFAULT 0,
        "riskLevel" INTEGER,
        "reflections" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ScenarioAttempt_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ScenarioAttempt_gamificationBlockId_fkey"
          FOREIGN KEY ("gamificationBlockId") REFERENCES "GamificationBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "ScenarioAttempt_userProfileId_fkey"
          FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX "ScenarioAttempt_gamificationBlockId_idx" ON "ScenarioAttempt"("gamificationBlockId");
    CREATE INDEX "ScenarioAttempt_userProfileId_idx" ON "ScenarioAttempt"("userProfileId");
  END IF;
END$$;
