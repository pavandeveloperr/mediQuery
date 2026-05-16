# Document Upload Pipeline — End-to-End

## What this is
When a user clicks "Upload PDF", a chain of 6 operations fires in sequence:
file validation → database record creation → PDF text extraction → text chunking →
vector embedding → pgvector storage. Only when all six succeed does the document
show as "ready" in the sidebar.

## Why we need it in MediQuery
The entire product depends on this pipeline. A document that isn't properly
chunked and embedded cannot be searched. The pipeline must be reliable,
error-visible, and produce well-formed vectors — otherwise every query against
that document returns garbage.

---

## The full flow — every step with code

### Step 1 — Frontend: user picks a file

```tsx
// src/components/features/DocumentSidebar.tsx
function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (file && file.type === ACCEPTED_MIME_TYPE) {  // 'application/pdf'
    onUploadFile(file)   // calls handleUploadFile in useDocuments hook
  }
}
```

The file input is hidden (`className="sr-only"`). The visible "Upload PDF" button
triggers `fileInputRef.current?.click()` — a common pattern to style file inputs.

---

### Step 2 — Hook: show optimistic UI + POST to API

```ts
// src/hooks/use-documents.ts
const handleUploadFile = useCallback(async (file: File) => {
  // Immediately add a placeholder card with status "processing"
  // so the user sees feedback BEFORE the server responds
  const tempId = `temp-${Date.now()}`
  setDocuments((prev) => [
    { id: tempId, name: file.name, status: 'processing', uploadedAt: today },
    ...prev,
  ])

  const form = new FormData()
  form.append('file', file)

  const res = await fetch('/api/documents/upload', { method: 'POST', body: form })

  if (!res.ok) {
    // Replace the placeholder card with a failed state
    setDocuments((prev) =>
      prev.map((d) => d.id === tempId ? { ...d, status: 'failed' } : d)
    )
    return
  }

  // Replace placeholder with real document from DB
  const doc = await res.json()
  setDocuments((prev) => [
    { id: doc.id, name: doc.name, status: 'ready', ... },
    ...prev.filter((d) => d.id !== tempId),
  ])
}, [])
```

**Optimistic UI**: we don't wait for the server. We add the card immediately with
"processing" status. If it fails, we update it to "failed". If it succeeds, we
swap the temp card for the real DB record. The user always sees immediate feedback.

---

### Step 3 — API route: validate + create DB record

```ts
// src/app/api/documents/upload/route.ts
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return 401

  const file = formData.get('file')

  // Validation — fail fast before touching the DB
  if (!(file instanceof File))            return 400 // no file sent
  if (file.type !== ACCEPTED_MIME_TYPE)   return 400 // not a PDF
  if (file.size > MAX_FILE_SIZE_BYTES)    return 400 // > 15MB

  // Create the DB record NOW, before processing
  // This gives us an ID to attach chunks to
  const document = await prisma.document.create({
    data: {
      name: file.name,
      status: DOCUMENT_STATUS.PROCESSING,  // 'processing'
      userId: session.user.id,
    },
  })

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await ingestDocument(document.id, buffer)
  } catch (processingError) {
    // Update status to 'failed' and return the real error message
    await prisma.document.update({ data: { status: 'failed' } })
    return 422 with actual error message
  }

  return 200 with complete document object
}
```

**Key decision**: we create the DB record BEFORE calling `ingestDocument`. Why?
If we created it after, a crash mid-ingestion would leave no record in DB at all.
Creating it first means we always have an ID to attach chunks to and a row we
can update to "failed" if something goes wrong.

---

### Step 4 — Ingestion orchestrator

```ts
// src/lib/ai/ingest.ts
export async function ingestDocument(documentId: string, buffer: Buffer): Promise<void> {
  const { text, pageCount } = await extractPDFText(buffer)  // Step 5
  const chunks = extractChunks(text)                         // Step 6
  if (!validateChunks(chunks)) {
    throw new Error('No usable text segments could be extracted from this PDF')
  }
  await embedAndStoreChunks(chunks, documentId)              // Steps 7+8
  await prisma.document.update({
    where: { id: documentId },
    data: { status: DOCUMENT_STATUS.READY, pageCount },
  })
}
```

