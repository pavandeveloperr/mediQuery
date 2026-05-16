import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set')
}

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export const geminiModel = client.getGenerativeModel({
  model: 'gemini-1.5-pro',
})

// text-embedding-004 was retired — gemini-embedding-001 is current stable.
// outputDimensionality: 768 uses Matryoshka truncation to stay within the
// pgvector(768) column without requiring a DB migration.
export const embeddingModel = client.getGenerativeModel({
  model: 'gemini-embedding-001',
})

export const EMBEDDING_DIMENSIONS = 768

export async function embedText(text: string): Promise<number[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text }], role: 'user' },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    } as any)
    const embedding = result.embedding.values

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-dimensional embedding, got ${embedding?.length ?? 0}`)
    }

    return embedding
  } catch (error) {
    console.error('[embedText] Failed to embed text:', error)
    throw error
  }
}

export async function generateText(prompt: string): Promise<string> {
  try {
    const result = await geminiModel.generateContent(prompt)
    const text = result.response.text()

    if (!text) {
      throw new Error('Empty response from generative model')
    }

    return text
  } catch (error) {
    console.error('[generateText] Failed to generate text:', error)
    throw error
  }
}

export async function streamGenerateText(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
  try {
    const result = await geminiModel.generateContentStream(prompt)

    for await (const chunk of result.stream) {
      const text = chunk.text?.()
      if (text) {
        onChunk(text)
      }
    }
  } catch (error) {
    console.error('[streamGenerateText] Failed to stream text:', error)
    throw error
  }
}
