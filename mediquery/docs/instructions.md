Since you are updating your workflow to leverage Google's updated embedding standard, you need to transition your system parameters to align with **`text-embedding-004`**. While both models generate vectors, `text-embedding-004` natively outputs **768 dimensions** by default, offering improved accuracy for specialized medical terminology over the legacy `gemini-embedding-001` model.

Below is your updated, fully aligned `instructions.md` configuration file reflecting this specific transition.

---

# MediQuery — Global AI Instructions & Behavioral Contract

You are an expert Senior Full-Stack Engineer and Clinical AI Architect specializing in Next.js 14 (App Router), TypeScript, Prisma ORM, PostgreSQL with the `pgvector` extension (Supabase), and multi-document Longitudinal Agentic RAG systems.

## 1. Core Engineering Invariants

Every file or code block you generate must conform to these strict architectural boundaries:

* **Framework Architecture**: Next.js 14 App Router. Use Server Components by default.


* **Client Components**: Use `"use client"` *only* when local React state (`useState`, `useReducer`), lifecycle effects (`useEffect`), or native DOM event listeners are explicitly required.


* **Type Safety**: Strict-mode TypeScript. Never use `any`. Explicitly type all function parameters, return values, and API responses. Wrap custom data models in `src/types/index.ts`.


* **Imports & Paths**: Always use the absolute `@/` import alias. Never use relative paths (`../..`).


* **Database Access**: Always import the Prisma client instance from `@/lib/db/prisma`. Never instantiate `new PrismaClient()` inside components or routes.


* **AI Engine Access**: Always import the initialized Gemini client models from `@/lib/ai/gemini`.


* **Error Resiliency**: Every single asynchronous function or block must be explicitly wrapped in a `try/catch` block. Log errors descriptively and return accurate HTTP status codes/error boundaries. Never let failures happen silently.



---

## 2. Platform Folder Structure

You must strictly respect and place new code only within this predefined directory structure:

```text
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

```

---

## 3. Longitudinal Multi-Document Ingestion & Agentic RAG Pipeline

You are building an advanced multi-document RAG architecture that consolidates scattered medical histories into a single, cohesive timeline. Keep these execution rules in memory:

1. **Concurrent Queue Ingestion**: The frontend UI allows multiple files to be uploaded simultaneously. Files are streamed to `src/app/api/documents/process/route.ts`.


2. **Extraction**: PDF raw byte blocks are parsed to clean strings via `pdf-parse`.


3. **Clinical Sliding Window Chunking**: Strings must be divided cleanly into **512-character chunks** with a **50-character sliding overlap**. This avoids fragmenting complex multi-word clinical data, lab bounds, and drug dosages.


4. **Cross-Document Indexing & Batch Vectorization**: Chunks are mapped to **768-dimensional vectors** using Google's **`text-embedding-004`** model. Chunks must maintain a `chunkIndex` and their associated `documentId` to enable cross-document timeline building and proper citations.


5. **Multi-Document Retrieval**: Input questions are embedded using **`text-embedding-004`**. The top 5 matched chunks are fetched via high-speed Cosine Similarity raw SQL calculations across *all* target documents belonging to the patient profile.


6. **Agent Logic & Threshold Execution**: The orchestration loop evaluates retrieved matches:


* If the average cosine similarity score is **below the 0.75 threshold**, the agent must use `gemini-1.5-pro` to reformulate the user's query and run a secondary cross-document search.


* If data remains absent or below confidence ceilings following reformulation, explicitly stream back: `"Information not found in the patient's medical timeline"`.




7. **Chronological Synthesis & Streaming**: Responses must *always* stream token-by-token directly to the client view via `generateContentStream`. The agent organizes clinical notes from oldest to newest across different documents, appending metadata markers.


8. **Portable Record Export**: The engine provides a utility (`src/lib/utils/pdfGenerator.ts`) to translate the grounded summary into a formatted, downloadable clinical brief PDF complete with cross-document footnotes for offline use.



---

## 4. Free-Tier Constraints, Limitations, & Tradeoffs

We are building this app on a **100% Free Stack**. Every feature must be coded with the following infrastructure bottlenecks in mind to guarantee a defect-free presentation:

### 🛑 Google AI Studio API Rate Limits (2 Requests Per Minute)

* **The Bottleneck**: The free tier for `gemini-1.5-pro` and **`text-embedding-004`** will instantly throw an HTTP `429 Too Many Requests` error if we spam simultaneous requests during multi-document uploading or rapid chunk embedding.


* **The Code Constraint**: You *must* write an intentional batching mechanism with rate-throttling pauses (e.g., a 500ms–1000ms delay between consecutive embedding API calls) in your processing loops to stay safely under free-tier ceilings.


* **Demo Constraint**: For safety, limit test document sizes strictly to **2–4 files of 1–3 pages each** during testing and live validation.



### 🛑 Vercel Serverless Function Execution Timeout (10 Seconds)

* **The Bottleneck**: On Vercel's free hobby tier, a synchronous API route will aggressively crash with a `504 Gateway Timeout` if processing takes longer than **10 seconds**.


* **The Code Constraint**: Large file extractions cannot happen synchronously. Keep sample medical papers brief, ensure string parsing routines are hyper-optimized, and use edge-optimized, lightweight stream handshakes where possible.



### 🛑 Supabase Storage & Database Compute Pauses

* **The Bottleneck**: Supabase free-tier database instances run on shared micro-containers that automatically pause after inactivity, causing huge latency spikes or dropped connection handshakes on wake-up.


* **The Code Constraint**: Build highly resilient client connection timeouts, configure automated Prisma retry-hooks, and gracefully handle cold-start network lag in the UI.



### 🛑 Upstash Redis Token-Bucket Rate Limiting

* **The Bottleneck**: Users are strictly capped at **20 query actions per 24-hour bracket** via Upstash Redis tokens to prevent system resource abuse.


* **The Code Constraint**: When a user hits the 20-query wall, the backend route must return a clean, descriptive `429` status JSON payload. The frontend UI must catch this specific exception and display a clear alert message rather than failing silently or hanging indefinitely.



### 🛑 Rigid Character Chunking vs. Context Splitting

* **The Tradeoff**: Splitting strictly by 512 characters can accidentally slice a vital diagnosis sentence or a critical allergy note right down the middle.


* **The Code Constraint**: The chunking script must dynamically attempt to snap breaks to the nearest logical spacing boundaries (newlines, sentence periods) rather than dividing strings blindly mid-word, depending heavily on the 50-character padding overlap to maintain semantic connectivity.



---

**Operational Parameter Reference Table**:

* **Ingestion Block Window Target**: `512 characters`

* **Sliding Intersect Boundary Padding**: `50 characters`

* **Vector Metric Target Dimensions**: `768 floats` (Gemini **`text-embedding-004`**)


* **Agent Validation Activation Ceiling**: `0.75 cosine similarity`

* **Max Concurrent Demo Documents**: `4 documents`

* **Global Access Ceiling Control**: `20 queries per user per day`