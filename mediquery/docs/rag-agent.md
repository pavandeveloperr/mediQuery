# Agentic RAG Engine — How the Query Pipeline Works

## What this is
"Agentic RAG" means the system doesn't just search once and answer. It retrieves chunks,
evaluates whether the results are confident enough, and if not, reformulates the query
using an LLM and searches again before generating a response. The whole thing streams
token-by-token back to the browser in real time via SSE (Server-Sent Events).

## Why we need it in MediQuery
A patient might ask "what drugs is the patient on?" but the document says "prescribed
medications". A single-shot retrieval system would miss this. The agentic loop detects
the low cosine similarity score (< 0.75) and asks Gemini to rewrite the query using
formal clinical language — "prescribed medications" — then searches again.

Without this, MediQuery would give confident-sounding wrong answers or blank responses
for any query that doesn't exactly match the words in the document.

---

## The full flow — every step with code

### Step 1 — Hook: user submits a question

```ts
// src/hooks/use-query-stream.ts
const handleSubmit = (question: string) => {
  // Immediately add both message cards so the UI responds without waiting
  setMessages((prev) => [...prev, userMsg, assistantMsg])
  void streamQuery(assistantId, question, selectedDocId)
}
```

The user message and an empty assistant message (with `isStreaming: true`) are added
to state before any network request fires. This is the same Optimistic UI pattern
as the document upload.

---

### Step 2 — Hook: open SSE connection

```ts
// src/hooks/use-query-stream.ts
const response = await fetch('/api/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question, documentId: docId }),
  signal: abort.signal,   // AbortController so navigation cleans up the stream
})

const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (streamingRef.current) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''  // keep incomplete line for next read()
  // ...
}
```

**Why buffer incomplete lines?** SSE data arrives as bytes. One `read()` call might
give you half a line (e.g., `data: {"tok`). The next `read()` brings the rest. By
splitting on `\n` and keeping the last fragment in `buffer`, we never parse a partial
JSON line.

**Why `AbortController`?** If the user navigates away or the component unmounts,
the `useEffect` cleanup calls `abort.abort()`, which cancels the in-flight fetch.
Without this, Gemini would keep streaming to a dead connection.

---

### Step 3 — Route: auth + validation → start stream

```ts
// src/app/api/query/route.ts
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return jsonError('Unauthorized', 401)

  // ... parse + validate body ...

  // Verify the document belongs to THIS user — prevents one user querying another's docs
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId: session.user.id },
  })
  if (!document) return jsonError('Document not found', 404)

  const stream = new ReadableStream({ async start(controller) { ... } })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',   // disable Nginx buffering behind a reverse proxy
    },
  })
}
```

**Why `ReadableStream` and not `NextResponse`?** `NextResponse.json()` buffers the
entire body in memory before sending. `ReadableStream` pushes bytes to the client as
they're produced — that's what makes streaming possible. The route returns a plain
`Response` (not `NextResponse`) because we need to control the raw headers.

**Why `X-Accel-Buffering: no`?** Nginx (used by Vercel and many hosts) buffers HTTP
responses to optimise throughput. Buffering SSE kills real-time streaming — you'd see
nothing for 5 seconds then all text at once. This header tells Nginx to pass bytes
through immediately.

---

### Step 4 — Agent: retrieve → check confidence → maybe reformulate

```ts
// src/lib/ai/agent.ts
export async function runAgent(
  question: string,
  documentId: string,
  onToken: (token: string) => void   // called for each streaming text chunk
): Promise<AgentResult>              // returns steps + citations + score when done
```

```ts
// Initial retrieval
const initial = await retrieveChunks(question, documentId)
// { chunks: MedicalChunk[], avgSimilarity: number }

if (initial.avgSimilarity < SIMILARITY_THRESHOLD) {  // 0.75
  // Ask Gemini to rewrite the query with clinical terminology
  const reformulated = await generateText(reformulationPrompt)
  // Retry with the new query
  const retry = await retrieveChunks(reformulated, documentId)
}

// Stream the answer using retrieved context
await streamGenerateText(answerPrompt, onToken)
```

Each `onToken` call fires `sendPayload({ token })` in the route, which writes
`data: {"token":"..."}\n\n` to the stream — that's one SSE event per token.

---

### Step 5 — Retrieval: pgvector cosine similarity

