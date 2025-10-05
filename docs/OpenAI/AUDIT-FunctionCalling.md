OpenAI Responses API — Function Calling Audit
=============================================

Scope
- Files reviewed: `src/lib/openai-responses.ts`, `src/app/api/chat/route.ts`.
- Primary doc: `docs/OpenAI/FunctionCalling.md` (authoritative). Also checked `Using tools.md` and streaming guide.

✅ Matches Official Docs
- Tool calling loop: Detects tool calls via streaming events (`response.output_item.added`, `response.function_call_arguments.delta`, `...done`). Accumulates `call_id`, `name`, `arguments` per doc. See `parseStreamResponse`.
- Follow-up continuation: Sends `input: [{ type: 'function_call_output', call_id, output }]` together with `previous_response_id` to continue the same response. See `continueWithToolOutputs`.
- Multiple tool calls: Aggregates all tool calls and posts all outputs in a single continuation request.
- Streaming awareness: Parses function-call events and completion events and resumes the response with tool outputs.
- No fallbacks to non-documented APIs or formats.

❌ Divergences (before fix)
- Continuation trigger bound to `[DONE]` only: If a stream ended after `response.completed` (without a `[DONE]` sentinel), the code did not perform continuation. Consequence: next user turn hit `"No tool output found for function call ..."`.
  - Docs reference: Function Calling flow — “Make a second request to the model with the tool output” and Streaming section showing function-call events (no reliance on a `[DONE]` sentinel).
  - Code pointers: `src/lib/openai-responses.ts` — `parseStreamResponse` handled continuation only inside `[DONE]` branch (around old lines ~620–660). Log evidence in the provided trace shows `response.completed` then stream close without continuation.
- Non-compliant fallback: On 400 error containing “No tool output found…”, code injected a dummy `function_call_output` with `name: 'unknown'` to unblock.
  - Docs reference: Function Calling — results must come from executing the tool(s) the model called; no dummy/placeholder outputs.
  - Code pointers: `src/lib/openai-responses.ts`, `createResponseStream` error path previously sent a fabricated output.
- Ordering of tool outputs not explicit: Best practice is to preserve model order (e.g., `output_index`). We did not track/sort by index.

🎯 Minimal Fixes Applied
- Trigger continuation on `response.completed`: If any finalized tool calls exist, immediately run tools and post outputs in a single continuation request, then stream the resumed response. Also kept support for `[DONE]` path for completeness.
- Preserve order: Record `output_index` for each tool call and sort outputs by `output_index` before continuation.
- Remove dummy fallback: Eliminated the code that fabricated an `unknown` tool output to “unblock” sessions.
- Strengthen types: Added `PendingToolCall` and `FinalizedToolCall` types for clarity and safety.

Key Code Changes
- `src/lib/openai-responses.ts`:
  - Added audit header comment.
  - `parseStreamResponse`: track `output_index`; continue on `response.completed` and on stream end if tools pending; sort tool calls by `output_index` before continuation; avoid signaling completion before tool cycle closes.
  - `continueWithToolOutputs`: unchanged contract (accepts array), now receives already-sorted tool calls; logs when sending tool outputs.
  - `createResponseStream`: removed non-compliant “minimal tool output to unblock” fallback and now surfaces the error if encountered.

Operational Notes
- After these changes, the first turn that emits tool calls will automatically execute tools and resume the response within the same overall call. The resulting response id is finalized only after the tool cycle completes, preventing lingering pending state.
- If there are older sessions already stuck in a pending tool-call state (from before this fix), a new user turn may still surface the 400 error once. This is now surfaced clearly instead of being silently “resolved” with dummy outputs. A simple re-ask or clearing the session will resolve those legacy cases.

Acceptance Checklist Mapping
- A) First quiz request: tool call → local tool runs → tool_outputs posted → model completes. Handled by auto-continuation on `response.completed`/`[DONE]`.
- B) Second message: previous turn fully closed; new response starts cleanly. No fabricated outputs; no pending tool calls remain.
- C) Multiple tool calls: aggregated and returned in one continuation in model order.
- D) Streaming path: correct event ordering; pause → tool → resume; final completion event emitted after continuation.
- E) Strict adherence to documented patterns; no alternative APIs or ad-hoc workarounds.

References
- `docs/OpenAI/FunctionCalling.md`: Tool calling flow, handling function calls, streaming function calls sections.
- `docs/OpenAI/Using tools.md`: Function tool definition shape and usage with Responses API.
