# MediQuery — Engineering Implementation Blueprint

This checklist defines the chronological execution flow for constructing MediQuery. Complete each step completely before initiating subsequent tasks.

## Phase 1: Database & Identity Core (Completed)
- [x] Provision Supabase PostgreSQL instance and enable the `vector` extension.
- [x] Configure `schema.prisma` with preview features activated for `postgresqlExtensions`.
- [x] Model `User`, `Document`, `Chunk`, and `Query` models, defining `embedding Unsupported("vector(768)")?`.
- [x] Run Prisma migration workflows (`prisma migrate dev`).
- [x] Configure NextAuth.js structure utilizing Google OAuth 2.0 configuration handles.
- [x] Implement global application path locking via edge-compatible `src/middleware.ts`.

## Phase 2: Ingestion Logic & Deep AI Layer (Current Focus)
- [ ] **Task 2.1**: Implement the Gemini core connection client factory at `src/lib/ai/gemini.ts`. Export singletons for `geminiModel` ("gemini-1.5-pro") and `embeddingModel` ("text-embedding-004").
- [ ] **Task 2.2**: Build the clinical document sliding-window parsing module at `src/lib/ai/chunker.ts` using strict 512-character limits and 50-character padding boundaries.
- [ ] **Task 2.3**: Build the vector generation module at `src/lib/ai/embeddings.ts` to convert text segments into 768-dimension floating-point arrays.
- [ ] **Task 2.4**: Create the file text parser wrapper at `src/lib/utils/pdf.ts` mapping incoming file stream blocks to string sequences using `pdf-parse`.
- [ ] **Task 2.5**: Construct the backend orchestration endpoint at `src/app/api/documents/process/route.ts` downloading records from storage, splitting, vectors indexing, and writing to PostgreSQL.

## Phase 3: The Agentic RAG Engine
- [ ] **Task 3.1**: Develop the vector execution query handler at `src/lib/ai/retrieval.ts` executing raw similarity calculations matching incoming target dimensions.
- [ ] **Task 3.2**: Implement the iterative reasoning engine loop at `src/lib/ai/agent.ts` executing threshold validation (0.75), automatic prompt reformulation, and grounding assertions.
- [ ] **Task 3.3**: Create the unified orchestration API route at `src/app/api/query/route.ts` configuring rate limits via Upstash Redis token buckets, validating context, and initializing server-sent chunk streaming.

## Phase 4: Interface Components & Streaming Delivery
- [ ] **Task 4.1**: Create the feature dashboard view file `src/app/dashboard/page.tsx` mapping structural summaries and presenting user file states.
- [ ] **Task 4.2**: Complete the `FileUpload.tsx` drag-and-drop zone managing transmission directly into backend ingestion lines.
- [ ] **Task 4.3**: Implement the streaming response client interface component `QueryBox.tsx` translating runtime data pieces cleanly into text blocks.
- [ ] **Task 4.4**: Build visual trace components `SourceCitations.tsx` and `ConfidenceBadge.tsx` displaying exact retrieval attributes cleanly.