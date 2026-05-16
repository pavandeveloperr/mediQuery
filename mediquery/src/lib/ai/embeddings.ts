import { prisma } from '@/lib/db/prisma'
import { embedText } from '@/lib/ai/gemini'
import { EMBEDDING_BATCH_SIZE, EMBEDDING_BATCH_DELAY_MS } from '@/constants/ai'
import type { ExtractedChunk } from '@/lib/ai/chunker'

export async function embedAndStoreChunks(
  chunks: ExtractedChunk[],
  documentId: string
): Promise<void> {
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)

    await Promise.all(
      batch.map(async (chunk) => {
        try {
          const vector = await embedText(chunk.content)
          const vectorLiteral = `[${vector.join(',')}]`

          const dbChunk = await prisma.chunk.create({
            data: {
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
              documentId,
            },
          })

          // $executeRawUnsafe gives explicit control over the ::vector cast.
          // The tagged-template variant can silently mangle it in some Prisma versions.
          await prisma.$executeRawUnsafe(
            'UPDATE chunks SET embedding = $1::vector WHERE id = $2',
            vectorLiteral,
            dbChunk.id
          )
        } catch (error) {
          console.error(`[embedAndStoreChunks] Failed on chunk ${chunk.chunkIndex}:`, error)
          throw error
        }
      })
    )

    if (i + EMBEDDING_BATCH_SIZE < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, EMBEDDING_BATCH_DELAY_MS))
    }
  }
}
