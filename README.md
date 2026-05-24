```markdown
# 🩺 MediQuery — Clinical Document Intelligence Platform

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

**MediQuery** is a clinical document intelligence platform that allows users to upload medical PDFs, ask natural language questions, and receive grounded, fully-cited answers through an Agentic RAG (Retrieval-Augmented Generation) pipeline — with zero hallucinations.

[Live Demo](#) · [Report Bug](https://github.com/pavandeveloperr/mediQuery/issues) · [Request Feature](https://github.com/pavandeveloperr/mediQuery/issues)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [AI Pipeline Architecture](#-ai-pipeline-architecture)
- [Database Schema](#-database-schema)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Development Scripts](#-development-scripts)
- [Deployment](#-deployment)

---

## 🔍 Overview

MediQuery solves a core problem in clinical workflows: physicians and researchers spend significant time manually searching through dense medical documents for specific information. MediQuery replaces this with a conversational interface powered by an agentic AI pipeline that:

- **Retrieves** the most semantically relevant chunks from your uploaded document
- **Evaluates** retrieval confidence and automatically **reformulates** weak queries
- **Generates** grounded, source-cited answers streamed token-by-token in real time
- **Scores** every response with a composite faithfulness + completeness confidence rating

Every answer is traceable back to an exact document chunk — no guessing, no fabrication.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📄 **PDF Ingestion** | Upload medical PDFs; text is extracted, chunked, and embedded automatically |
| 🔍 **Semantic Search** | Cosine similarity search over 768-dimensional vectors via pgvector |
| 🤖 **Agentic RAG** | Multi-step agent with auto query reformulation below confidence threshold |
| 📡 **Real-time Streaming** | Token-by-token answer streaming via Server-Sent Events (SSE) |
| 🧠 **Live Agent Trace** | Each reasoning step (Retrieve → Reformulate → Answer → Evaluate) streams to the UI in real time |
| 📊 **Confidence Scoring** | Composite score: retrieval similarity (20%) + LLM-judged faithfulness (55%) + completeness (25%) |
| 📎 **Source Citations** | Every answer links to exact document chunks with similarity scores |
| 🔐 **Auth & Rate Limiting** | Google OAuth via NextAuth.js + Upstash Redis global rate limiting (20 queries/day) |
| 🕓 **Query History** | Persistent per-document query history with full agent traces |
| 🎨 **Polished UI** | Skeleton loaders, streaming indicators, confidence badges, collapsible agent trace |

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) (App Router) | Full-stack React framework with file-based routing and API routes |
| [TypeScript](https://www.typescriptlang.org/) (Strict Mode) | End-to-end type safety across the entire codebase |
| [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first styling with PostCSS |
| [shadcn/ui](https://ui.shadcn.com/) | Accessible, composable UI primitives |
| [Sonner](https://sonner.emilkowal.ski/) | Toast notifications |

### Backend & AI
| Technology | Purpose |
|---|---|
| [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) | RESTful API handlers and SSE streaming endpoints |
| [Google Gemini API](https://ai.google.dev/) | `gemini-1.5-pro` for generation · `text-embedding-004` for 768-dim embeddings |
| [Prisma ORM](https://www.prisma.io/) | Type-safe database access and schema migrations |
| [PostgreSQL + pgvector](https://supabase.com/) | Vector storage and cosine similarity search hosted on Supabase |
| [NextAuth.js](https://next-auth.js.org/) | Google OAuth authentication |
| [Upstash Redis](https://upstash.com/) | Global rate limiting (20 queries/day shared pool) |

---

## 🧠 AI Pipeline Architecture

MediQuery's core intelligence is a multi-step agentic loop. Every query passes through the following stages:

```
User Question
      │
      ▼
┌─────────────────────┐
│  1. EMBED QUESTION  │  text-embedding-004 → 768-dim vector
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│  2. RETRIEVE CHUNKS │  Cosine similarity search via pgvector (top 5 chunks)
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│  3. EVALUATE SCORE  │  avgSimilarity ≥ 0.75?
└─────────────────────┘
      │                 \
   YES │                 NO
      │                  ▼
      │        ┌──────────────────────┐
      │        │  4. REFORMULATE      │  gemini-1.5-pro rewrites query with clinical terminology
      │        └──────────────────────┘
      │                  │
      │              Re-Retrieve
      │                  │
      ▼                  ▼
┌─────────────────────────────────┐
│  5. GENERATE ANSWER             │  Stream grounded answer token-by-token via SSE
│     + LLM-as-Judge Evaluation   │  Faithfulness (55%) + Completeness (25%) + Retrieval (20%)
└─────────────────────────────────┘
      │
      ▼
