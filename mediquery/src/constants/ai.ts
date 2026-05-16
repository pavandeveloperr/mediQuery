// Both gemini-1.5-pro and text-embedding-004 were moved to v1 endpoint only.
// The SDK (@google/generative-ai) defaults to v1beta, so we use models that
// are still available there: gemini-2.0-flash + gemini-embedding-001.
export const GEMINI_GENERATION_MODEL = 'gemini-2.0-flash'
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'
export const EMBEDDING_DIMENSIONS = 768

export const CHUNK_SIZE_CHARS = 512
export const CHUNK_OVERLAP_CHARS = 50

// Serialised (batch=1) with 500ms delay to stay within Gemini free-tier rate limits.
// text-embedding-004 free tier allows ~1500 RPD but bursts trigger 429 — serialize to be safe.
export const EMBEDDING_BATCH_SIZE = 1
export const EMBEDDING_BATCH_DELAY_MS = 500

export const SIMILARITY_THRESHOLD = 0.75
export const MAX_RETRIEVED_CHUNKS = 5
export const MAX_AGENT_REFORMULATIONS = 1
