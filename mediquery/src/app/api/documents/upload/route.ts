import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { ingestDocument } from '@/lib/ai/ingest'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  ACCEPTED_MIME_TYPE,
  DOCUMENT_STATUS,
} from '@/constants/documents'

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
    if (file.type !== ACCEPTED_MIME_TYPE) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds the ${MAX_FILE_SIZE_MB} MB limit` },
        { status: 400 }
      )
    }

    const document = await prisma.document.create({
      data: {
        name: file.name,
        storagePath: '',
        fileSize: file.size,
        status: DOCUMENT_STATUS.PROCESSING,
        userId: session.user.id,
      },
    })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Fire-and-forget: return 202 immediately so Vercel's 10s serverless timeout
    // is never hit. The useDocuments hook polls /api/documents every 3s and picks
    // up the status change when ingestion finishes.
    // TODO: on Vercel production, wrap with `waitUntil` from @vercel/functions
    // so the background work is not killed when the response is flushed.
    void ingestDocument(document.id, buffer).catch(async (processingError) => {
      console.error(
        `[POST /api/documents/upload] Ingestion failed for ${document.id}:`,
        processingError
      )
      try {
        await prisma.document.update({
          where: { id: document.id },
          data: { status: DOCUMENT_STATUS.FAILED },
        })
      } catch (dbError) {
        console.error('[POST /api/documents/upload] Failed to set status=failed:', dbError)
      }
    })

    return NextResponse.json(document, { status: 202 })
  } catch (error) {
    console.error('[POST /api/documents/upload]', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
