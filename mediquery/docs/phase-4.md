# Phase 4 — Document Management, Rate Limiting & Query Persistence

## What this is
Phase 4 adds the production-readiness layer on top of the working RAG engine from Phase 3. It covers: deleting documents cleanly from the database, protecting the query endpoint with a Redis-backed rate limiter, persisting every Q&A to PostgreSQL for history replay, and surfacing the user's remaining daily quota in the UI.

---

## Feature 1 — Document Deletion

### Why we need it
Users upload test documents and need to remove them. Without deletion, bad uploads (wrong file, failed processing) pile up in the sidebar forever.

### The code — what each part does

```ts
// DELETE /api/documents/[id]/route.ts
const document = await prisma.document.findFirst({
  where: { id, userId: session.user.id }, // ownership check before delete
})
await prisma.document.delete({ where: { id } })
```

The ownership check (`userId: session.user.id`) prevents any authenticated user from deleting someone else's document by guessing an ID. Prisma's `onDelete: Cascade` on the `Chunk` model means every chunk row for that document is deleted automatically by PostgreSQL in the same transaction — no extra application code needed.

**Optimistic UI** — the document is removed from React state *before* the API call returns. If the call fails, `fetchDocuments()` is called to restore the real server state. This keeps the UI feeling fast.

### The mental model
Think of `onDelete: Cascade` like a folder on your desktop. When you delete the folder, all files inside it disappear too — you don't have to delete each file first.

### What could go wrong
- **User deletes someone else's doc**: blocked by the `userId` ownership check → 404
- **Network failure after optimistic remove**: caught by the `catch` block → `fetchDocuments()` restores the list
- **Cascade not configured**: chunks would be orphaned in the DB, wasting storage and poisoning future similarity searches with stale vectors

---

## Feature 2 — Upstash Redis Rate Limiting

### Why we need it
The free Gemini API has a strict quota. Without a gate, one user could exhaust the entire daily allowance, breaking the app for everyone else. 20 queries per user per 24-hour sliding window is the limit.

### The code — what each part does

```ts
// src/lib/cache/rate-limit.ts
export const queryRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '24 h'),
  prefix: 'mediquery:query',
})
```

```ts
// POST /api/query — runs before any AI call
const { success, remaining, reset } = await queryRateLimit.limit(session.user.id)
if (!success) {
  return new Response(JSON.stringify({ error: 'Daily query limit reached', remaining, resetsAt }), { status: 429 })
}
```

**Sliding window vs fixed window**: A fixed window resets at midnight, so a user could do 20 queries at 11:59pm and 20 more at 12:00am — 40 in two minutes. A sliding window tracks the last 24 hours from *now*, so the limit is truly 20 per day regardless of when they query.

**Why Redis and not the database**: Redis responds in ~5ms vs ~50ms for a Postgres query. Rate limiting runs on every single request, so the speed difference matters. Redis also handles atomic increment-and-check natively, preventing race conditions where two simultaneous requests both see `remaining: 1` and both succeed.

### The mental model
Redis acts like a token bucket with 20 tokens that refill one at a time over 24 hours. Every query costs one token. When the bucket is empty, the door is locked until enough tokens refill.

### What could go wrong
- **Upstash down**: the `queryRateLimit.limit()` call throws → caught by the outer `try/catch` → 500 error. TODO: add a fallback that allows the request if Redis is unreachable (fail-open pattern), to avoid Redis becoming a single point of failure.
- **User bypasses with multiple accounts**: rate limiting is per `userId`, so each Google account gets its own bucket. This is acceptable for a demo.
- **Clock skew**: `reset` is an absolute timestamp from Upstash. Displayed to the user as `resetsAt` so they know exactly when their quota refills.

---

## Feature 3 — Query Persistence

### Why we need it
Without saving queries, every page refresh wipes the entire chat history. A medical professional reviewing documents needs to see their previous questions and answers.

### The code — what each part does

```ts
// POST /api/query — after agent finishes streaming
let fullAnswer = ''
const result = await runAgent(question, documentId, (token) => {
  fullAnswer += token   // accumulate tokens as they stream
  sendPayload({ token })
})

await prisma.query.create({
  data: {
    question,
    answer: fullAnswer,   // the complete assembled answer
    confidence: result.confidenceScore,
    agentSteps: result.steps as unknown as object[],
    sources: result.citations as unknown as object[],
    userId,
    documentId,
    // TODO: tokenCount and costUsd — implement token counting in a future pass
  },
})
```

