# MediQuery — Canonical System Reference & Code Contracts

Use this document as the single source of truth for global data shapes, schema signatures, and contract systems across the codebase.

## 0. Completed Implementation Status

### Phase 2 — Ingestion Logic & Deep AI Layer
| Task | File | Status | Notes |
|------|------|--------|-------|
| 2.1 | `src/lib/ai/gemini.ts` | ✅ Done | Exports `geminiModel` (gemini-1.5-pro) and `embeddingModel` (text-embedding-004) singletons; `embedText`, `generateText`, `streamGenerateText` helpers; 768-dim validation on embed |
| 2.2 | `src/lib/ai/chunker.ts` | ✅ Done | `extractChunks` (512-char window, 50-char overlap), `validateChunks`, `ChunkWithEmbedding` interface |
| 2.3 | `src/lib/ai/embeddings.ts` | ✅ Done | `embedAndStoreChunks` — batches 5 chunks in parallel; Prisma create + `$executeRaw` vector cast |
| 2.4 | `src/lib/utils/pdf.ts` | ✅ Done | `extractPDFText(buffer)` via pdf-parse@1.1.1; returns `{ text, pageCount }` |
| 2.5 | `src/app/api/documents/upload/route.ts` | ✅ Done | POST FormData → create Document (processing) → fire-and-forget processDocument → return 202 |
| 2.5+ | `src/app/api/documents/route.ts` | ✅ Done | GET → returns user's documents as `UIDocument[]` |

### Phase 4 — Interface Components (built ahead of Phase 3 for portfolio)
| Task | File | Status | Notes |
|------|------|--------|-------|
| UI | `src/types/index.ts` | ✅ Done | Added `MedicalChunk`, `AgentStep`, `RAGStreamPayload`, `UIDocument`, `UIMessage`, `DocumentStatus`, `MessageRole` |
| UI | `src/components/ui/ConfidenceBadge.tsx` | ✅ Done | HIGH ≥0.85 (emerald), MEDIUM 0.70–0.85 (amber), LOW <0.70 (rose); `showScore` and `size` props |
| UI | `src/components/ui/AgentStepTrace.tsx` | ✅ Done | Collapsible accordion; RETRIEVE/REFORMULATE/ANSWER/FAIL action chips with ConfidenceBadge |
| UI | `src/components/features/DocumentSidebar.tsx` | ✅ Done | 280px left panel; status dots (pulse=processing, solid=ready/failed); upload trigger via hidden file input |
| UI | `src/components/features/SourceCitations.tsx` | ✅ Done | 320px right panel; citation cards with chunk index + similarity score + content excerpt |
| UI | `src/components/features/QueryWorkspace.tsx` | ✅ Done | Center panel; empty state + suggested questions; word-by-word streaming with ▌ cursor; MessageBubble for user/assistant |
| UI | `src/components/features/AppShell.tsx` | ✅ Done | Three-panel shell; manages all state; mock stream (35–90ms/word); upload simulation (3s processing→ready) |
| UI | `src/app/dashboard/page.tsx` | ✅ Done | Server component; passes session fields to AppShell; `h-screen overflow-hidden` root |

### Mock-to-real replacement points (Phase 3 hookup)
- `AppShell` `INITIAL_DOCUMENTS` → ✅ replaced with `GET /api/documents` on mount + 3s polling for processing docs
- `AppShell` `handleUploadFile` → ✅ replaced with FormData `POST /api/documents/upload` + optimistic UI
- `AppShell` `simulateStream` → ✅ replaced with SSE fetch to `POST /api/query`
- `QueryWorkspace` `MOCK_CITATIONS` / `MOCK_AGENT_STEPS` → ✅ arrive via SSE `RAGStreamPayload`

---

### Production Polish & Bug Fixes (commit e77d72b — 2026-05-18)

| Area | What changed | File(s) |
|------|-------------|---------|
| **Gemini 429 handling** | `RateLimitError` class + `isGemini429` + `withRetry` added to `gemini.ts`. `generateText` (reformulation) retries once with delay from error body. `streamGenerateText` fails fast and throws `RateLimitError` immediately — no retry on the user-facing stream path. | `src/lib/ai/gemini.ts` |
| **Silent stream failure** | Route catch block was calling `sendDone()` with no message. Now sends `sendPayload({ token: '', error: message })` first so the frontend always receives something. | `src/app/api/query/route.ts` |
| **Frozen blinking cursor** | `UIMessage.isStreaming` was only cleared on `payload.citations` arrival. `finally` block in hook now clears it unconditionally on any exit path. `payload.error` handler also sets `isStreaming: false`. | `src/hooks/use-query-stream.ts` |
| **Quota chip on load** | Chip was `null` until after first successful query. New `GET /api/query/quota` endpoint counts Prisma rows (no Redis side-effect); hook fetches it on mount via `useEffect([], [])`. | `src/app/api/query/quota/route.ts`, `src/hooks/use-query-stream.ts` |
| **Global rate limit** | Redis limiter was per-user (`userId` key) but the Gemini API key is a shared global pool. Switched to `GLOBAL_RATE_LIMIT_KEY = 'global'` so all users draw from one 20/day bucket. Quota display also counts all users. | `src/app/api/query/route.ts`, `src/app/api/query/quota/route.ts` |
| **UI** | Email moved from navbar to DocumentSidebar bottom section, displayed beneath the username. | `src/components/features/AppShell.tsx`, `src/components/features/DocumentSidebar.tsx` |
| **Constants** | Added `DAILY_QUERY_LIMIT`, `GLOBAL_RATE_LIMIT_KEY`, `GEMINI_RATE_LIMIT_MAX_RETRIES`, `GEMINI_RATE_LIMIT_FALLBACK_DELAY_MS` — no more magic numbers scattered across files. | `src/constants/ai.ts` |
| **Types** | Added `error?: string` to `RAGStreamPayload` — dedicated channel for backend errors through the SSE stream. | `src/types/index.ts` |

