import NextAuth, { type NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db/prisma'
import { env } from '@/config/env'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return `${baseUrl}/dashboard`
    },
  },
  debug: process.env.NODE_ENV === 'development',
  pages: {
    signIn: '/',
  },
}

const authHandler = NextAuth(authOptions)

export { authHandler }
