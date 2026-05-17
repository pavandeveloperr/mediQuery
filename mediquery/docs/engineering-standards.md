# MediQuery — Engineering Standards

These rules apply to every line of code in this repository. They take precedence
over any default AI assistant behavior. When in doubt, follow these over training-data
intuition.

---

## 1. Folder Structure

Industry-standard Next.js App Router layout. Every new file must land in the
correct layer — no exceptions.

```
src/
├── app/                    # Routing only — layouts, pages, API route.ts files
│   ├── (auth)/             # Route group: login / signup
│   ├── api/                # API handlers (route.ts files only, no logic here)
│   └── dashboard/
├── components/
│   ├── ui/                 # Atomic, stateless primitives (Button, Badge, Skeleton)
│   ├── features/           # Composed stateful feature blocks (AppShell, DocumentSidebar)
│   └── layouts/            # Shared layout wrappers
├── hooks/                  # All custom React hooks — extracted from components
├── lib/
│   ├── ai/                 # AI pipeline: gemini.ts, embeddings.ts, chunker.ts, agent.ts, retrieval.ts
│   ├── db/                 # Prisma singleton only — no query logic here
│   ├── cache/              # Upstash Redis client + helpers
│   └── utils/              # Pure, side-effect-free utility functions (one file per domain)
├── constants/              # App-wide string and number constants (one file per domain)
├── config/                 # Validated environment variables — the only place to read process.env
└── types/                  # Shared TypeScript interfaces and type aliases
```

### Rules
- `app/api/` route files must only parse the request, call a `lib/` function, and return a response.
  Business logic belongs in `lib/`, never in `route.ts`.
- `components/ui/` components are stateless and have no data-fetching side effects.
- `components/features/` components may use hooks and context but never import from `app/`.
- `hooks/` contains only custom React hooks (`use` prefix). No plain utilities here.
- `lib/utils/` contains only pure functions. No React imports, no Prisma, no Gemini.

---

## 2. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Component files | PascalCase | `DocumentSidebar.tsx` |
| Non-component files | kebab-case | `pdf-parser.ts`, `use-documents.ts` |
| React components | PascalCase | `DocumentCardSkeleton` |
| Custom hooks | camelCase, `use` prefix | `useDocuments`, `useQueryStream` |
| Regular functions | camelCase, verb-first | `fetchDocuments`, `embedText`, `validateChunks` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE_BYTES`, `SIMILARITY_THRESHOLD` |
| Types / Interfaces | PascalCase, no `I` prefix, no `Type` suffix | `UIDocument`, `AgentStep` |
| Boolean variables | `is`, `has`, `can`, `should` prefix | `isLoading`, `hasError`, `canSubmit` |
| Event handlers (component props) | `on` prefix | `onUploadFile`, `onSelect` |
| Event handlers (implementations) | `handle` prefix | `handleFileChange`, `handleSubmit` |
| API route files | always `route.ts` | `src/app/api/documents/route.ts` |
| Constant files | domain-scoped | `src/constants/documents.ts`, `src/constants/query.ts` |

Names must be self-documenting. A reader should understand what a variable holds or
what a function does without reading its implementation.

---

## 3. JSX & Component Design

### No complex inline ternaries
Extract conditions into named variables or components *above* the `return` statement.

```tsx
// BAD — hard to scan, impossible to test
return (
  <div>
    {isLoading ? <Skeleton /> : documents.length === 0 ? <EmptyState /> : <DocumentList docs={documents} />}
  </div>
)

// GOOD — readable at a glance
const content = isLoading
  ? <Skeleton />
  : documents.length === 0
    ? <EmptyState />
    : <DocumentList docs={documents} />

return <div>{content}</div>

// BETTER for complex branching — extract a named component
function DocumentListArea({ isLoading, documents }: DocumentListAreaProps) {
  if (isLoading) return <DocumentListSkeleton />
  if (documents.length === 0) return <EmptyState />
  return <DocumentList docs={documents} />
}
```

### Single Responsibility
One component = one concern. If a component renders multiple logically distinct
sections, each section becomes its own named component.

### Component size limit
If a component file exceeds ~150 lines (excluding imports and type definitions),
split it. A large component is a sign that it has too many responsibilities.

### No anonymous components inside render
Defining components inline inside `return` breaks React reconciliation and causes
unnecessary re-mounts.

```tsx
// BAD
return items.map((item) => {
  const Row = () => <div>{item.name}</div>  // re-created every render
  return <Row key={item.id} />
})

// GOOD — define outside the parent component
function ItemRow({ name }: { name: string }) {
  return <div>{name}</div>
}
```

### Explicit prop interfaces
Every component must have a named, exported `Props` interface (or `ComponentNameProps`
for shared components). No inline type literals for props.

---

## 4. Custom Hooks — Logic/UI Separation

All stateful logic must be extracted from components into custom hooks in `src/hooks/`.
Components should be mostly declarative — they render state, they do not manage it.

```tsx
// BAD — logic lives in the component
export default function DocumentSidebar() {
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/documents').then(r => r.json()).then(setDocuments)
  }, [])
  // ...
}

// GOOD — logic extracted to a hook
// src/hooks/use-documents.ts
export function useDocuments() {
  const [documents, setDocuments] = useState<UIDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // ...
  return { documents, isLoading, refetch }
}

