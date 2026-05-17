import { prisma } from '@/lib/db/prisma'
import { embedText } from '@/lib/ai/gemini'
import { MAX_RETRIEVED_CHUNKS } from '@/constants/ai'
import type { MedicalChunk } from '@/types'

export interface RetrievalResult {
  chunks: MedicalChunk[]
  avgSimilarity: number
}

// Raw shape returned by $queryRawUnsafe — column aliases match camelCase field names.
interface RawChunkRow {
  id: string
  content: string
  chunkIndex: number
  documentId: string
  similarity: number | string  // pgvector may return float as string in some drivers
}

export async function retrieveChunks(
  query: string,
  documentId: string
): Promise<RetrievalResult> {
  try {
    const vector = await embedText(query)
    const vectorLiteral = `[${vector.join(',')}]`

    // $1 appears twice (SELECT and ORDER BY) — PostgreSQL reuses the same bound value.
    // $queryRawUnsafe is required because Prisma's tagged $queryRaw can mangle ::vector casts.
    // Prisma stores camelCase field names as-is in PostgreSQL (no auto snake_case).
    // Double-quotes are required to preserve case — "chunkIndex" not chunk_index.
    const rows = await prisma.$queryRawUnsafe<RawChunkRow[]>(
      `SELECT
        id,
        content,
        "chunkIndex",
        "documentId",
        1 - (embedding <=> $1::vector) AS similarity
      FROM chunks
      WHERE "documentId" = $2
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
      vectorLiteral,
      documentId,
      MAX_RETRIEVED_CHUNKS
    )

    const chunks: MedicalChunk[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      chunkIndex: Number(row.chunkIndex),
      documentId: row.documentId,
      similarity: Number(row.similarity),
    }))

    const avgSimilarity =
      chunks.length > 0
        ? chunks.reduce((sum, c) => sum + (c.similarity ?? 0), 0) / chunks.length
        : 0

    return { chunks, avgSimilarity }
  } catch (error) {
    console.error('[retrieveChunks] Failed:', error)
    throw error
  }
}
