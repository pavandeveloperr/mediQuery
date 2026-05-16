// gemini-1.5-pro → v1 only (404 on v1beta)
// gemini-2.0-flash → requires paid plan (limit: 0 on free tier)
// gemini-1.5-flash → correct free-tier generation model on v1beta
export const GEMINI_GENERATION_MODEL = 'gemini-1.5-flash'
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