The `as unknown as object[]` cast is required because Prisma's `Json` column type uses a union (`JsonValue`) that TypeScript cannot directly verify against our typed interfaces (`AgentStep[]`, `MedicalChunk[]`). Casting through `unknown` explicitly tells TypeScript "I know what shape this is at runtime."

### The mental model
Streaming and saving are independent concerns. The stream sends each token to the browser as it arrives. Meanwhile the server is also silently building up `fullAnswer` in memory. After the agent finishes, the complete text is written to Postgres once.

### What could go wrong
- **Agent throws after partial stream**: the `catch` block sends an error token to the client, but `prisma.query.create` is never called — so only successful queries are persisted. This is correct behaviour.
- **Large answers**: a very long answer could use significant Postgres storage. Acceptable for a demo; production would add a character limit or compression.

---

## Feature 4 — Query History Replay

### Why we need it
When a user selects a document, they should see their previous conversation — not a blank chat. This is the difference between a useful tool and a throwaway demo.

### The code — what each part does

```ts
// useQueryStream — runs when selectedDocId changes
useEffect(() => {
  async function loadHistory() {
    const res = await fetch(`/api/queries?documentId=${selectedDocId}`)
    const items: QueryHistoryItem[] = await res.json()

    // Each DB record becomes two UIMessage entries: one user bubble, one assistant bubble
    const hydrated: UIMessage[] = items.flatMap((item) => [
      { id: `${item.id}-user`, role: 'user', content: item.question, ... },
      { id: `${item.id}-assistant`, role: 'assistant', content: item.answer, ... },
    ])

    setMessages(hydrated)
  }
  void loadHistory()
}, [selectedDocId])
```

`flatMap` is key here — each database query record produces *two* UI messages (user + assistant). `flatMap` maps and flattens in one step, which is more readable than `map(...).flat()`.

### The mental model
The database stores the "transcript" as structured records. The hook "hydrates" those records back into the same `UIMessage` shape the streaming path uses — so the rendering component (`QueryWorkspace`) doesn't need to know whether a message came from a live stream or from history.

---

## Feature 5 — Remaining Queries Chip

### Why we need it
Users should know they're running low *before* they hit the 429 wall, not after. A small chip in the nav showing "18 / 20 left" sets expectations clearly.

### The code — what each part does

```ts
// RAGStreamPayload now includes:
remainingQueries?: number

// Sent in the final SSE metadata event after agent completes:
sendPayload({ ..., remainingQueries: remaining })

// AppShell nav renders:
{remainingQueries !== null && (
  <span className={remainingQueries <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}>
    {remainingQueries} / 20 left
  </span>
)}
```

The chip only appears after the first successful query completes (when `remainingQueries` transitions from `null` to a number). This avoids showing a stale "20 / 20" on first load before any queries have been made.

The chip turns red when 5 or fewer queries remain — a visual warning before the limit is hit.

---

## Interview questions you can now answer

**Q: Why use Redis for rate limiting instead of a database counter?**
Redis handles atomic increments natively and responds in ~5ms — 10x faster than Postgres. Rate limiting runs on every request, so the latency compounds. Redis also avoids race conditions where two simultaneous requests both read the same counter before either increments it.

**Q: What's the difference between a sliding window and a fixed window rate limiter?**
A fixed window resets at a scheduled time (e.g. midnight), letting users exploit the boundary by querying at 11:59pm and 12:00am. A sliding window tracks the last N hours from *now*, so the limit is enforced uniformly regardless of timing.

**Q: Why does your app persist queries to PostgreSQL if Redis already tracks the count?**
They serve different purposes. Redis is a fast ephemeral counter — it only knows *how many* queries happened. PostgreSQL stores the full Q&A content, citations, confidence scores, and agent trace for history replay and auditing. Neither can replace the other.

## Skills unlocked
- [x] Optimistic UI with rollback on failure
- [x] Cascade deletes in Prisma / PostgreSQL
- [x] Redis sliding window rate limiting (Upstash)
- [x] Token accumulation during SSE streaming
- [x] Persisting structured JSON data in Prisma Json columns
- [x] `flatMap` for hydrating DB records into UI shapes
- [x] Passing metadata through SSE final events
- [x] TypeScript: casting through `unknown` for Prisma Json columns
