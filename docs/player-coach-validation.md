# Player Upgrade – Validation Playbook

## Feature overview
- **Contextual Coach AI**: pause the video to open the side coach. Messages are logged through `/api/courses/[courseId]/chapters/[chapterId]/coach` and persisted in `ChapterCoachMessage`.
- **Engagement heatmap**: rewinds are tracked client-side and stored in `PlayerEvent` (`type = REWATCH`), rendered as gradient segments on the seek bar.
- **Smart commenting**: learners can post notes with visibility (`PRIVATE`, `PUBLIC`, `HR_ONLY`) via `/comments`; data lives in `ChapterComment`.

## Configuration
- `OPENAI_API_KEY` (existing) must point to a key with Responses API access.
- Optional: `OPENAI_COACH_MODEL` to switch model (default `gpt-4.1-mini`).
- New Prisma migration: `20251024103000_player_coach_layer`. Run `npx prisma migrate deploy` before starting the app.

## Smoke test checklist
1. Enrol as learner, open a chapter with video.
2. Pause → coach panel auto-opens; send a question, verify answer and message persistence after closing/reopening the panel in the same session.
3. Seek backwards multiple times; refresh and confirm the heatmap highlights the rewound segments.
4. Add three comments (private, public, HR-only). Switch accounts:
   - Learner account sees own private comment + public streams.
   - HR account sees HR-only threads.
5. Complete the video; ensure progression still updates and no console errors occur.

## Feedback loop (Lean validation)
- **Learner interviews (≤5 participants)**:
  - Prompt them to watch a micro-lesson, encourage at least one coach question.
  - Capture qualitative feedback: clarity of pause overlay, answer usefulness, comment friction.
  - Metrics to note: time to first question, satisfaction score (1-5) right after session.
- **HR admin review**:
  - Weekly digest (manual for now): export `ChapterCoachMessage` grouped by visibility and share in Notion.
  - Ask whether the new heatmap spots align with existing escalation tickets.

## Instrumentation notes
- Player events are batched client-side (8 items or 1.2s debounce) to avoid chatty requests.
- AI prompts also append a `PlayerEvent` with type `COACH_PROMPT` for later trend analysis.
- Comments payload trims to 600 chars to keep moderation lightweight.

## Rollback plan
- Disable Coach AI by removing `OPENAI_API_KEY` (panel stays hidden, other features unaffected).
- Comments can be hidden by revoking client button (set `isCommentsOpen` default false) without DB rollback.
- Heatmap is additive; in case of issues drop the `PlayerEvent` insert from the API.
