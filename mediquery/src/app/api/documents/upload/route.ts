import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { extractPDFText } from '@/lib/utils/pdf'
import { extractChunks, validateChunks } from '@/lib/ai/chunker'
import { embedAndStoreChunks } from '@/lib/ai/embeddings'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds the 15 MB limit' }, { status: 400 })
    }

    const document = await prisma.document.create({
      data: {
        name: file.name,
        storagePath: '',
        fileSize: file.size,
        status: 'processing',
        userId: session.user.id,
      },
    })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Process synchronously — surfaces real errors in the HTTP response
    // and avoids silent fire-and-forget failures
    try {
      await processDocument(document.id, buffer)
    } catch (processingError) {
      const message =
        processingError instanceof Error ? processingError.message : 'Unknown processing error'

      console.error(`[upload] Processing failed for ${document.id}:`, processingError)

      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'failed' },
      })

      return NextResponse.json(
        { error: `Processing failed: ${message}`, documentId: document.id },
        { status: 422 }
      )
    }

    const updated = await prisma.document.findUnique({
      where: { id: document.id },
      select: { id: true, name: true, status: true, pageCount: true, createdAt: true },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    console.error('[POST /api/documents/upload]', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

async function processDocument(documentId: string, buffer: Buffer): Promise<void> {
  const { text, pageCount } = await extractPDFText(buffer)

  const chunks = extractChunks(text)

  if (!validateChunks(chunks)) {
    throw new Error('No usable text segments could be extracted from this PDF')
  }

  await embedAndStoreChunks(chunks, documentId)

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'ready', pageCount },
  })

  console.log(`[processDocument] ${documentId} ready — ${chunks.length} chunks embedded`)
}
