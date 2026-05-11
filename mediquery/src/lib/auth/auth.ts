import NextAuth, { type NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      console.log('Session callback:', { session, user })
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    redirect({ url, baseUrl }) {
      console.log('Redirect callback:', { url, baseUrl })
      // After successful sign-in, redirect to dashboard
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allows relative callback URLs
      if (new URL(url).origin === baseUrl) return url
      // Redirect to dashboard for any other case
      return `${baseUrl}/dashboard`
    },
  },
  events: {
    async signIn(message) {
      console.log('Sign in event:', message)
    },
    async session(message) {
      console.log('Session event:', message)
    },
  },
  debug: process.env.NODE_ENV === 'development',
  pages: {
    signIn: '/',
  },
}

const authHandler = NextAuth(authOptions)

export { authHandler }