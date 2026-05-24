'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Zap } from 'lucide-react'
import type { AgentStep } from '@/types'
import ConfidenceBadge from '@/components/ui/ConfidenceBadge'

const ACTION_LABEL: Record<AgentStep['action'], string> = {
  RETRIEVE: 'Retrieve',
  REFORMULATE: 'Reformulate',
  ANSWER: 'Answer',
  EVALUATE: 'Evaluate',
  FAIL: 'Failed',
}

const ACTION_CHIP: Record<AgentStep['action'], string> = {
  RETRIEVE: 'bg-blue-50 text-blue-600',
  REFORMULATE: 'bg-amber-50 text-amber-600',
  ANSWER: 'bg-emerald-50 text-emerald-600',
  EVALUATE: 'bg-violet-50 text-violet-600',
  FAIL: 'bg-rose-50 text-rose-600',
}

interface Props {
  steps: AgentStep[]
}

export default function AgentStepTrace({ steps }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-600"
      >
        <Zap className="h-3 w-3" />
        <span>Agent reasoning · {steps.length} step{steps.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="flex flex-col items-center gap-1 pt-0.5">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs font-medium font-mono ${ACTION_CHIP[step.action]}`}
                >
                  {ACTION_LABEL[step.action]}
                </span>
                {idx < steps.length - 1 && (
                  <div className="w-px flex-1 bg-slate-200" style={{ minHeight: '12px' }} />
                )}
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <p className="text-xs text-slate-600">{step.thought}</p>
                <p className="truncate font-mono text-xs text-slate-400">
                  &quot;{step.queryUsed}&quot;
                </p>
                {step.scoreAchieved !== undefined && (
                  <ConfidenceBadge score={step.scoreAchieved} showScore />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
