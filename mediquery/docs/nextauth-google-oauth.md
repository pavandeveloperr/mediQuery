# NextAuth + Google OAuth — How Authentication Works End-to-End

## What this is
NextAuth is a library that handles the entire login flow for you — redirecting to
Google, receiving the token back, creating a user record in your database, and
keeping the user "logged in" via a session. You configure it once; it handles
the rest.

## Why we need it in MediQuery
Every document a user uploads must belong to them, and only them. Without
authentication, any visitor could query any document. NextAuth gives us a
`session.user.id` on every API request so we can scope all DB queries to the
logged-in user.

---

## The full login flow — step by step

```
1. User lands on /
2. Clicks "Continue with Google"
3. LoginForm calls signIn('google') from next-auth/react
4. NextAuth redirects browser to Google's OAuth consent screen
5. User approves → Google redirects back to /api/auth/callback/google
6. NextAuth receives the authorization code from Google
7. NextAuth exchanges it for an access token + user profile (name, email, image)
8. PrismaAdapter checks: does this Google account exist in DB?
   ├─ NO  → creates rows in: users, accounts tables
   └─ YES → loads the existing user
9. NextAuth creates a Session row in DB with an expiry
10. NextAuth sets a session cookie in the browser
11. NextAuth's redirect callback fires → sends user to /dashboard
12. DashboardPage calls getServerSession() → reads that cookie → returns user data
13. AppShell renders with userName, userEmail, userImage from session
```

---

## The code — what each part does

### Entry point: catch-all route
```ts
// src/app/api/auth/[...nextauth]/route.ts
import { authHandler } from '@/lib/auth/auth'
export { authHandler as GET, authHandler as POST }
```
The `[...nextauth]` folder name means Next.js routes ANY path starting with
`/api/auth/` to this file. So `/api/auth/signin`, `/api/auth/callback/google`,
`/api/auth/signout` all hit here. NextAuth internally handles each one.

---

### Core config
```ts
// src/lib/auth/auth.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),   // tells NextAuth to store users/sessions in our DB
  providers: [
    Google({
      clientId: env.googleClientId,       // your Google Cloud app's client ID
      clientSecret: env.googleClientSecret, // proves this server is your app
    }),
  ],
  callbacks: {
    session({ session, user }) {
      // NextAuth's session object only has name/email/image by default.
      // We add user.id so API routes can do WHERE userId = session.user.id
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    redirect({ url, baseUrl }) {
      // After login, send the user to /dashboard instead of back to /
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return `${baseUrl}/dashboard`
    },
  },
  pages: {
    signIn: '/',  // if login is needed, send to / not NextAuth's default page
  },
}
```

**`adapter: PrismaAdapter(prisma)`** — This is the bridge between NextAuth and
your database. Every time a new user signs in with Google for the first time,
PrismaAdapter automatically creates rows in your `users` and `accounts` tables.
Without an adapter, NextAuth stores sessions in memory (gone on server restart).

**`session callback`** — By default `session.user` only contains `name`, `email`,
`image`. The `id` field is NOT there. We add it manually here because every API
route needs `session.user.id` to scope database queries.

---

### Route protection
```ts
// src/app/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/')   // kick them back to landing page
  }

  return <AppShell userName={session.user.name ?? null} ... />
}
```

This is a **Server Component** — it runs on the server before any HTML is sent
to the browser. `getServerSession` reads the session cookie and validates it
against the DB. If there's no valid session, the user is redirected immediately —
the browser never even sees the dashboard HTML.

---

### Session available in API routes
```ts
// src/app/api/documents/route.ts
const session = await getServerSession(authOptions)
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Now we can safely scope the query to this user
const docs = await prisma.document.findMany({
  where: { userId: session.user.id },
})
```

---

## Database tables involved

```
users          ← one row per person (id, email, name, image)
accounts       ← links a user to their Google account (stores OAuth tokens)
sessions       ← active login sessions (sessionToken, userId, expires)
verificationTokens ← for email magic links (not used here, but required by NextAuth)
```

`PrismaAdapter` manages ALL of these automatically. You never write to them manually.

---

## The mental model

Think of it like a **hotel key card system**:
- Google is the ID scanner at the front desk — it verifies who you are
- NextAuth is the hotel staff — they check your ID, create a key card (session cookie), and store your booking (session row in DB)
- `getServerSession()` is the door lock reader — it checks your key card on every protected door
- `session.user.id` is your room number — every DB query uses it to find only YOUR documents

---

## What could go wrong

**1. `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` missing**
`src/config/env.ts` calls `requireEnv()` at startup, which throws immediately
with a clear message: `"Missing required environment variable: GOOGLE_CLIENT_ID"`.
The app won't boot at all, which is better than a cryptic runtime failure.

**2. `session.user.id` is undefined**
This happens if you forget the `session callback` in authOptions. Without it,
NextAuth's session object only has `name`, `email`, `image` — the `id` is missing.
Every API route checks `!session?.user?.id` and returns 401 if it's absent.

**3. Session cookie works but DB lookup fails**
NextAuth validates the session by checking the `sessions` table. If the DB is
unreachable, `getServerSession` returns `null` and the user is redirected to `/`.
This is the safe failure mode — better to force a re-login than leak data.

---

## Interview question you can now answer

**"How does your app prevent unauthenticated users from accessing the dashboard?"**

The dashboard page is a Next.js Server Component that calls `getServerSession()`
before rendering anything. If no valid session exists, `redirect('/')` fires
server-side — the browser never receives the dashboard HTML at all. Every API
route additionally checks `session?.user?.id` and returns a 401 if it's missing,
so even direct API calls are blocked without a valid session cookie.

---

## Skills unlocked
- [x] Next.js: Server Components can read cookies and redirect before rendering
- [x] Next.js: `[...nextauth]` catch-all route — how wildcard routes work
- [x] System design: OAuth flow — what each step does (code → token → profile → session)
- [x] System design: Database adapter pattern — decoupling auth from storage
- [x] TypeScript: Module augmentation — how we added `id` to the NextAuth Session type
