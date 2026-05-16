# MediQuery — Learning Instructions

Pavan is a 3-year MERN developer learning AI engineering while building this product.
These rules are MANDATORY and apply to every code change made in this project.

---

## After every meaningful code change

Create or update a file in `/docs` using the format below.
Name the file after what was built: `docs/chunking-strategy.md`, `docs/rag-agent.md`, etc.

**Never skip the doc. Code without a doc is useless for learning.**

---

## Doc format — always use this structure

```markdown
# [Topic Name]

## What this is
One paragraph. Plain English. No jargon.

## Why we need it in MediQuery
Concrete reason tied to this project specifically — not generic.

## The code — what each part does
```ts
// paste the key code here
// comment every non-obvious line
```
Explain each important line in plain English below the code block.

## The mental model
One analogy or comparison that makes this click immediately.
Example: "This works like a library card catalogue..."

## What could go wrong
List 2–3 failure cases and exactly how the code handles each one.

## Interview question you can now answer
Write the exact question + a confident 3-sentence answer.

## Skills unlocked
- [ ] TypeScript concept (if applicable)
- [ ] Next.js concept (if applicable)
- [ ] AI/RAG concept (if applicable)
- [ ] System design concept (if applicable)
- [ ] Production/debugging skill (if applicable)
```

---

## How to explain code

1. **Explain the WHY, not just the WHAT.**
   Bad: "This sets BATCH_SIZE to 5."
   Good: "BATCH_SIZE = 5 because Gemini's free tier allows ~60 embedding calls/min.
   Batching 5 at a time with a 200ms pause keeps us safely under the limit."

2. **Flag code review concerns explicitly.**
   "Note: this works, but a senior engineer would question this because in
   production you'd want X instead."

3. **State tradeoffs when multiple approaches exist.**
   "I used X over Y because in serverless environments Y causes Z."

4. **Connect to familiar MERN patterns when possible.**
   "This is like Express middleware, except it runs at the Next.js edge before
   the request reaches any route handler."

5. **Reference NOKI experience when relevant.**
   If a concept maps to something Pavan likely encountered there, say so.

---

## Topics that need docs as they are built

### TypeScript
- [ ] Type inference vs explicit types
- [ ] Interfaces vs type aliases
- [ ] Generics — when and why
- [ ] Async/await with proper error types
- [ ] `"use client"` vs server components — when and why
- [ ] Non-null assertion (`!`) vs optional chaining (`?.`)

### Next.js App Router
- [ ] How file-based routing works
- [ ] Server components vs client components
- [ ] API routes (`route.ts`) — how they work
- [ ] Middleware for auth protection
- [ ] Environment variables — server vs client
- [ ] How streaming works with `ReadableStream`

### Agentic RAG (primary learning focus)
- [ ] What embeddings are and how they work
- [ ] Why 768 dimensions
- [ ] Chunking strategies and tradeoffs
- [ ] Cosine similarity — what it calculates
- [ ] IVFFlat index — how it speeds up search
- [ ] What makes RAG "agentic" vs basic RAG
- [ ] Query reformulation — why and how
- [ ] Confidence scoring — how to implement
- [ ] Streaming LLM responses — how and why

### Senior architectural thinking
- [ ] Singleton pattern — Prisma and Gemini clients
- [ ] Why singletons matter in serverless
- [ ] Rate limiting with token bucket algorithm
- [ ] Cost tracking per API call
- [ ] Separation of concerns — lib vs app vs components
- [ ] When to use server vs client components for performance

### Production and debugging
- [ ] Reading TypeScript error messages
- [ ] Debugging Prisma query errors
- [ ] Handling Gemini API rate limits
- [ ] Environment variable management
- [ ] Database migration strategy
