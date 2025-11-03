-- Ensure ScenarioAttempt table exists (now that GamificationBlock is available)
DO $$
BEGIN
  IF NOT EXISTS (
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
      CONSTRAINT "ScenarioAttempt_pkey" PRIMARY KEY ("id")
    );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "ScenarioAttempt_gamificationBlockId_idx"
  ON "ScenarioAttempt"("gamificationBlockId");

CREATE INDEX IF NOT EXISTS "ScenarioAttempt_userProfileId_idx"
  ON "ScenarioAttempt"("userProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = current_schema()
      AND table_name = 'ScenarioAttempt'
      AND constraint_name = 'ScenarioAttempt_gamificationBlockId_fkey'
  ) THEN
    ALTER TABLE "ScenarioAttempt"
      ADD CONSTRAINT "ScenarioAttempt_gamificationBlockId_fkey"
      FOREIGN KEY ("gamificationBlockId") REFERENCES "GamificationBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = current_schema()
      AND table_name = 'ScenarioAttempt'
      AND constraint_name = 'ScenarioAttempt_userProfileId_fkey'
  ) THEN
    ALTER TABLE "ScenarioAttempt"
      ADD CONSTRAINT "ScenarioAttempt_userProfileId_fkey"
      FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
