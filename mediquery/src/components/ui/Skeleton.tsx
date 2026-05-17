// Zero-dependency shimmer primitives built on Tailwind animate-pulse.
// Compose DocumentCardSkeleton / MessageSkeleton directly; use Skeleton/SkeletonLine
// for one-off shapes elsewhere.

interface BaseProps {
  className?: string
}

export function Skeleton({ className = '' }: BaseProps) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
}

export function SkeletonLine({ className = '' }: BaseProps) {
  return <Skeleton className={`h-3 ${className}`} />
}

export function SkeletonCircle({ className = '' }: BaseProps) {
  return <Skeleton className={`rounded-full ${className}`} />
}

/** Matches the document button card in DocumentSidebar */
export function DocumentCardSkeleton() {
  return (
    <div className="w-full rounded-xl px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <SkeletonCircle className="mt-1.5 h-2 w-2 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/3" />
        </div>
      </div>
    </div>
  )
}

/** Matches a user or assistant message bubble in QueryWorkspace */
export function MessageSkeleton({ role = 'assistant' }: { role?: 'user' | 'assistant' }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className="w-72 space-y-2 rounded-2xl border border-slate-100 bg-white p-4">
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-4/5" />
        <SkeletonLine className="w-2/3" />
      </div>
    </div>
  )
}
