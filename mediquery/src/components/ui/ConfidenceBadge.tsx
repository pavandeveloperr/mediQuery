type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

// Score is a composite of retrieval similarity (20%), LLM-judged groundedness
// (55%), and LLM-judged completeness (25%). Well-supported answers land in the
// 0.85+ range; partial or weakly-grounded answers fall in 0.65–0.85.
function getLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'HIGH'
  if (score >= 0.70) return 'MEDIUM'
  return 'LOW'
}

const LEVEL_TOOLTIP: Record<ConfidenceLevel, string> = {
  HIGH: 'Answer is well-grounded in retrieved sources',
  MEDIUM: 'Answer is partially supported by retrieved sources',
  LOW: 'Answer may be incomplete or weakly supported',
}

const BADGE_STYLES: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  MEDIUM: 'bg-amber-100 text-amber-700 ring-amber-200',
  LOW: 'bg-rose-100 text-rose-700 ring-rose-200',
}

const DOT_STYLES: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-rose-500',
}

interface Props {
  score: number
  showScore?: boolean
  size?: 'sm' | 'md'
}

export default function ConfidenceBadge({ score, showScore = false, size = 'sm' }: Props) {
  const level = getLevel(score)
  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'

  return (
    <span
      title={LEVEL_TOOLTIP[level]}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${padding} ${BADGE_STYLES[level]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[level]}`} />
      {level}
      {showScore && (
        <span className="opacity-60">· {(score * 100).toFixed(0)}%</span>
      )}
    </span>
  )
}