Streamed Answer + Citations + Confidence Score + Agent Trace
```

### Agent Steps (Streamed to UI in Real Time)

| Step | Action | Description |
|---|---|---|
| 🔵 | `RETRIEVE` | Embeds question and searches document vector space |
| 🟡 | `REFORMULATE` | Rewrites query using clinical terminology when confidence is low |
| 🟢 | `ANSWER` | Generates grounded answer from top-k retrieved chunks |
| 🟣 | `EVALUATE` | LLM-as-judge scores faithfulness and completeness of the answer |
| 🔴 | `FAIL` | No relevant chunks found; returns `"Information not found"` |

### Confidence Score Breakdown

```
Composite Score = (0.20 × Retrieval Similarity)
                + (0.55 × LLM Faithfulness)
                + (0.25 × LLM Completeness)
```

| Badge | Score Range | Meaning |
|---|---|---|
| 🟢 HIGH | ≥ 0.85 | Answer is well-grounded in retrieved sources |
| 🟡 MEDIUM | 0.70 – 0.84 | Answer is partially supported |
| 🔴 LOW | < 0.70 | Answer may be incomplete or weakly supported |

---

## 🗄 Database Schema

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  name      String?
  image     String?
  documents Document[]
  queries   Query[]
}

model Document {
  id          String   @id @default(cuid())
  name        String
  storagePath String
  fileSize    Int?
  pageCount   Int?
  status      String   @default("processing") // processing | ready | failed
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  chunks      Chunk[]
  queries     Query[]
  createdAt   DateTime @default(now())
}

model Chunk {
  id         String   @id @default(cuid())
  content    String
  chunkIndex Int
  tokenCount Int?
  embedding  Unsupported("vector(768)")?
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

model Query {
  id         String   @id @default(cuid())
  question   String
  answer     String
  confidence Float
  tokenCount Int?
  costUsd    Float?
  agentSteps Json
  sources    Json
  userId     String
  documentId String
  user       User     @relation(fields: [userId], references: [id])
  document   Document @relation(fields: [documentId], references: [id])
  createdAt  DateTime @default(now())
}

model EvalResult {
  id            String   @id @default(cuid())
  faithfulness  Float
  relevance     Float
  precision     Float
  questionCount Int
  createdAt     DateTime @default(now())
}
```

---

## 📁 Project Structure

```
mediquery/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Login / signup pages
│   │   ├── api/
│   │   │   ├── documents/          # Upload, list, delete documents
│   │   │   ├── query/              # POST /query (SSE streaming), GET /query/quota
│   │   │   └── queries/            # GET /queries (query history)
│   │   └── dashboard/              # Main dashboard page
│   │
│   ├── components/
│   │   ├── features/               # Composed, stateful feature blocks
│   │   │   ├── AppShell.tsx        # Root three-panel layout
│   │   │   ├── DashboardNav.tsx    # Top nav with quota chip
│   │   │   ├── DocumentSidebar.tsx # Left panel — upload, select, delete docs
│   │   │   ├── QueryWorkspace.tsx  # Center panel — messages + streaming
│   │   │   └── SourceCitations.tsx # Right panel — cited chunks
│   │   └── ui/                     # Atomic, stateless primitives
│   │       ├── AgentStepTrace.tsx  # Collapsible agent reasoning accordion
│   │       ├── ConfidenceBadge.tsx # HIGH / MEDIUM / LOW badge
│   │       └── Skeleton.tsx        # Shimmer loaders
│   │
│   ├── hooks/                      # Custom React hooks (logic/UI separation)
│   │   ├── use-query-stream.ts     # SSE streaming + state orchestration
│   │   ├── use-query-history.ts    # Per-document query history
│   │   ├── use-query-quota.ts      # Remaining queries chip
│   │   └── use-documents.ts        # Document CRUD + polling
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── agent.ts            # Agentic RAG loop (retrieve → evaluate → answer)
│   │   │   ├── evaluation.ts       # LLM-as-judge faithfulness + completeness scoring
│   │   │   ├── prompts.ts          # Pure prompt builder functions
│   │   │   ├── gemini.ts           # Gemini client singleton + streaming helpers
│   │   │   ├── embeddings.ts       # Batch embed + store chunks
│   │   │   ├── retrieval.ts        # Cosine similarity search via pgvector
│   │   │   └── chunker.ts          # 512-char / 50-char overlap sliding window
│   │   ├── db/
│   │   │   └── prisma.ts           # Prisma client singleton
│   │   └── cache/
│   │       └── rate-limit.ts       # Upstash Redis sliding window limiter
│   │
│   ├── constants/                  # App-wide constants (no magic strings anywhere)
│   │   ├── ai.ts                   # Model names, thresholds, confidence weights
│   │   ├── routes.ts               # API_ROUTES + PAGE_ROUTES
│   │   └── ui.ts                   # All UI label strings
│   │
│   └── types/
│       └── index.ts                # Shared TypeScript interfaces
│
├── prisma/
│   └── schema.prisma               # Database schema
├── .env                            # Environment variables (never commit)
└── next.config.ts
```

