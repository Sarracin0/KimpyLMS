# Add video checkpoints column

This migration introduces the optional `videoCheckpoints` JSONB column on `LessonBlock` to persist the interactive timeline used by the React video player. Run with `npx prisma migrate dev` after ensuring earlier migrations succeed (see note in PR about `GamificationContentType`).
