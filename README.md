# MediQuery 🏥

> **Clinical Document Intelligence Platform** — Upload medical PDFs, ask natural language questions, and receive grounded, cited answers powered by an Agentic RAG pipeline.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Hosted-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Google Gemini](https://img.shields.io/badge/Gemini-1.5_Pro-4285F4?style=flat-square&logo=google)](https://deepmind.google/technologies/gemini/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [AI Pipeline Architecture](#-ai-pipeline-architecture)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running Locally](#running-locally)
- [Scripts Reference](#-scripts-reference)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

**MediQuery** is a full-stack clinical document intelligence platform built for healthcare professionals and researchers. It enables users to upload medical PDFs and interact with their content through a conversational interface backed by a sophisticated, multi-step Agentic RAG (Retrieval-Augmented Generation) pipeline.

Unlike naive RAG systems, MediQuery uses an AI agent that autonomously evaluates retrieval confidence and reformulates queries when needed — ensuring answers are always grounded in the source material, with explicit citations to prevent hallucinations.

---

## ✨ Key Features

- 📄 **PDF Ingestion** — Upload clinical documents for automatic text extraction and intelligent chunking
- 🤖 **Agentic RAG Pipeline** — Multi-step AI agent with autonomous query reformulation on low-confidence retrievals
- 🔍 **Semantic Vector Search** — Cosine similarity search over 768-dimensional embeddings via pgvector
- 💬 **Streamed Responses** — Real-time answer streaming from Gemini 1.5 Pro with source citations
- 🔐 **Google OAuth** — Secure authentication via NextAuth.js
- ⚡ **Rate Limiting** — Upstash Redis-backed API protection
- 📊 **RAG Evaluation** — Built-in LLM-as-judge faithfulness and relevance scoring
- 🧾 **Cost & Token Tracking** — Per-query token count, USD cost, and agent step logging

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (Strict Mode) |
| **Styling** | Tailwind CSS v4, PostCSS, shadcn/ui |
| **Database** | PostgreSQL + pgvector (Supabase) |
| **ORM** | Prisma |
| **AI Generation** | Google Gemini API (`gemini-1.5-pro`) |
| **Embeddings** | Google `text-embedding-004` (768 dims) |
| **Authentication** | NextAuth.js (Google OAuth 2.0) |
| **Rate Limiting** | Upstash Redis |
| **Deployment** | Vercel |

---

## 🧠 AI Pipeline Architecture

MediQuery's intelligence layer is a five-stage agentic pipeline designed for accuracy and grounded output.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MediQuery RAG Pipeline                       │
├─────────┬──────────────┬───────────────┬──────────────┬────────────┤
│  Stage  │    Input     │   Operation   │    Output    │   Store    │
├─────────┼──────────────┼───────────────┼──────────────┼────────────┤
│   1     │  PDF Upload  │ Text Extract  │  Raw Text    │    —       │
│   2     │  Raw Text    │   Chunking    │  512c/50ovlp │    —       │
│         │              │  (512 chars,  │              │            │
│         │              │  50 overlap)  │              │            │
│   3     │  Text Chunks │  Embed via    │  768-dim     │ pgvector   │
│         │              │  text-emb-004 │  Vectors     │            │
│   4     │  User Query  │  Embed →      │  Top-K       │    —       │
│         │              │  Cosine Sim   │  Chunks      │            │
│   5     │  Top-K +     │  Agent Eval   │  Reformulate │    —       │
│         │  Similarity  │  (< 0.75?)    │  or Proceed  │            │
│   6     │  Context     │  Gemini Gen   │  Streamed    │  Query DB  │
│         │              │  + Citations  │  Answer      │            │
└─────────┴──────────────┴───────────────┴──────────────┴────────────┘
```

### Stage Breakdown

- **Stage 1 — Ingestion:** Uploaded PDFs are parsed and raw text is extracted page-by-page.
- **Stage 2 — Chunking:** Text is split into 512-character chunks with a 50-character overlap to preserve context across boundaries.
- **Stage 3 — Embedding & Storage:** Each chunk is embedded using Google's `text-embedding-004` model (768 dimensions) and stored in PostgreSQL via pgvector.
- **Stage 4 — Retrieval:** The user's question is embedded and a cosine similarity search is performed against stored chunk vectors to surface the most relevant context.
- **Stage 5 — Agent Evaluation:** The AI agent inspects the top retrieval similarity score. If it falls below the **0.75 threshold**, the agent autonomously reformulates the query and re-retrieves before proceeding.
- **Stage 6 — Generation:** Verified context is passed to `gemini-1.5-pro`, which streams the final answer with strict source grounding and inline citations.

---

## 📁 Project Structure

```
mediquery/
├── prisma/
│   └── schema.prisma             # Database schema and model definitions
├── src/
│   ├── app/                      # Next.js App Router — pages and API routes
│   │   ├── api/                  # Backend API route handlers
│   │   ├── (auth)/               # Authentication pages
│   │   └── (dashboard)/          # Protected application pages
│   ├── components/               # Reusable UI and feature layout components
│   │   ├── ui/                   # shadcn/ui base primitives
│   │   └── features/             # Domain-specific composite components
│   ├── lib/
│   │   ├── ai/                   # Core AI pipeline modules
│   │   │   ├── gemini.ts         # Gemini API client and generation logic
│   │   │   ├── embeddings.ts     # text-embedding-004 vector utilities
│   │   │   ├── chunker.ts        # Text chunking with overlap strategy
│   │   │   └── agent.ts          # Agentic RAG orchestrator
│   │   └── db/
│   │       └── prisma.ts         # Prisma client singleton
│   └── types/                    # TypeScript interfaces and type definitions
├── .env.example                  # Environment variable template
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── postcss.config.mjs            # PostCSS configuration
└── package.json
```

---

## 🗄 Database Schema

MediQuery uses five Prisma models to manage the full document-to-answer lifecycle.

```prisma
// User — OAuth-backed account, owns documents and queries
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  name      String?
  image     String?
  documents Document[]
  queries   Query[]
}

// Document — Represents an uploaded PDF
model Document {
  id          String   @id @default(cuid())
  name        String
  storagePath String
  fileSize    Int
  pageCount   Int
  status      String   @default("processing")
  chunks      Chunk[]
  userId      String
  user        User     @relation(fields: [userId], references: [id])
}

// Chunk — Individual text node with vector embedding
model Chunk {
  id         String   @id @default(cuid())
  content    String
  chunkIndex Int
  tokenCount Int
  embedding  Float[]  // pgvector column (768 dims)
  documentId String
  document   Document @relation(fields: [documentId], references: [id])
}

// Query — Full AI transaction log
model Query {
  id         String  @id @default(cuid())
  question   String
  answer     String
  confidence Float
  tokenCount Int
  costUsd    Float
  agentSteps Json    // Array of agent reasoning steps
  sources    Json    // Array of cited chunk references
  userId     String
  user       User    @relation(fields: [userId], references: [id])
}

// EvalResult — RAG quality metrics per evaluation run
model EvalResult {
  id            String   @id @default(cuid())
  faithfulness  Float    // LLM-as-judge faithfulness score
  relevance     Float    // Retrieval relevance score
  precision     Float    // Context precision score
  questionCount Int
  createdAt     DateTime @default(now())
}
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed and configured before proceeding:

- **Node.js** `>= 18.x`
- **npm** `>= 9.x`
- A **Supabase** project with the `pgvector` extension enabled
- A **Google Cloud** project with the Gemini API and OAuth 2.0 credentials configured
- An **Upstash Redis** database

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/mediquery.git
cd mediquery

# 2. Install dependencies
npm install
```

### Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Open `.env` and configure the following variables:

```env
# ── Database (Supabase + Prisma) ──────────────────────────────────────
# Pooled connection URL for Prisma query engine (via PgBouncer)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection URL for Prisma Migrate (bypasses PgBouncer)
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# ── Google Gemini API ─────────────────────────────────────────────────
GEMINI_API_KEY="your-gemini-api-key"

# ── NextAuth.js ───────────────────────────────────────────────────────
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"          # Generate: openssl rand -base64 32

# ── Google OAuth 2.0 ─────────────────────────────────────────────────
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ── Upstash Redis (Rate Limiting) ─────────────────────────────────────
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
```

> **Note:** `DATABASE_URL` uses the pooled connection for runtime queries. `DIRECT_URL` uses the direct connection and is required exclusively for Prisma migration commands (`db:migrate`, `db:generate`).

### Database Setup

Run the following commands to initialize your database schema:

```bash
# Generate the Prisma client from your schema
npm run db:generate

# Apply migrations to your Supabase database
npm run db:migrate
```

> **pgvector:** Ensure the `vector` extension is enabled in your Supabase project. Run `CREATE EXTENSION IF NOT EXISTS vector;` in the Supabase SQL editor if it is not already active.

### Running Locally

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

---

## 📜 Scripts Reference

| Script | Command | Description |
|---|---|---|
| **dev** | `npm run dev` | Starts the Next.js development server with hot reload |
| **build** | `npm run build` | Compiles and bundles the application for production |
| **lint** | `npm run lint` | Runs ESLint to validate code quality and style |
| **db:migrate** | `npm run db:migrate` | Executes pending Prisma development migrations |
| **db:generate** | `npm run db:generate` | Regenerates the Prisma client from `schema.prisma` |
| **db:studio** | `npm run db:studio` | Opens Prisma Studio, a visual database explorer |

---

## ☁️ Deployment

MediQuery is optimized for deployment on **Vercel**.

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/mediquery)

### Manual Deployment Steps

- **Step 1 — Push to GitHub:** Ensure your repository is connected to your Vercel project.
- **Step 2 — Configure Environment Variables:** Add all variables from your `.env` file to your Vercel project under **Settings → Environment Variables**. Set `NEXTAUTH_URL` to your production domain (e.g., `https://mediquery.vercel.app`).
- **Step 3 — Deploy:** Vercel will automatically build and deploy on every push to your main branch.

### Post-Deployment Checklist

- [ ] `NEXTAUTH_URL` is set to the correct production URL
- [ ] Google OAuth 2.0 **Authorized redirect URIs** includes `https://your-domain.vercel.app/api/auth/callback/google`
- [ ] Supabase `DATABASE_URL` and `DIRECT_URL` are configured in Vercel environment variables
- [ ] `pgvector` extension is enabled on your Supabase instance
- [ ] Upstash Redis credentials are set for production rate limiting

---

## 🤝 Contributing

Contributions are welcome. To contribute:

- Fork the repository
- Create a feature branch: `git checkout -b feature/your-feature-name`
- Commit your changes: `git commit -m 'feat: add your feature'`
- Push to your branch: `git push origin feature/your-feature-name`
- Open a Pull Request against `master`

Please ensure `npm run lint` and `npm run build` pass before submitting.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/pavandeveloperr">Pavan Kulkarni</a></sub>
</div>
