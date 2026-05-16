// gemini-embedding-001 — works on v1beta (SDK default). text-embedding-004 is v1 only → 404.
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'
// gemini-1.5-flash — works on v1 (override in gemini.ts). gemini-1.5-pro is v1 only → 404 on v1beta.
export const GEMINI_GENERATION_MODEL = 'gemini-1.5-flash'
export const EMBEDDING_DIMENSIONS = 768

export const CHUNK_SIZE_CHARS = 512
export const CHUNK_OVERLAP_CHARS = 50

// Serialised (batch=1) with 500ms delay to stay within Gemini free-tier rate limits.
export const EMBEDDING_BATCH_SIZE = 1
export const EMBEDDING_BATCH_DELAY_MS = 500

export const SIMILARITY_THRESHOLD = 0.75
export const MAX_RETRIEVED_CHUNKS = 5
export const MAX_AGENT_REFORMULATIONS = 1
