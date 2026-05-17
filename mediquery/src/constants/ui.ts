export const UI_LABELS = {
  APP_TITLE: 'Clinical Workspace',
  BRAND_NAME: 'MediQuery',
  SIGN_OUT: 'Sign out',
  UPLOAD_PDF: 'Upload PDF',
  SOURCES: 'Sources',
  SHOW_SOURCES: 'Show sources',
  NO_DOCUMENT_SELECTED: 'No document selected',
  NO_DOCUMENT_DESCRIPTION: 'Upload and select a document from the sidebar to begin querying',
  ASK_ANYTHING: 'Ask anything about this document',
  ANSWERS_GROUNDED: 'Answers are grounded in retrieved chunks with full source citations',
  GROUNDED_DISCLAIMER: 'Answers are cited and grounded — no hallucinations',
  MESSAGE_LABEL_YOU: 'You',
  MESSAGE_LABEL_ASSISTANT: 'MediQuery',
  QUERY_PLACEHOLDER: 'Ask a clinical question about this document…',
  STREAMING_PLACEHOLDER: 'Generating response…',
  DOCUMENTS_LOADING: 'Documents',
  documentsReady: (count: number) => `Documents · ${count} ready`,
  DOC_PROCESSING_TITLE: 'Indexing document…',
  DOC_PROCESSING_DESCRIPTION: 'Extracting text and building vector embeddings. This usually takes under a minute.',
  DOC_FAILED_TITLE: 'Processing failed',
  DOC_FAILED_DESCRIPTION: 'Delete this document from the sidebar and upload it again to retry.',
} as const

export const SUGGESTED_QUESTIONS = [
  'What medications is the patient currently prescribed?',
  'Are there any abnormal findings in the lab results?',
  'What follow-up actions were recommended by the physician?',
] as const