This function is the conductor — it calls the four sub-operations in order.
If ANY step throws, the error bubbles up to the route handler which marks
the document as "failed" and returns the real error to the frontend.

---

### Step 5 — PDF text extraction

```ts
// src/lib/utils/pdf.ts
import pdfParse from 'pdf-parse'

export async function extractPDFText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const result = await pdfParse(buffer)  // parses the binary PDF into text
  const text = result.text.trim()

  if (!text) {
    // Scanned/image-based PDFs have no extractable text
    throw new Error('No text content found in the PDF — the file may be scanned or image-based')
  }

  return { text, pageCount: result.numpages }
}
```

`pdf-parse` reads the binary PDF buffer and extracts all text content. It returns
`result.text` (the raw string) and `result.numpages` (total page count). The
`pageCount` is stored in the DB and shown as "3p" in the sidebar.

**Note**: `pdf-parse` only works on text-based PDFs. Scanned documents (images of
pages) return empty text — those would need OCR (a future enhancement).

---

### Step 6 — Text chunking

```ts
// src/lib/ai/chunker.ts
const CHUNK_SIZE_CHARS = 512   // each chunk is 512 characters
const CHUNK_OVERLAP_CHARS = 50 // adjacent chunks share 50 characters

export function extractChunks(text: string): ExtractedChunk[] {
  const chunks = []
  let startIndex = 0

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + CHUNK_SIZE_CHARS, text.length)
    const chunkContent = text.slice(startIndex, endIndex)

    chunks.push({ content: chunkContent, chunkIndex: chunks.length, tokenCount })

    // Move forward by CHUNK_SIZE but step back OVERLAP so adjacent
    // chunks share 50 characters — prevents a sentence from being cut
    // right at a chunk boundary and losing context
    startIndex = startIndex + CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS
  }

  return chunks
}
```

**Why 512 characters?** Medical records contain long, dense sentences. Smaller
chunks (128 chars) might cut a medication name mid-sentence. Larger chunks
(1024 chars) carry too much noise for the similarity search.

**Why 50-character overlap?** If a key phrase ("metformin 500mg twice daily")
falls right at a chunk boundary, it could be split across two chunks — making
neither chunk match well during retrieval. The overlap ensures boundary phrases
appear fully in at least one chunk.

---

### Step 7 — Generating embeddings

```ts
// src/lib/ai/embeddings.ts
const EMBEDDING_BATCH_SIZE = 5    // embed 5 chunks at a time
const EMBEDDING_BATCH_DELAY_MS = 200  // wait 200ms between batches

for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
  const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)

  await Promise.all(batch.map(async (chunk) => {
    const vector = await embedText(chunk.content)  // calls Gemini API
    // ... store vector
  }))

  await sleep(EMBEDDING_BATCH_DELAY_MS)  // rate limit protection
}
```

```ts
// src/lib/ai/gemini.ts
export async function embedText(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text }], role: 'user' },
    outputDimensionality: 768,  // Matryoshka truncation to fit vector(768) column
  })
  return result.embedding.values  // array of 768 float numbers
}
```

`embedText` calls the Gemini `gemini-embedding-001` model, which converts a
string of text into an array of 768 numbers. These numbers encode the semantic
*meaning* of the text — similar sentences produce similar number arrays.

**Why batches of 5 with 200ms delay?** Gemini's free tier allows ~60 embedding
API calls per minute. A 10-page PDF might produce 80+ chunks. Without batching,
we'd hit the rate limit and all embeddings after the 60th would fail. Batching 5
at a time with 200ms delays keeps us safely under the limit.

---

### Step 8 — Storing vectors in pgvector

