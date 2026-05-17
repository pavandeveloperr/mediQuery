export const DOCUMENT_STATUS = {
  READY: 'ready',
  PROCESSING: 'processing',
  FAILED: 'failed',
} as const

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
export const MAX_FILE_SIZE_MB = 15
export const ACCEPTED_MIME_TYPE = 'application/pdf'
export const ACCEPTED_FILE_EXTENSION = '.pdf'
export const DOCUMENT_NAME_MAX_DISPLAY_CHARS = 26
export const DOCUMENT_POLL_INTERVAL_MS = 3_000