// Component is now pure presentation
export default function DocumentSidebar() {
  const { documents, isLoading } = useDocuments()
  // ...
}
```

---

## 5. Constants — No Hardcoded Strings or Numbers

No string literals or numeric magic values in component JSX or business logic.
Every human-readable label, route path, status string, threshold, or limit lives
in a constants file.

```
src/constants/
├── documents.ts     # Document statuses, labels, file limits
├── query.ts         # Similarity thresholds, agent config, rate limits
├── routes.ts        # API and page path strings
└── ui.ts            # Accessible labels, placeholder text, button copy
```

```ts
// src/constants/documents.ts
export const DOCUMENT_STATUS = {
  READY: 'ready',
  PROCESSING: 'processing',
  FAILED: 'failed',
} as const

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
export const ACCEPTED_MIME_TYPES = ['application/pdf'] as const
export const DOCUMENT_NAME_MAX_CHARS = 26
```

```tsx
// BAD
<p className="...">Documents · {readyCount} ready</p>

// GOOD
import { SIDEBAR_LABELS } from '@/constants/ui'
<p className="...">{SIDEBAR_LABELS.documentsReady(readyCount)}</p>
```

---

## 6. Environment Configuration

`process.env` must never be accessed directly in components, hooks, or route handlers.
All environment variables are validated once at startup in `src/config/env.ts` and
re-exported as typed constants.

```ts
// src/config/env.ts
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  databaseUrl: requireEnv('DATABASE_URL'),
  upstashRedisUrl: requireEnv('UPSTASH_REDIS_REST_URL'),
  upstashRedisToken: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
} as const
```

---

## 7. Pure Utility Functions

`src/lib/utils/` is for stateless, pure, side-effect-free functions.
One file per domain. Functions must return the same output for the same input.

```
src/lib/utils/
├── pdf.ts           # PDF text extraction
├── string.ts        # Text trimming, truncation, sanitization
├── format.ts        # Date, number, score formatting for display
└── validation.ts    # Input validation (file type, size, query length)
```

If a util file starts importing from `lib/ai/` or `lib/db/`, it has crossed the
wrong abstraction boundary. Move it or rename it.

---

## 8. TypeScript Discipline

- **Never `any`** — use `unknown` and narrow with type guards.
- **Never `!` non-null assertions** — handle `null`/`undefined` explicitly.
- **Type-first design** — define the interface or type before writing the implementation.
- **Discriminated unions** for state machines, not boolean flags.
- **No type assertions with `as`** unless you have a comment explaining why it is safe.

```ts
// BAD
const doc = result as Document

// GOOD
if (!isDocument(result)) throw new Error('[parseResult] unexpected shape')
const doc = result
```

- API response shapes must be defined in `src/types/` and imported in both the
  route handler and the consuming component. They must never diverge.

---

## 9. Error Handling

- Every `async` function must have a `try/catch`.
- Never swallow errors silently (`catch (e) {}`).
- Log errors with a module prefix: `console.error('[moduleName] description', error)`.
- HTTP routes return typed error shapes: `{ error: string, code?: string }`.
- UI surfaces errors via explicit error state — never leave the user on a blank screen.
- `console.log` is not allowed in committed code. Use `console.error` in catch blocks only.

---

## 10. Accessibility

- Use semantic HTML: `<button>` for actions, `<a>` for navigation, `<main>`, `<nav>`, `<aside>`, etc.
- Every interactive element needs a visible label or an `aria-label` / `aria-labelledby`.
- Keyboard navigation must work: tab order, focus rings, Enter/Space on buttons.
- Images require `alt` text (empty string `alt=""` for decorative images).
- Color must not be the only way to convey status — pair it with an icon or text.

---

## 11. Performance

- `useMemo`, `useCallback`, and `React.memo` are only added when a measured
  performance problem exists — not preemptively.
- When memoization is added, leave a comment with the measured reason.
- Use Next.js dynamic imports (`next/dynamic`) for feature components that are
  only needed on interaction (e.g., a heavy modal or chart).
- Never block the main thread in a route handler — all DB and AI calls are `async`.

---

## 12. API Design

- Route handlers are thin: parse → validate → delegate to `lib/` → respond.
- Request bodies and query params are validated before use (never trust client input).
- Every route returns a consistent shape: `{ data }` on success, `{ error }` on failure.
- HTTP status codes must be accurate: 400 bad input, 401 unauthenticated, 403 unauthorized,
  404 not found, 422 processing error, 429 rate limited, 500 server fault.

---

## 13. Git & Commit Discipline

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`
- Each commit is atomic and reversible — one logical change per commit.
- Never commit with TypeScript errors, lint errors, or failing tests.
- Branch names: `feature/<short-description>`, `fix/<short-description>`

---

## What was missing from the original rules (added above)

These are the practices that were not in the original instructions but are essential
for a production codebase at scale:

| Practice | Where it's defined |
|---|---|
| Custom hooks for logic/UI separation | Section 4 |
| `src/constants/` with no hardcoded strings anywhere | Section 5 |
| `src/config/env.ts` validated environment config | Section 6 |
| `src/lib/utils/` pure-function discipline | Section 7 |
| TypeScript: no `!`, no `as`, `unknown` over `any` | Section 8 |
| Semantic HTML and accessibility requirements | Section 10 |
| Performance: measure before memoizing | Section 11 |
| API thin-handler pattern + consistent response shapes | Section 12 |
| Conventional commits + atomic commits | Section 13 |
| Component size limit (~150 lines) | Section 3 |
| Discriminated unions for state machines | Section 8 |
| No anonymous components defined inside render | Section 3 |
| `console.log` banned from committed code | Section 9 |
| Type-first design (define types before implementation) | Section 8 |
