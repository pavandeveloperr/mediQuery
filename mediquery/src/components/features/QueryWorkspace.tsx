'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Send, FileText } from 'lucide-react'
import type { UIDocument, UIMessage, MedicalChunk, AgentStep } from '@/types'
import AgentStepTrace from '@/components/ui/AgentStepTrace'
import ConfidenceBadge from '@/components/ui/ConfidenceBadge'

// ── Mock data (replaced by real API in Phase 3) ───────────────────────────────

const MOCK_RESPONSE =
  'Based on the discharge summary, the patient is currently prescribed the following medications:\n\n' +
  '• Metformin 500mg — twice daily with meals, for blood glucose management\n' +
  '• Lisinopril 10mg — once daily in the morning, for blood pressure control\n' +
  '• Atorvastatin 40mg — once at bedtime, added at discharge for lipid management\n\n' +
  'The attending physician Dr. Sarah Chen noted no adverse drug reactions during the 5-day hospital stay. ' +
  'Renal function tests, including creatinine and eGFR, returned within normal limits throughout admission.\n\n' +
  'Follow-up bloodwork (HbA1c and renal panel) is recommended in 4–6 weeks. The patient was advised to monitor ' +
  'blood glucose levels daily and report any changes to their primary care provider.'

const MOCK_CITATIONS: MedicalChunk[] = [
  {
    id: 'chunk-4',
    content:
      'Patient is currently prescribed metformin 500mg twice daily with meals and lisinopril 10mg once daily in the morning. Atorvastatin 40mg was added at discharge for lipid management following elevated LDL readings.',
    chunkIndex: 4,
    documentId: 'doc-1',
    similarity: 0.91,
  },
  {
    id: 'chunk-7',
    content:
      'Attending physician Dr. Sarah Chen noted no adverse drug reactions during the 5-day hospital stay. Renal function tests, including creatinine and eGFR, returned within normal limits throughout admission.',
    chunkIndex: 7,
    documentId: 'doc-1',
    similarity: 0.83,
  },
  {
    id: 'chunk-11',
    content:
      'Follow-up appointment recommended in 4–6 weeks. Patient advised to monitor blood glucose levels daily using home glucometer and report HbA1c results to primary care provider at next scheduled visit.',
    chunkIndex: 11,
    documentId: 'doc-1',
    similarity: 0.74,
  },
]

const MOCK_AGENT_STEPS: AgentStep[] = [
  {
    thought: 'Searching document for sections related to current medications and prescriptions',
    action: 'RETRIEVE',
    queryUsed: 'current medications prescribed patient discharge',
    scoreAchieved: 0.91,
    timestamp: new Date().toISOString(),
  },
  {
    thought: 'Confidence score 0.91 exceeds threshold of 0.75 — proceeding to generate grounded answer',
    action: 'ANSWER',
    queryUsed: 'current medications prescribed patient discharge',
    scoreAchieved: 0.91,
    timestamp: new Date().toISOString(),
  },
]

const SUGGESTED_QUESTIONS = [
  'What medications is the patient currently prescribed?',
  'Are there any abnormal findings in the lab results?',
  'What follow-up actions were recommended by the physician?',
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  selectedDocument: UIDocument | null
  messages: UIMessage[]
  onSubmit: (question: string) => void
  isStreaming: boolean
}

function MessageBubble({ message }: { message: UIMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-400">You</span>
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-800">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400">MediQuery</span>
        {!message.isStreaming && message.confidenceScore !== undefined && (
          <ConfidenceBadge score={message.confidenceScore} showScore size="sm" />
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 whitespace-pre-wrap">
        {message.content}
        {message.isStreaming && (
          <span className="ml-0.5 inline-block animate-pulse text-blue-500">▌</span>
        )}
      </div>
      {!message.isStreaming && message.agentSteps && message.agentSteps.length > 0 && (
        <AgentStepTrace steps={message.agentSteps} />
      )}
    </div>
  )
}

export default function QueryWorkspace({
  selectedDocument,
  messages,
  onSubmit,
  isStreaming,
}: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(() => {
    const question = input.trim()
    if (!question || isStreaming) return
    setInput('')
    onSubmit(question)
    inputRef.current?.focus()
  }, [input, isStreaming, onSubmit])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canQuery = selectedDocument?.status === 'ready'

  // ── No document selected ───────────────────────────────────────────────────
  if (!selectedDocument) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-2xl bg-slate-100 p-5">
          <FileText className="h-10 w-10 text-slate-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">No document selected</p>
          <p className="mt-1 text-xs text-slate-400">
            Upload and select a document from the sidebar to begin querying
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Document context bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5">
        <FileText className="h-4 w-4 text-slate-400" />
        <p className="truncate text-xs text-slate-500">{selectedDocument.name}</p>
        <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Ready
        </span>
      </div>

      {/* Messages / empty state */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-6 pt-12 text-center">
            <div>
              <p className="text-base font-semibold text-slate-700">Ask anything about this document</p>
              <p className="mt-1 text-sm text-slate-400">
                Answers are grounded in retrieved chunks with full source citations
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-lg">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setInput(q)
                    inputRef.current?.focus()
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 shadow-sm transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canQuery || isStreaming}
            placeholder={
              isStreaming
                ? 'Generating response…'
                : 'Ask a clinical question about this document…'
            }
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || !canQuery || isStreaming}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">
          Answers are cited and grounded — no hallucinations
        </p>
      </div>
    </div>
  )
}
