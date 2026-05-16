import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import type { UIDocument } from '@/types'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docs = await prisma.document.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        pageCount: true,
        createdAt: true,
      },
    })

    const result: UIDocument[] = docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      status: doc.status as UIDocument['status'],
      uploadedAt: doc.createdAt.toISOString().split('T')[0],
      pageCount: doc.pageCount ?? undefined,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/documents]', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}
