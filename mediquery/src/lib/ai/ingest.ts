import { prisma } from '@/lib/db/prisma'
import { extractPDFText } from '@/lib/utils/pdf'
import { extractChunks, validateChunks } from '@/lib/ai/chunker'
import { embedAndStoreChunks } from '@/lib/ai/embeddings'
import { DOCUMENT_STATUS } from '@/constants/documents'

export async function ingestDocument(documentId: string, buffer: Buffer): Promise<void> {
  const { text, pageCount } = await extractPDFText(buffer)

  const chunks = extractChunks(text)

  if (!validateChunks(chunks)) {
    throw new Error('No usable text segments could be extracted from this PDF')
  }

  await embedAndStoreChunks(chunks, documentId)

  await prisma.document.update({
    where: { id: documentId },
    data: { status: DOCUMENT_STATUS.READY, pageCount },
  })
}
