import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify the document belongs to this user before deleting
    const document = await prisma.document.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Chunks cascade-delete automatically via onDelete: Cascade in schema
    await prisma.document.delete({ where: { id } })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[DELETE /api/documents/[id]]', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