---

## 🚀 Getting Started

### Prerequisites

Ensure the following are installed and available:

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v9+
- A [Supabase](https://supabase.com/) project with the `pgvector` extension enabled
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)
- A [Google Cloud OAuth 2.0](https://console.cloud.google.com/) client (for NextAuth)
- An [Upstash Redis](https://upstash.com/) database

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/pavandeveloperr/mediQuery.git
cd mediQuery/mediquery
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp .env.example .env
```

Fill in all required values — see [Environment Variables](#-environment-variables) below.

**4. Enable pgvector on Supabase**

Run the following in your Supabase SQL editor before migrating:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**5. Run database migrations**

```bash
npm run db:migrate
```

**6. Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Environment Variables

Create a `.env` file in the `mediquery/` directory with the following keys:

```env
# ── Database (Supabase) ────────────────────────────────────────────────────────
# Pooled connection — used by Prisma at runtime
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection — used by Prisma Migrate (bypasses PgBouncer)
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# ── Authentication (NextAuth.js) ───────────────────────────────────────────────
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"          # openssl rand -base64 32

# ── Google OAuth ───────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ── Gemini API ─────────────────────────────────────────────────────────────────
GEMINI_API_KEY="your-gemini-api-key"

# ── Upstash Redis (Rate Limiting) ──────────────────────────────────────────────
UPSTASH_REDIS_REST_URL="https://your-upstash-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
```

> ⚠️ **Never commit your `.env` file.** It is listed in `.gitignore` by default.

---

## 📜 Development Scripts

Run these from the `mediquery/` directory:

| Script | Command | Description |
|---|---|---|
| Development server | `npm run dev` | Starts Next.js with hot reload at `localhost:3000` |
| Production build | `npm run build` | Compiles and optimises for production |
| Linting | `npm run lint` | Validates code quality with ESLint |
| DB migrate | `npm run db:migrate` | Applies pending Prisma migrations (`prisma migrate dev`) |
| DB generate | `npm run db:generate` | Regenerates the Prisma client after schema changes |
| DB studio | `npm run db:studio` | Opens Prisma Studio at `localhost:5555` |

---

## ☁️ Deployment

MediQuery is deployed on **Vercel**. The repository is connected to Vercel for automatic deployments on push to `master`.

### Deploy Your Own

**1. Fork and connect to Vercel**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/pavandeveloperr/mediQuery)

**2. Add all environment variables**

In your Vercel project dashboard → **Settings → Environment Variables**, add every key listed in [Environment Variables](#-environment-variables).

> ⚠️ Set `NEXTAUTH_URL` to your Vercel production domain (e.g. `https://mediquery.vercel.app`).

**3. Configure Google OAuth redirect URI**

In [Google Cloud Console](https://console.cloud.google.com/), add your Vercel domain to the list of authorised redirect URIs:

```
https://your-app.vercel.app/api/auth/callback/google
```

**4. Deploy**

Push to `master` — Vercel deploys automatically. You can also trigger a manual deployment from the Vercel dashboard.

### Free Tier Constraints

| Service | Limit | Impact |
|---|---|---|
| Gemini API (free tier) | 20 requests / day | Hard cap enforced via Upstash Redis global bucket |
| Vercel Serverless Functions | 10s execution timeout | PDF processing is async + fire-and-forget |
| Supabase | Auto-pauses after inactivity | Cold-start latency on first request; Prisma handles reconnect |
| Upstash Redis | 10,000 requests / day | Rate-limit checks are the only Redis calls |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Please check the [issues page](https://github.com/pavandeveloperr/mediQuery/issues) before opening a new one.

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Commit with conventional commits
git commit -m "feat: your feature description"

# Open a pull request against master
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built by [Pavan Kulkarni](https://github.com/pavandeveloperr) · Powered by Gemini · Deployed on Vercel

</div>
```