```ts
// src/lib/ai/retrieval.ts
const vector = await embedText(query)           // 768-dim float array
const vectorLiteral = `[${vector.join(',')}]`   // "[0.023,-0.187,...]"

const rows = await prisma.$queryRawUnsafe<RawChunkRow[]>(
  `SELECT
    id, content,
    chunk_index  AS "chunkIndex",
    document_id  AS "documentId",
    1 - (embedding <=> $1::vector) AS similarity
  FROM chunks
  WHERE document_id = $2 AND embedding IS NOT NULL
  ORDER BY embedding <=> $1::vector
  LIMIT $3`,
  vectorLiteral,   // $1 — reused in both SELECT and ORDER BY
  documentId,      // $2
  MAX_RETRIEVED_CHUNKS  // $3 (= 5)
)
```

`<=>` is pgvector's cosine distance operator. `1 - distance = similarity`.
`ORDER BY embedding <=> $1::vector` returns the most similar chunks first.

The `avgSimilarity` across the top 5 chunks is what the agent checks against
`SIMILARITY_THRESHOLD = 0.75`. If any individual chunk is very close but others
are noise, the average gives a more conservative confidence estimate.

---

### Step 6 — SSE event protocol

Three event types flow from server to client:

```
data: {"token":"The patient"}\n\n         ← one per streaming word/token
data: {"token":" is prescribed"}\n\n
...
data: {"token":"","confidenceScore":0.87,"citations":[...],"steps":[...]}\n\n  ← final metadata
data: [DONE]\n\n                            ← close signal
```

The hook reads each `data:` line and acts on it:
```ts
if (payload.token) {
  // Append token to the streaming message bubble
}
if (payload.citations !== undefined) {
  // This is the final event — update message with confidence + citations + steps
  setIsStreaming(false)
}
if (rawData === '[DONE]') {
  streamingRef.current = false  // exit the read loop
}
```

---

## The mental model

Think of it like a **medical librarian searching a filing cabinet**:

1. **First pass**: The librarian looks up the user's exact phrasing in the index.
   If they find 5 closely-matching index cards (similarity ≥ 0.75), they answer immediately.

2. **Reformulation**: If the search comes back weak (< 0.75), the librarian asks a doctor
   to rephrase the question in clinical language (e.g., "medications" instead of "drugs").
   Then they search again with the medical phrasing.

3. **Answering**: The librarian reads the 5 best index cards to a doctor (Gemini), who
   dictates a clinical summary — word by word — over the phone. That's the stream.

4. **Citation**: Each index card that was used is attached to the answer so the user can
   verify the source.

---

## What could go wrong

**1. Gemini rate limit (429) during reformulation**
`generateText` calls `gemini-1.5-pro` which has a 2 RPM limit on the free tier.
If two users query simultaneously within 60 seconds, the second gets a 429. The
`runAgent` try/catch re-throws this, the route catches it, and streams an error token.
The UI shows "An error occurred. Please try again." Fix: Upstash Redis rate limiting
(Phase 4) will prevent more than 20 queries/user/day before this becomes an issue.

**2. No chunks found (document still processing)**
If `retrieveChunks` returns 0 chunks, the agent records a `FAIL` step and streams
`"Information not found in the patient's medical timeline."` The user sees a clear
message rather than a blank or hallucinated response.

**3. SSE connection drops mid-stream**
If the network drops while streaming, `reader.read()` throws an `AbortError` (or the
loop exits via `done: true`). The `finally` block sets `isStreaming: false`, so the
streaming cursor (`▌`) disappears and the message shows what was received up to that point.

---

## Interview question you can now answer

**"What makes your RAG system 'agentic' rather than just basic retrieval-augmented generation?"**

In basic RAG, you embed the query, retrieve top-k chunks, and pass them to an LLM — one
shot, no feedback loop. Our system is agentic because it evaluates the confidence of the
retrieved results (average cosine similarity across 5 chunks) against a 0.75 threshold.
If confidence is too low, the agent invokes Gemini to reformulate the query using clinical
terminology, then retrieves again before generating an answer — a two-step reasoning loop
that the model itself drives rather than the user.

---

## Skills unlocked
- [x] AI/RAG: What makes RAG "agentic" — the confidence threshold and reformulation loop
- [x] AI/RAG: How cosine similarity drives retrieval confidence scoring
- [x] AI/RAG: Query reformulation — why clinical language matters for medical records
- [x] Next.js: SSE streaming with `ReadableStream` — why `Response` not `NextResponse`
- [x] Next.js: Why `X-Accel-Buffering: no` is essential for SSE behind proxies
- [x] TypeScript: `AbortController` pattern for cleaning up fetch streams on unmount
- [x] System design: SSE event buffering — why incomplete lines must be held in a buffer
- [x] Production: Fire-and-forget ingestion — why synchronous ingestion fails on Vercel
