# Embeddings + pgvector — How Semantic Search Works

## What this is
An embedding is an array of numbers (a "vector") that represents the *meaning*
of a piece of text. pgvector is a PostgreSQL extension that stores these vectors
and finds the ones most similar to a query — the foundation of all RAG systems.

## Why we need it in MediQuery
Full-text search (LIKE queries) finds exact words. A user might ask
"what drugs is the patient on?" but the document says "prescribed medications".
Embedding-based search finds that match because both phrases have similar
*meaning*, even though they share no words. That's what makes this product
clinically useful.

---

## What an embedding actually is

```ts
// This sentence...
"The patient is prescribed metformin 500mg twice daily"

// ...becomes this (768 numbers, truncated for readability)
[0.023, -0.187, 0.441, 0.062, -0.309, 0.118, ...]
//  ^^^   ^^^    ^^^
// Each number encodes some aspect of meaning.
// Similar sentences produce similar arrays.
```

You never interpret individual numbers. What matters is the *distance* between
two arrays — sentences with similar meaning produce arrays that are close together
in 768-dimensional space.

---

## Why 768 dimensions specifically

Our Gemini model (`gemini-embedding-001`) produces 768-dimensional embeddings
when using `outputDimensionality: 768`. This is a technique called **Matryoshka
Representation Learning** — the model can produce vectors of different sizes
(768, 1536, 3072) while preserving quality.

We chose 768 because:
1. Our PostgreSQL column is `vector(768)` — no migration needed
2. pgvector's ivfflat index supports up to 2000 dimensions — we're safely within limits
3. 768 dims is sufficient for medical text retrieval quality

---

## How cosine similarity works

```
Vector A: [0.2, 0.8, -0.4]  ← "What medications is the patient on?"
Vector B: [0.3, 0.7, -0.3]  ← "Patient is prescribed metformin 500mg"
Vector C: [-0.9, 0.1, 0.6]  ← "The hospital cafeteria serves lunch"

Cosine similarity = the angle between two vectors
  A vs B: 0.98  (very similar direction → similar meaning)
  A vs C: 0.11  (very different direction → different meaning)
```

Cosine similarity always returns a value between 0 and 1:
- `1.0` = identical meaning
- `0.75` = our threshold (agent considers this a confident match)
- `< 0.75` = agent reformulates the query and tries again
- `0.0` = completely unrelated

---

## The pgvector setup in our database

```sql
-- Enabled once at DB setup
CREATE EXTENSION IF NOT EXISTS vector;

-- Our chunks table has a vector column
ALTER TABLE "chunks" ADD COLUMN "embedding" vector(768);

-- ivfflat index for fast approximate nearest-neighbour search
CREATE INDEX "chunks_embedding_idx" ON "chunks"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
```

**`ivfflat`** stands for Inverted File Flat. It works by:
1. Pre-clustering all vectors into 100 groups ("lists") during index build
2. At query time, only searching the most relevant clusters instead of all rows
3. This makes search ~10x faster than scanning every row, at the cost of slight
   accuracy (it might miss 1–2% of truly relevant results)

**`vector_cosine_ops`** tells the index to optimise for cosine similarity distance.

---

## How we write vectors to the DB

```ts
// src/lib/ai/embeddings.ts
const vector = await embedText(chunk.content)  // [0.023, -0.187, 0.441, ...]
const vectorLiteral = `[${vector.join(',')}]`  // "[0.023,-0.187,0.441,...]"

await prisma.$executeRawUnsafe(
  'UPDATE chunks SET embedding = $1::vector WHERE id = $2',
  vectorLiteral,
  dbChunk.id
)
```

We use raw SQL here because Prisma doesn't have native pgvector support.
The `::vector` cast tells PostgreSQL to parse our string as a vector type.

**Why `$executeRawUnsafe` and not `$executeRaw`?**
Prisma's tagged-template `$executeRaw` can silently mangle the `::vector` type
cast in some versions, causing the cast to be treated as a string comparison.
`$executeRawUnsafe` passes the SQL exactly as written.

---

## How we'll query vectors (Phase 3 preview)

```sql
-- Find the 5 chunks most similar to the question embedding
SELECT id, content, chunk_index,
  1 - (embedding <=> $1::vector) AS similarity
FROM chunks
WHERE document_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

- `<=>` is pgvector's cosine distance operator
- `1 - distance` converts distance to similarity (1 = identical, 0 = unrelated)
- `ORDER BY embedding <=> $1::vector` returns nearest vectors first

---

## The mental model

Imagine a **city map where every restaurant is placed by cuisine similarity**:
- Italian restaurants cluster in one neighbourhood
- Indian restaurants cluster in another
- Mexican restaurants cluster in another

Embeddings do the same for text. Every sentence gets "placed" in 768-dimensional
space based on its meaning. When you search, you're asking: "which restaurants are
closest to my location?" The ivfflat index is the city's district map — instead of
checking every restaurant, you first find the right district, then search within it.

---

## What could go wrong

**1. Dimension mismatch**
If `embedText` returns 3072 numbers but the column is `vector(768)`, the insert
fails. We guard this with an explicit check in `embedText`:
```ts
if (embedding.length !== EMBEDDING_DIMENSIONS) {
  throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${embedding.length}`)
}
```

**2. ivfflat index has too few rows to be useful**
The `lists = 100` parameter means the index pre-clusters data into 100 groups.
With fewer than 100 rows, this is sub-optimal (essentially a full scan). For
our use case (typically 20–200 chunks per document) this is fine — the index
still works, just not at peak efficiency.

**3. NULL embeddings from failed previous ingestion**
Early uploads failed before the embedding model fix. Those rows have `embedding = NULL`.
The ivfflat index skips NULL values, so they never appear in similarity search results.
They're harmless, just wasted storage.

---

## Interview question you can now answer

**"What is a vector embedding and why does MediQuery use them?"**

An embedding is a fixed-size array of numbers (in our case, 768 floats) that
encodes the semantic meaning of a piece of text — similar meanings produce
mathematically similar arrays. MediQuery uses them because keyword search fails
for clinical queries: a user might ask "what drugs is the patient on?" while
the document says "prescribed medications." Embedding-based cosine similarity
search finds that match because both phrases map to nearby vectors, even though
they share no literal words.

---

## Skills unlocked
- [x] AI/RAG: What an embedding is and how to generate one with Gemini
- [x] AI/RAG: Cosine similarity — the math behind RAG retrieval
- [x] AI/RAG: Why 768 dimensions (Matryoshka, column constraints, index limits)
- [x] System design: ivfflat index — approximate nearest-neighbour search
- [x] Production: Why raw SQL over ORM for unsupported types (pgvector)
- [x] Production: Debugging dimension mismatch errors