#### Key architectural decisions made
- **Redis = hard enforcement (global), Prisma = display only.** Redis blocks the request before Gemini is called. Prisma counts rows for the chip — read-only, no rate-limit side effects.
- **`withRetry` only on `generateText`, not `streamGenerateText`.** Retrying a user-facing stream would show a frozen UI for 10+ seconds. Background reformulation can afford a short wait.
- **Error message controlled at the API boundary (`route.ts`), not in `gemini.ts`.** The `RateLimitError` message in `gemini.ts` is for server logs; the customer-facing copy lives in `route.ts` where it can be changed without touching AI logic.

---

---

### Code Quality Refactor (commit 060f4a8 — 2026-05-19) — DEPLOYED

| Area | What changed | File(s) |
|------|-------------|---------|
| **Hook split** | `useQueryStream` was doing four unrelated things (history loading, quota fetching, SSE streaming, citation state). Split into three focused hooks composed cleanly. | `src/hooks/use-query-history.ts` (new), `src/hooks/use-query-quota.ts` (new), `src/hooks/use-query-stream.ts` (slimmed) |
| **Nav extraction** | Inline `<nav>` block lifted out of `AppShell` into a dedicated component with its own `QuotaChip` sub-component. | `src/components/features/DashboardNav.tsx` (new), `src/components/features/AppShell.tsx` |
| **Prompt extraction** | Prompt strings were tangled with orchestration logic in `agent.ts`. Moved to pure builder functions in a dedicated module — prepares for future prompt additions (evaluation, summarization). | `src/lib/ai/prompts.ts` (new), `src/lib/ai/agent.ts` |
| **Agent helper** | Added `makeStep()` factory in `agent.ts` — eliminates five duplicated `AgentStep` object constructions. | `src/lib/ai/agent.ts` |
| **Route constants** | All API and page paths centralized — no more hardcoded strings like `/api/query` scattered in components/hooks. | `src/constants/routes.ts` (new), all consumers |
| **Type ownership** | `QueryHistoryItem` moved from API route to `src/types/index.ts` — the route and consuming hook now share one definition. | `src/types/index.ts`, `src/app/api/queries/route.ts` |
| **UI labels** | All hardcoded UI strings (sign-out modal copy, error toasts, quota tooltip) moved to `UI_LABELS`. `AppShell` has zero string literals in JSX. | `src/constants/ui.ts`, `src/components/features/AppShell.tsx` |

**Net result:** 339 insertions, 247 deletions — the refactor shrank total code while adding structure. `AppShell.tsx` dropped from 137 → 114 lines with stricter separation of concerns.

---

### Phase 5: LLM-as-Judge Faithfulness Scoring + Real-Time Agent Trace (uncommitted — 2026-05-20)

**Problem solved:** confidence scores were stuck at 70–72% even on accurate answers because the score was just `avgSimilarity` from retrieval — and cosine similarity on clinical text rarely exceeds 0.85 even for perfectly relevant chunks. Conflated retrieval quality with answer quality.

**Architecture change:** confidence is now a composite of three signals.

| Signal | Weight | What it measures | Source |
|--------|--------|------------------|--------|
| Retrieval similarity | 20% | "Did we find relevant chunks?" | Cosine similarity from `retrieveChunks` |
| Groundedness | 55% | "Is every claim in the answer supported by the chunks?" | LLM-as-judge (Gemini) |
| Completeness | 25% | "Does the answer fully address the question?" | LLM-as-judge (Gemini) |

