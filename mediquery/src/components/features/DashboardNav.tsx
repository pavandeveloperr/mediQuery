import { BookOpen } from 'lucide-react'
import { UI_LABELS } from '@/constants/ui'
import { DAILY_QUERY_LIMIT } from '@/constants/ai'

interface Props {
  remainingQueries: number | null
  onSignOut: () => void
}

function QuotaChip({ remaining }: { remaining: number }) {
  const isLow = remaining <= 5
  const className = isLow
    ? 'bg-rose-100 text-rose-600'
    : 'bg-slate-100 text-slate-500'

  return (
    <span
      className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:block ${className}`}
      title={UI_LABELS.QUOTA_TOOLTIP}
    >
      {remaining} / {DAILY_QUERY_LIMIT} left
    </span>
  )
}

export default function DashboardNav({ remainingQueries, onSignOut }: Props) {
  return (
    <nav className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-slate-800">{UI_LABELS.APP_TITLE}</span>
      </div>
      <div className="flex items-center gap-4">
        {remainingQueries !== null && <QuotaChip remaining={remainingQueries} />}
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          {UI_LABELS.SIGN_OUT}
        </button>
      </div>
    </nav>
  )
}
