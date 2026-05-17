import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { runAgent } from '@/lib/ai/agent'
import type { RAGStreamPayload } from '@/types'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return jsonError('Unauthorized', 401)
    }

    let question: string
    let documentId: string

    try {
      const body = (await request.json()) as { question?: unknown; documentId?: unknown }

      if (typeof body.question !== 'string' || !body.question.trim()) {
        return jsonError('question is required', 400)
      }
      if (typeof body.documentId !== 'string' || !body.documentId.trim()) {
        return jsonError('documentId is required', 400)
      }

      question = body.question.trim()
      documentId = body.documentId.trim()
    } catch {
      return jsonError('Invalid request body', 400)
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: session.user.id },
    })
    if (!document) {
      return jsonError('Document not found', 404)
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendPayload = (payload: RAGStreamPayload) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

        const sendDone = () => controller.enqueue(encoder.encode('data: [DONE]\n\n'))

        try {
          const result = await runAgent(question, documentId, (token) =>
            sendPayload({ token })
          )

          // Final metadata event — carries citations, confidence, and agent trace.
          sendPayload({
            token: '',
            confidenceScore: result.confidenceScore,
            citations: result.citations,
            steps: result.steps,
          })

          sendDone()
        } catch (error) {
          console.error('[POST /api/query] Agent failed:', error)
          sendPayload({ token: 'An error occurred while processing your query.' })
          sendDone()
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',  // disable Nginx buffering when behind a proxy
      },
    })
  } catch (error) {
    console.error('[POST /api/query]', error)
    return jsonError('Internal server error', 500)
  }
}
