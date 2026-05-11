import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import DashboardClient from '@/components/dashboard-client'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">Your secure document workspace</h1>
          <p className="mt-3 text-slate-600">
            This page is protected. Only authenticated users can access it.
          </p>
        </div>

        <DashboardClient session={session} />
      </div>
    </main>
  )
}
