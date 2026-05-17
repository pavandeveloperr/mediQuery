// src/components/features/LoginForm.tsx
"use client"

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { ShieldCheck } from 'lucide-react'
import GoogleSignInButton from '@/components/ui/google-signin-button'

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleGoogleSignIn() {
    try {
      setErrorMessage(null)
      setIsLoading(true)

      const result = await signIn('google', {
        callbackUrl: '/dashboard',
      })

      if (result?.error) {
        setErrorMessage('Unable to sign in with Google. Please try again.')
      }
    } catch (error) {
      console.error('Google sign in failed', error)
      setErrorMessage('Unexpected authentication error. Please retry.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl border border-[var(--foreground)]/10 bg-[var(--foreground)]/5 text-[var(--foreground)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--foreground)]/60">
              Secure login
            </p>
            <h1 className="text-2xl font-semibold">Secure your MediQuery workspace</h1>
          </div>
        </div>

        <p className="text-sm leading-7 text-[var(--foreground)]/75">
          Sign in with Google to access your clinical document intelligence dashboard and keep your document data grounded and encrypted.
        </p>
      </div>

      <div className="space-y-4">
        <GoogleSignInButton
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in…' : 'Sign in with Google'}
        </GoogleSignInButton>

        {errorMessage ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-[var(--foreground)]/10 bg-[var(--background)]/90 px-5 py-4 text-sm leading-6 text-[var(--foreground)]/75">
        MediQuery is HIPAA-inspired. Your clinical data is encrypted and grounded in your specific documents.
      </div>
    </div>
  )
}