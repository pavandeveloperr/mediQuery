import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '@/config/env'
import {
  GEMINI_GENERATION_MODEL,
  GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  GEMINI_RATE_LIMIT_MAX_RETRIES,
  GEMINI_RATE_LIMIT_FALLBACK_DELAY_MS,
} from '@/constants/ai'

const client = new GoogleGenerativeAI(env.geminiApiKey)

// Both models confirmed available on v1beta via ListModels for this API key.
export const geminiModel = client.getGenerativeModel({ model: GEMINI_GENERATION_MODEL })
export const embeddingModel = client.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL })

export { EMBEDDING_DIMENSIONS }

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}

function isGemini429(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    (error as { status: number }).status === 429
  )
}

function extractRetryDelayMs(error: unknown): number {
  if (error !== null && typeof error === 'object' && 'errorDetails' in error) {
    const details = (
      error as { errorDetails: Array<{ '@type': string; retryDelay?: string }> }
    ).errorDetails
    if (Array.isArray(details)) {
      const retryInfo = details.find(
        (d) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
      )
      if (retryInfo?.retryDelay) {
        const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''))
        if (!isNaN(seconds)) return Math.ceil(seconds) * 1000
      }
    }
  }
  return GEMINI_RATE_LIMIT_FALLBACK_DELAY_MS
}

// Retries `fn` on transient 429s (RPM window clears in seconds). Not used for
// streaming — failing fast there gives the user immediate feedback.
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (isGemini429(error) && attempt < GEMINI_RATE_LIMIT_MAX_RETRIES) {
        const delayMs = extractRetryDelayMs(error)
        console.error(`[${label}] Rate limited (attempt ${attempt + 1}), retrying in ${delayMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        attempt++
        continue
      }
      if (isGemini429(error)) {
        throw new RateLimitError(
          'Gemini API rate limit reached. Please wait a moment and try again.'
        )
      }
      throw error
    }
  }
}

export async function embedText(text: string): Promise<number[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text }], role: 'user' },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    } as any)
    const embedding = result.embedding.values

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS}-dimensional embedding, got ${embedding?.length ?? 0}`
      )
    }

    return embedding
  } catch (error) {
    console.error('[embedText] Failed to embed text:', error)
    throw error
  }
}

// Uses withRetry — reformulation is a background step so a short wait is acceptable.
export async function generateText(prompt: string): Promise<string> {
  try {
    const result = await withRetry(() => geminiModel.generateContent(prompt), 'generateText')
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

// No retry — streaming is user-facing; a 429 here becomes a RateLimitError so the
// frontend can show a clear message immediately rather than waiting for retries.
export async function streamGenerateText(
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    const result = await geminiModel.generateContentStream(prompt)

    for await (const chunk of result.stream) {
      const text = chunk.text?.()
      if (text) {
        onChunk(text)
      }
    }
  } catch (error) {
    if (isGemini429(error)) {
      throw new RateLimitError(
        'Gemini API rate limit reached. Please wait a moment and try again.'
      )
    }
    console.error('[streamGenerateText] Failed to stream text:', error)
    throw error
  }
}
