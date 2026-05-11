"use client"

import { signOut, useSession } from 'next-auth/react'
import type { Session } from 'next-auth'

export default function DashboardClient({ session }: { session: Session }) {
  const { data } = useSession()
  const currentSession = data ?? session

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm max-w-3xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">Welcome back, {currentSession.user.name ?? currentSession.user.email}</h2>
          <p className="mt-2 text-sm text-slate-500">
            You are signed in with Google. Your session is active and your user record is stored in the database.
          </p>
        </div>

        <div className="grid gap-4 rounded-3xl bg-slate-50 p-6">
          <div className="text-sm text-slate-600">
            <strong>User ID:</strong> {currentSession.user.id}
          </div>
          <div className="text-sm text-slate-600">
            <strong>Email:</strong> {currentSession.user.email}
          </div>
          <div className="text-sm text-slate-600">
            <strong>Expires:</strong> {new Date(currentSession.expires).toLocaleString()}
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
