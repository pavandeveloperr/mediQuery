# MediQuery — Everything We've Built (Master Reference)

## What this is
A complete map of every feature, file, and architectural decision made so far.
Use this as your orientation guide before diving into any specific topic doc.

---

## The full picture — how the app works today

```
Browser                     Next.js Server              External Services
──────────────────────────────────────────────────────────────────────────
Landing page (/)
  └─ Google Sign In btn
       │
       ▼
  NextAuth OAuth flow ──────────────────────────────► Google OAuth
       │                                                     │
       │◄────────────────── JWT token + user profile ────────┘
       │
       ▼
  Prisma saves user ───────────────────────────────► Supabase PostgreSQL
  to DB (User, Account,                              (users, accounts,
   Session tables)                                    sessions tables)
       │
       ▼
Dashboard (/dashboard)
  └─ AppShell (3-panel layout)
       ├─ DocumentSidebar
       │    ├─ Lists documents (GET /api/documents) ──► DB query
       │    └─ Upload button
       │         │
       │         ▼
       │    useDocuments hook
       │    POST /api/documents/upload
       │         │
       │         ▼
       │    Validate file ─── PDF only, max 15MB
       │    Create DB record (status: processing)
       │    Extract text ───────────────────────────── pdf-parse library
       │    Chunk text (512 chars, 50 overlap)
       │    Embed each chunk ───────────────────────── Gemini API
       │    Store in pgvector ─────────────────────── Supabase PostgreSQL
       │    Update status: ready
       │         │
       │         ▼
       │    Return document to frontend
       │    Sidebar updates with new doc
       │
       ├─ QueryWorkspace
       │    └─ [Phase 3 - not yet real]
       │       Currently shows mock streaming response
       │
       └─ SourceCitations
            └─ [Phase 3 - not yet real]
               Currently shows mock citation chunks
```

---

## Feature status — what's done vs what's next

| Feature | Status | Where to learn more |
|---|---|---|
| Landing page + login UI | ✅ Done | — |
| Google OAuth with NextAuth | ✅ Done | `docs/nextauth-google-oauth.md` |
| Protected dashboard route | ✅ Done | `docs/nextauth-google-oauth.md` |
| PDF upload + validation | ✅ Done | `docs/document-upload-pipeline.md` |
| PDF text extraction | ✅ Done | `docs/document-upload-pipeline.md` |
| Text chunking (512 chars) | ✅ Done | `docs/document-upload-pipeline.md` |
| Gemini embeddings | ✅ Done | `docs/document-upload-pipeline.md` |
| pgvector storage | ✅ Done | `docs/document-upload-pipeline.md` |
| Document list (GET /api/documents) | ✅ Done | — |
| Skeleton loading state | ✅ Done | — |
| 3-panel dashboard UI | ✅ Done | — |
| Custom hooks (useDocuments, useQueryStream) | ✅ Done | — |
| Constants + env config | ✅ Done | — |
| RAG retrieval (cosine similarity search) | ❌ Phase 3 | — |
| Agentic query loop | ❌ Phase 3 | — |
| Real streaming responses | ❌ Phase 3 | — |
| Rate limiting (Upstash Redis) | ❌ Phase 4 | — |
| Query history persistence | ❌ Phase 4 | — |
| Document deletion | ❌ Planned | — |

---

## Folder structure — what lives where and why

