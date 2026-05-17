import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { DAILY_QUERY_LIMIT } from '@/constants/ai'

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return jsonError('Unauthorized', 401)
    }

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    // Count across ALL users — the Gemini API key is a shared global pool.
    const usedToday = await prisma.query.count({
      where: { createdAt: { gte: startOfDay } },
    })

    const remaining = Math.max(0, DAILY_QUERY_LIMIT - usedToday)

    return new Response(JSON.stringify({ remaining }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[GET /api/query/quota]', error)
    return jsonError('Internal server error', 500)
  }
}
