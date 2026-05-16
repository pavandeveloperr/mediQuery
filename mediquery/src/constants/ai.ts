// Confirmed via ListModels API — only these models exist on this API key.
// gemini-1.5-flash / gemini-1.5-pro do NOT exist on this key at all.
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'
export const GEMINI_GENERATION_MODEL = 'gemini-2.0-flash-lite'
export const EMBEDDING_DIMENSIONS = 768

export const CHUNK_SIZE_CHARS = 512
export const CHUNK_OVERLAP_CHARS = 50

// Serialised (batch=1) with 500ms delay to stay within Gemini free-tier rate limits.
export const EMBEDDING_BATCH_SIZE = 1
export const EMBEDDING_BATCH_DELAY_MS = 500

export const SIMILARITY_THRESHOLD = 0.75
export const MAX_RETRIEVED_CHUNKS = 5
export const MAX_AGENT_REFORMULATIONS = 1
