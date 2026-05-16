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

    // Create the document record immediately so the frontend can track it
    const document = await prisma.document.create({
      data: {
        name: file.name,
        storagePath: '',
        fileSize: file.size,
        status: 'processing',
        userId: session.user.id,
      },
    })

    // Read file into buffer before starting background processing
    const buffer = Buffer.from(await file.arrayBuffer())

    // Fire-and-forget processing — works in Node.js dev server
    // On Vercel, wrap this in waitUntil() when deploying to production
    void processDocument(document.id, buffer).catch(async (error) => {
      console.error(`[upload] Processing failed for ${document.id}:`, error)
      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'failed' },
      }).catch(() => undefined)
    })

    return NextResponse.json(
      { id: document.id, name: document.name, status: 'processing' },
      { status: 202 }
    )
  } catch (error) {
    console.error('[POST /api/documents/upload]', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

async function processDocument(documentId: string, buffer: Buffer): Promise<void> {
  const { text, pageCount } = await extractPDFText(buffer)

  const chunks = extractChunks(text)

  if (!validateChunks(chunks)) {
    throw new Error('Chunk validation failed — no usable text segments produced')
  }

  await embedAndStoreChunks(chunks, documentId)

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'ready', pageCount },
  })

  console.log(`[processDocument] ${documentId} ready — ${chunks.length} chunks embedded`)
}
