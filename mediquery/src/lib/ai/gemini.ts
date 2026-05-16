import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set')
}

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export const geminiModel = client.getGenerativeModel({
  model: 'gemini-1.5-pro',
})

export const embeddingModel = client.getGenerativeModel({
  model: 'text-embedding-004',
})

export async function embedText(text: string): Promise<number[]> {
  try {
    const result = await embeddingModel.embedContent(text)
    const embedding = result.embedding.values

    if (!embedding || embedding.length !== 768) {
      throw new Error(`Expected 768-dimensional embedding, got ${embedding?.length || 0}`)
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
