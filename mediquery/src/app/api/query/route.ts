import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { runAgent } from '@/lib/ai/agent'
import { RateLimitError } from '@/lib/ai/gemini'
import { queryRateLimit } from '@/lib/cache/rate-limit'
import { GLOBAL_RATE_LIMIT_KEY } from '@/constants/ai'
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

    const { success, remaining, reset } = await queryRateLimit.limit(GLOBAL_RATE_LIMIT_KEY)
    if (!success) {
      const resetsAt = new Date(reset).toISOString()
      return new Response(
        JSON.stringify({ error: 'Daily query limit reached', remaining, resetsAt }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetsAt,
          },
        }
      )
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: session.user.id },
    })
    if (!document) {
      return jsonError('Document not found', 404)
    }

    const userId = session.user.id
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendPayload = (payload: RAGStreamPayload) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

        const sendDone = () => controller.enqueue(encoder.encode('data: [DONE]\n\n'))

        try {
          let fullAnswer = ''

          const result = await runAgent(question, documentId, {
            onToken: (token) => {
              fullAnswer += token
              sendPayload({ token })
            },
            onStep: (step) => {
              sendPayload({ token: '', step })
            },
          })

          // Persist the completed query to the database.
          // TODO: populate tokenCount and costUsd once token-counting is implemented
          await prisma.query.create({
            data: {
              question,
              answer: fullAnswer,
              confidence: result.confidenceScore,
              agentSteps: result.steps as unknown as object[],
              sources: result.citations as unknown as object[],
              userId,
              documentId,
            },
          })

          // Final metadata event — carries citations, final confidence, and remaining quota.
          // Individual steps were already streamed via onStep; no need to re-send them here.
          sendPayload({
            token: '',
            confidenceScore: result.confidenceScore,
            citations: result.citations,
            remainingQueries: remaining,
          })

          sendDone()
        } catch (error) {
          console.error('[POST /api/query] Agent failed:', error)
          const errorMessage =
            error instanceof RateLimitError
              ? 'You have exceeded the maximum query quota for today. Please try again tomorrow.'
              : 'An error occurred while processing your query. Please try again.'
          sendPayload({ token: '', error: errorMessage })
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
        'X-Accel-Buffering': 'no', // disable Nginx buffering when behind a proxy
      },
    })
  } catch (error) {
    console.error('[POST /api/query]', error)
    return jsonError('Internal server error', 500)
  }
}
