Concept Overview – “Decision Labs”

Create an AI-driven, branching scenario experience that drops employees into realistic corporate situations (client escalations, compliance dilemmas, leadership conversations). Instead of unidirectional quiz questions, the learner progresses through 4‑6 decision nodes; at each step they choose an action or craft a short reply. OpenAI generates the scenario narrative, the decision tree, scoring rubric, and the debrief points HR cares about (skills touched, risk flags, coaching tips).

Learner value: it simulates real consequences, not mere trivia. Each choice unlocks contextual feedback and cumulative scoring (competency vs. compliance vs. customer impact). Reflection prompts can require a short free text answer that the AI scores against the rubric.
HR value: you capture decision patterns per learner, aggregated strengths/gaps per scenario and per course, plus the AI-generated coaching insights. These can complement quiz scores to show whether teams internalise new behaviours, not just recall facts.
Reusing the existing integration
Area	Reuse	Minimal extras
Content generation	Reuse generateGamificationContent function-call flow. Add a new tool definition create_scenario_lab that returns: intro, nodes[] (each with situation, choices, ai_feedback, risk_tags, points) and optional reflection_prompts.	Extend GamificationContentType with SCENARIO (one Enum change) and store the whole tree in GamificationBlock.result. No new tables needed for content.
Documents input	HR selects global/course attachments exactly as per quiz/flashcard. These feed the prompt so the scenario stays grounded in company policy or product docs.	None.
Generation endpoint	/api/.../gamification already hydrates GamificationBlock. Branch the handler: when contentType === SCENARIO, save the JSON tree instead of a quiz/flashcard.	Add a branch plus a simple DTO validator (Zod) for the scenario schema.
Learner player	Build ScenarioLabPlayer similarly to QuizPlayer, but stateful per node: show narrative → list of options (or text box if type === 'reflection') → show AI feedback and auto-advance.	For analytics create a minimal ScenarioAttempt table (id, blockId, userProfileId, score, path[], reflections JSON). This is the only new table; migration is tiny.
Points & badges	When the learner finishes, award points via existing UserPoints flow and optionally trigger a badge (e.g., “Handled difficult client”).	Hook into the same award logic that quizzes use.
HR analytics	Reuse /gamification dashboard: add a section for “Decision Labs” pulling aggregated ScenarioAttempts. Show pass rate, average risk level chosen, heatmap of most frequent choices, reflections flagged by AI as “needs coaching”.	Extend dashboard query with one db.scenarioAttempt fetch and render charts using existing card components.
Implementation plan
Schema tweak
enum GamificationContentType { QUIZ | FLASHCARDS | SCENARIO }
model ScenarioAttempt { id, gamificationBlockId, userProfileId, selections Json, score Int, riskLevel Int?, reflections Json?, createdAt }. Only one table + enum change.
OpenAI tooling
Define create_scenario_lab tool in generator.ts with strict schema:
{
  "intro": "string",
  "objectives": ["string"],
  "nodes": [{
    "id": "string",
    "type": "decision"|"reflection",
    "situation": "string",
    "choices": [{
      "id": "string",
      "label": "string",
      "impact": { "score": number, "risk": number, "competency_tags": ["string"] },
      "feedback": "string",
      "next_node_id": "string|null"
    }]
  }],
  "debrief": { "summary": "string", "coaching_points": ["string"] }
}
Switch generateGamificationContent to call this tool when contentType === SCENARIO. No new API route needed.
Gamification block creation
Frontend wizard (GamificationStudio) gets a third toggle “Decision Lab”. On submit, call the existing endpoint with contentType: 'SCENARIO'.
Learner experience
New component ScenarioLabPlayer for course pages:
Render intro/objectives.
Step through nodes; store path[].
When finished, POST to /api/scenarios/[blockId]/attempts to record selections, compute total score (sum of impact.score), and return HR-friendly metrics.
Show dynamic debrief and allow retry.
Hook into existing course sidebar: if block type GAMIFICATION and gamification.contentType === 'SCENARIO', route to /courses/:courseId/scenarios/:blockId.
Analytics & HR dashboard
In /gamification, add:
“Decision Labs effectiveness” card: aggregated average score, risk index, # reflections requiring follow-up.
Table per course with learners, avg score, % high-risk choices.
Latest reflections flagged via AI (store a boolean in attempt if impact.risk > threshold or reflections contain flagged keywords).
QA & Release
Because we reuse the attachments prompt and same API surface, regression risk is low.
Add unit tests for generator normalization and attempt scoring.
Document author workflow in docs/COURSE_BUILDER_OPERATIONS.md.
Why it stands out
Moves beyond rote memory: simulates dynamic judgement calls.
HR gets actionable signals: which teams choose high-risk options, what coaching themes emerge.
Minimal DB footprint: one enum + one attempt table (small migration).
Reuses the existing OpenAI orchestration, admin UI, and analytics patterns, so delivery time is manageable.
When you’re ready I can start wiring the enum, tool schema, and player component.