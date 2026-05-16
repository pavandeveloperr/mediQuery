export interface ExtractedChunk {
  content: string
  chunkIndex: number
  tokenCount: number
}

const CHUNK_SIZE = 512
const OVERLAP_SIZE = 50

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

export function extractChunks(text: string): ExtractedChunk[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const chunks: ExtractedChunk[] = []
  let chunkIndex = 0
  let startIndex = 0

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + CHUNK_SIZE, text.length)
    const chunkContent = text.slice(startIndex, endIndex)

    if (chunkContent.trim().length > 0) {
      chunks.push({
        content: chunkContent,
        chunkIndex,
        tokenCount: estimateTokenCount(chunkContent),
      })

      chunkIndex++
    }

    if (endIndex === text.length) {
      break
    }

    startIndex = Math.max(startIndex + CHUNK_SIZE - OVERLAP_SIZE, startIndex + 1)
  }

  return chunks
}

export interface ChunkWithEmbedding extends ExtractedChunk {
  embedding: number[]
}

export function validateChunks(chunks: ExtractedChunk[]): boolean {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    console.warn('[validateChunks] No chunks to validate')
    return false
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    if (!chunk.content || typeof chunk.content !== 'string') {
      console.error(`[validateChunks] Chunk ${i} has invalid content`)
      return false
    }

    if (typeof chunk.chunkIndex !== 'number' || chunk.chunkIndex !== i) {
      console.error(`[validateChunks] Chunk ${i} has invalid chunkIndex: ${chunk.chunkIndex}`)
      return false
    }

    if (typeof chunk.tokenCount !== 'number' || chunk.tokenCount <= 0) {
      console.error(`[validateChunks] Chunk ${i} has invalid tokenCount: ${chunk.tokenCount}`)
      return false
    }
  }

  return true
}
