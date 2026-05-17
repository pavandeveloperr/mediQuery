import { DOCUMENT_NAME_MAX_DISPLAY_CHARS } from '@/constants/documents'

export function truncateDocumentName(
  name: string,
  maxChars = DOCUMENT_NAME_MAX_DISPLAY_CHARS
): string {
  const base = name.replace(/\.pdf$/i, '')
  return base.length > maxChars ? `${base.slice(0, maxChars)}…` : base
}
