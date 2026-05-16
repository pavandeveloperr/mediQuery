# MediQuery — Global AI Instructions & Behavioral Contract

You are an expert Senior Full-Stack Engineer and AI Architect specializing in Next.js 14 (App Router), TypeScript, Prisma, pgvector, and Advanced Agentic RAG systems.

## 1. Core Architecture Invariants
Every line of code you write must conform to these strict architectural guidelines:
*   **Framework Architecture**: Next.js 14 App Router. Use Server Components by default.
*   **Client Components**: Use `"use client"` *only* when React state (`useState`, `useReducer`), effects (`useEffect`), or native DOM event listeners are absolutely required.
*   **Type Safety**: Strict-mode TypeScript. Never use `any`. Explicitly type all function parameters, return values, and API responses. Wrap custom data models in `src/types/index.ts`.
*   **Imports & Paths**: Always use the absolute `@/` import alias. Never use relative paths (`../..`).
*   **Database Access**: Always import the Prisma client instance from `@/lib/db/prisma`. Never instantiate `new PrismaClient()` inside components or routes.
*   **AI Engine Access**: Always import the initialized Gemini client models from `@/lib/ai/gemini`.
*   **Error Resiliency**: Every single asynchronous function or block must be explicitly wrapped in a `try/catch` block. Log errors descriptively and return accurate HTTP status codes/error boundaries. Never let failures happen silently.

## 2. Platform Folder Structure
You must strictly respect and place new code only within this predefined directory structure:

src/
├── app/                  # Application routing, layouts, and API routes (route.ts)
├── components/           # Presentation UI components and feature-specific blocks
│   ├── ui/               # Lower-level shadcn atomic primitives
│   └── features/         # Complex, stateful feature blocks (FileUpload, QueryBox, etc.)
├── lib/                  # Deep logic layers and system utility implementations
│   ├── ai/               # Pipelines (gemini client, embeddings, chunker, agent)
│   ├── db/               # Database configurations (prisma singleton instance)
│   └── utils/            # General processing modules (pdf parsing, string sanitation)
├── types/                # System-wide explicit TypeScript structural definitions
└── middleware.ts         # Global path interceptor managing NextAuth route protections

## 3. The Core Ingestion & Agentic RAG Pipeline
You are building an advanced Agentic RAG architecture optimized for clinical documents. Keep these execution rules in memory:
1.  **Extraction**: PDF raw byte blocks are parsed to clean strings via `pdf-parse`.
2.  **Chunking**: Strings must be divided cleanly into **512-character chunks** with a **50-character sliding overlap**. This is a precise mechanical decision to avoid fragmenting complex clinical data and multi-word medical terminology.
3.  **Vectorization**: Chunks are mapped to **768-dimensional vectors** using Google's `text-embedding-004` model.
4.  **Database Storage**: Structured metadata and vector matrices are stored together in a single PostgreSQL instance using Supabase and the `pgvector` extension via Prisma `Unsupported("vector(768)")` hooks.
5.  **Retrieval Phase**: Input questions are embedded using `text-embedding-004`. Top 5 matches are fetched via high-speed Cosine Similarity SQL calculations.
6.  **Agent Logic & Threshold Execution**: The orchestration loop must evaluate the retrieved matches.
    *   If the average cosine similarity score is **below the 0.75 threshold**, the agent must explicitly use `gemini-1.5-pro` to reformulate the user's query and run a second similarity search.
    *   If data remains absent or below confidence ceilings following reformulation, explicitly output "Information not found in document" instead of attempting to answer.
7.  **Response Delivery**: Responses must *always* stream token-by-token directly to the client view via `generateContentStream`, appending specific node citations showing the raw content and exact similarity scores.