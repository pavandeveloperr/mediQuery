import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import type { AgentStep, MedicalChunk, QueryHistoryItem } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const documentId = request.nextUrl.searchParams.get('documentId')
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    }

    // Verify the document belongs to this user before returning its queries
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: session.user.id },
    })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const queries = await prisma.query.findMany({
      where: { documentId, userId: session.user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        question: true,
        answer: true,
        confidence: true,
        agentSteps: true,
        sources: true,
        createdAt: true,
      },
    })

    const items: QueryHistoryItem[] = queries.map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      confidence: q.confidence,
      agentSteps: q.agentSteps as unknown as AgentStep[],
      citations: q.sources as unknown as MedicalChunk[],
      createdAt: q.createdAt.toISOString(),
    }))

    return NextResponse.json(items)
  } catch (error) {
    console.error('[GET /api/queries]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