```ts
// src/lib/ai/embeddings.ts
// First create the chunk row (Prisma handles this normally)
const dbChunk = await prisma.chunk.create({
  data: { content, chunkIndex, tokenCount, documentId },
})

// Then write the vector with raw SQL
// We use $executeRawUnsafe instead of $executeRaw because the ::vector cast
// gets silently mangled by Prisma's tagged template version
await prisma.$executeRawUnsafe(
  'UPDATE chunks SET embedding = $1::vector WHERE id = $2',
  `[${vector.join(',')}]`,  // "[0.123,0.456,0.789,...]"
  dbChunk.id
)
```

pgvector stores the array as a special `vector` type in PostgreSQL. The `::vector`
cast in the SQL tells Postgres to convert our string representation into an
actual vector. The ivfflat index on this column makes future similarity searches
fast (without it, every query scans every row).

---

## End-to-end timing

| Step | Typical time |
|---|---|
| File validation | <5ms |
| DB record creation | 30–80ms |
| PDF extraction | 100–500ms (depends on PDF size) |
| Chunking | <10ms |
| Embedding (per chunk) | 300–600ms |
| Embedding (20 chunks, batched) | ~3–5 seconds |
| DB write per chunk | 30–80ms |
| **Total for a 5-page PDF** | **~10–15 seconds** |

This is why the upload is synchronous and shows a spinner — it really does take
this long.

---

## The mental model

Think of the pipeline like a **hospital medical records system preparing a chart for search**:

1. **PDF extraction** = a clerk photocopies and OCRs a paper chart into digital text
2. **Chunking** = the clerk cuts the text into index cards, 512 characters each, with slight overlap so no sentence is split
3. **Embedding** = a specialist reads each index card and assigns it a "topic fingerprint" — 768 numbers that encode what the card is about
4. **pgvector storage** = the index cards + fingerprints go into a filing system that's sorted by fingerprint similarity, so similar topics are physically near each other

When a user asks a question later, we convert their question into a fingerprint
and find the index cards with the most similar fingerprints.

---

## What could go wrong

**1. PDF is scanned (image-based)**
`pdf-parse` returns empty text. `extractPDFText` throws: "No text content found."
The API returns a 422 with that message. The document shows "failed" in sidebar.
Fix: add OCR (e.g. Tesseract or Google Vision API) — planned future enhancement.

**2. Gemini API rate limit hit mid-ingestion**
The Gemini API returns a 429 error. This throws inside `embedText`, which
propagates up through `embedAndStoreChunks` → `ingestDocument` → the route handler.
The document is marked "failed" with the rate limit message. The fix: the 200ms
batch delay prevents this in normal operation for PDFs under ~50 pages.

**3. pgvector rejects the vector (dimension mismatch)**
If the embedding model somehow returned a different number of dimensions than 768,
the `UPDATE ... SET embedding = $1::vector` would fail because the column is
declared as `vector(768)`. We guard against this in `embedText` with an explicit
dimension check that throws before we even attempt the DB write.

---

## Interview question you can now answer

**"Walk me through how your app processes an uploaded PDF."**

When a PDF is uploaded, the API route validates the file (type and size), creates
a database record with status "processing", then calls `ingestDocument` synchronously.
That function extracts raw text with `pdf-parse`, splits it into 512-character chunks
with 50-character overlap to preserve sentence boundaries, sends each chunk to the
Gemini `gemini-embedding-001` model to get a 768-dimensional vector, and writes the
vectors to PostgreSQL using the pgvector extension with an ivfflat cosine index.
Only after all chunks are stored does the document status update to "ready", and
the full document object is returned to the frontend.

---

## Skills unlocked
- [x] AI/RAG: What embeddings are — semantic meaning as numbers
- [x] AI/RAG: Why chunking matters and how overlap prevents boundary cuts
- [x] AI/RAG: Why batch embedding with rate-limit delays
- [x] TypeScript: Async error propagation — how throw bubbles up through async chains
- [x] Next.js: FormData handling in App Router API routes
- [x] System design: Optimistic UI — show state changes before server confirms
- [x] System design: Why create DB record before processing (idempotency)
- [x] Production: pgvector raw SQL writes — when to bypass the ORM
