import { prisma } from '@/lib/db/prisma'
import { embedText } from '@/lib/ai/gemini'
import type { ExtractedChunk } from '@/lib/ai/chunker'

// Process N chunks in parallel to balance speed vs. Gemini rate limits
const BATCH_SIZE = 5
const BATCH_DELAY_MS = 200

export async function embedAndStoreChunks(
  chunks: ExtractedChunk[],
  documentId: string
): Promise<void> {
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (chunk) => {
        try {
          const vector = await embedText(chunk.content)
          const vectorLiteral = `[${vector.join(',')}]`

          // Create chunk row first (Prisma handles cuid generation)
          const dbChunk = await prisma.chunk.create({
            data: {
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
              documentId,
            },
          })

          // Write embedding via raw SQL — Prisma cannot handle Unsupported("vector") natively
          await prisma.$executeRaw`
            UPDATE chunks
            SET embedding = ${vectorLiteral}::vector
            WHERE id = ${dbChunk.id}
          `
        } catch (error) {
          console.error(`[embeddings] Failed on chunk ${chunk.chunkIndex}:`, error)
          throw error
        }
      })
    )

    // Pause between batches to avoid hitting Gemini rate limits
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }
}
