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
- `AppShell` `simulateStream` → ⬜ Phase 3: replace with SSE fetch to `POST /api/query`
- `QueryWorkspace` `MOCK_CITATIONS` / `MOCK_AGENT_STEPS` → ⬜ Phase 3: arrive via SSE `RAGStreamPayload`

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