| Area | What changed | File(s) |
|------|-------------|---------|
| **New AI module** | `evaluateAnswer(question, answer, chunks)` returns `{ groundedness, completeness }`. Parses Gemini's JSON output defensively (tolerates code fences / surrounding prose), clamps to [0,1], falls back to neutral 0.7/0.7 on parse failure so user flow never breaks. | `src/lib/ai/evaluation.ts` (new) |
| **Evaluation prompt** | Strict clinical RAG evaluator prompt — returns single-line JSON `{"groundedness":0.00,"completeness":0.00}`. Returns 1.0 groundedness + 0.0 completeness for the `NOT_FOUND_MESSAGE` (correct refusal). | `src/lib/ai/prompts.ts` |
| **Agent flow** | `runAgent` now runs evaluation after answer streams complete. Composite score replaces the single-similarity assignment. New EVALUATE step is pushed to the trace. | `src/lib/ai/agent.ts` |
| **Step union** | `AgentStep.action` extended with `'EVALUATE'`. Violet chip + `Evaluate` label in the trace UI. | `src/types/index.ts`, `src/components/ui/AgentStepTrace.tsx` |
| **Real-time step streaming** | Agent steps are now streamed individually via SSE as they happen (new `step?: AgentStep` field on `RAGStreamPayload`). Frontend appends to `message.agentSteps` as each event arrives instead of receiving them all at once at the end. | `src/types/index.ts`, `src/app/api/query/route.ts`, `src/lib/ai/agent.ts`, `src/hooks/use-query-stream.ts` |
| **Live thinking indicator** | While answer is waiting (`isStreaming && content === ''`), the bubble shows the latest step's `thought` with a pulsing Sparkles icon instead of an empty blinking cursor. Once tokens start arriving, it's replaced by the streaming answer + cursor as before. | `src/components/features/QueryWorkspace.tsx` (new `AgentThinkingIndicator`) |
| **Agent callback contract** | `runAgent` signature changed from `runAgent(question, documentId, onToken)` to `runAgent(question, documentId, { onToken, onStep })` — cleaner contract, room for future callbacks without breaking changes. | `src/lib/ai/agent.ts`, `src/app/api/query/route.ts` |
| **Confidence badge** | Thresholds unchanged (HIGH ≥0.85, MEDIUM ≥0.70, LOW <0.70) — the *score* was the broken signal, not the bands. Added per-level tooltip explaining what the score means. | `src/components/ui/ConfidenceBadge.tsx` |
| **Constants** | New `CONFIDENCE_WEIGHT_RETRIEVAL` (0.2), `CONFIDENCE_WEIGHT_GROUNDEDNESS` (0.55), `CONFIDENCE_WEIGHT_COMPLETENESS` (0.25). New `UI_LABELS.AGENT_THINKING` for the pre-step placeholder. | `src/constants/ai.ts`, `src/constants/ui.ts` |

#### Key architectural decisions made

- **One extra Gemini call per query is worth it.** Adding `evaluateAnswer` increases cost ~15–25% per query but raises confidence calibration accuracy substantially — well-grounded answers now naturally cross 0.85 instead of capping at the embedding ceiling.
- **Evaluator failures degrade gracefully.** If the LLM judge call fails or returns malformed JSON, we fall back to neutral 0.7/0.7 scores. The user-facing answer has already streamed by the time evaluation runs — never sacrifice the user flow for a confidence signal.
- **Final SSE payload no longer re-sends the steps array.** Steps are streamed individually via `payload.step` events; the frontend builds `agentSteps` incrementally. The terminal payload only carries `citations`, `confidenceScore`, and `remainingQueries`.
- **Step thought as live status text.** This replaces the "empty bubble + cursor" feel with a visibly working agent — every reformulation and retrieval is surfaced to the user as it happens, not buried in a collapsed trace at the end.

---

## 1. Database Model Interface Contracts (Prisma)
When querying or writing data structures, your fields must exactly align with these table configurations:

*   **User**: `id (String, PK)`, `email (String, Unique)`, `name (String?)`, `image (String?)`
*   **Document**: `id (String, PK)`, `name (String)`, `storagePath (String)`, `status (String)`, `userId (String, FK)`
*   **Chunk**: 
    *   `id`: String (Cuid wrapper)
    *   `content`: String (Raw document segment text)
    *   `chunkIndex`: Int (Sequence tracking for downstream citations)
    *   `embedding`: Unsupported("vector(768)") (Gemini output target matrix)
    *   `documentId`: String (FK referencing parent file block)
*   **Query**: `id`, `question`, `answer`, `confidence (Float)`, `tokenCount (Int)`, `costUsd (Float)`, `agentSteps (Json)`, `sources (Json)`

## 2. Core System Types (`src/types/index.ts`)
```typescript
export interface MedicalChunk {
  id: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  similarity?: number;
}

export interface AgentStep {
  thought: string;
  action: "RETRIEVE" | "REFORMULATE" | "ANSWER" | "FAIL";
  queryUsed: string;
  scoreAchieved?: number;
  timestamp: string;
}

export interface RAGStreamPayload {
  token: string;
  confidenceScore?: number;
  citations?: MedicalChunk[];
  steps?: AgentStep[];
}