```
src/
├── app/
│   ├── page.tsx                  → Landing page (Server Component, no auth needed)
│   ├── dashboard/page.tsx        → Protected dashboard (checks session server-side)
│   ├── providers.tsx             → Wraps app in SessionProvider (client component)
│   └── api/
│       ├── auth/[...nextauth]/   → NextAuth catch-all route handler
│       └── documents/
│           ├── route.ts          → GET: list user's documents
│           └── upload/route.ts   → POST: validate + ingest a PDF
│
├── components/
│   ├── ui/
│   │   ├── Skeleton.tsx          → Shimmer loading primitives (DocumentCardSkeleton etc.)
│   │   ├── ConfidenceBadge.tsx   → HIGH/MEDIUM/LOW badge with colour coding
│   │   └── AgentStepTrace.tsx    → Collapsible agent reasoning display
│   └── features/
│       ├── AppShell.tsx          → Main layout, composes the 3 panels, uses hooks
│       ├── DocumentSidebar.tsx   → Left panel: document list + upload button
│       ├── QueryWorkspace.tsx    → Centre panel: chat messages + input bar
│       ├── SourceCitations.tsx   → Right panel: retrieved chunk cards
│       └── LoginForm.tsx         → Google sign-in button on landing page
│
├── hooks/
│   ├── use-documents.ts          → Fetch, poll, upload, select document state
│   └── use-query-stream.ts       → Messages, citations, streaming state (mock for now)
│
├── lib/
│   ├── ai/
│   │   ├── gemini.ts             → Gemini client singleton (generation + embedding models)
│   │   ├── chunker.ts            → Split raw text into overlapping chunks
│   │   ├── embeddings.ts         → Embed chunks + write to pgvector
│   │   └── ingest.ts             → Orchestrates: pdf → chunks → embed → DB
│   ├── auth/auth.ts              → NextAuth config (providers, callbacks, adapter)
│   ├── db/prisma.ts              → Prisma client singleton
│   ├── fixtures/query-mock.ts    → Phase 3 placeholder mock data (delete when real)
│   └── utils/
│       ├── pdf.ts                → Wraps pdf-parse: buffer → {text, pageCount}
│       └── string.ts             → truncateDocumentName pure utility
│
├── config/env.ts                 → Validates all env vars at startup, exports typed object
├── constants/
│   ├── ai.ts                     → Model names, dimensions, batch sizes, thresholds
│   ├── documents.ts              → Statuses, file limits, poll interval
│   └── ui.ts                     → All label strings, suggested questions
└── types/index.ts                → Shared TypeScript interfaces (UIDocument, UIMessage etc.)
```

---

## Key architectural decisions made (and why)

### 1. Synchronous document ingestion
The upload API waits for the full pipeline (parse → chunk → embed → store) to finish
before responding. This means uploads take 5–30 seconds depending on PDF size.

**Why not async (fire and forget)?**
We tried fire-and-forget first. The problem: if embedding failed, status was silently
set to "failed" with no error surfaced to the UI. Synchronous processing means the
real error message comes back in the HTTP response as a 422, and the user knows exactly
what went wrong.

### 2. Custom hooks over component state
All document fetching/upload logic lives in `useDocuments`. All streaming/message
logic lives in `useQueryStream`. AppShell just composes them.

**Why?** When AppShell had everything inline it was 294 lines mixing 3 concerns.
Hooks make the logic testable in isolation and the component readable in one screen.

### 3. Constants files, no hardcoded strings
Every string (`'ready'`, `'processing'`) and number (`512`, `50`, `768`) lives in
`src/constants/`. Components import the constant name, not the literal.

**Why?** When we needed to change the embedding dimension from 3072 back to 768,
we changed it in one place (`EMBEDDING_DIMENSIONS` in `constants/ai.ts`) and
every file that references it updated automatically.

### 4. `$executeRawUnsafe` for pgvector writes
Prisma doesn't support pgvector natively. We write embeddings with raw SQL.

**Why not `$executeRaw` tagged template?** Earlier investigation showed Prisma's
tagged template version can silently mangle the `::vector` type cast in some
versions, causing silent failures. `$executeRawUnsafe` gives explicit control.

### 5. Matryoshka embeddings at 768 dims
`gemini-embedding-001` can produce 3072-dim vectors by default, but our DB column
is `vector(768)`. We pass `outputDimensionality: 768` to get 768-dim vectors.

**Why not resize the DB column?** pgvector's `ivfflat` and `hnsw` indexes both
have a 2000-dimension limit in our Supabase version. 768 is safe, 3072 is not.
