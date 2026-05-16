import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth'
import AppShell from '@/components/features/AppShell'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/')
  }

  return (
    <div className="h-screen overflow-hidden">
      <AppShell
        userName={session.user.name ?? null}
        userEmail={session.user.email ?? null}
        userImage={session.user.image ?? null}
      />
    </div>
  )
}
