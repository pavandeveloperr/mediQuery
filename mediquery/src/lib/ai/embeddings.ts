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

          // Create chunk row first so Prisma generates the cuid
          const dbChunk = await prisma.chunk.create({
            data: {
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
              documentId,
            },
          })

          // $executeRawUnsafe gives explicit control over parameterisation.
          // $1 is cast to vector at the DB level — Prisma's tagged-template
          // variant can silently mangle the ::vector cast in some versions.
          await prisma.$executeRawUnsafe(
            'UPDATE chunks SET embedding = $1::vector WHERE id = $2',
            vectorLiteral,
            dbChunk.id
          )
        } catch (error) {
          console.error(`[embeddings] Failed on chunk ${chunk.chunkIndex}:`, error)
          throw error
        }
      })
    )

    // Brief pause between batches to stay within Gemini rate limits
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }
}
