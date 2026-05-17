'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Send, FileText } from 'lucide-react'
import type { UIDocument, UIMessage } from '@/types'
import AgentStepTrace from '@/components/ui/AgentStepTrace'
import ConfidenceBadge from '@/components/ui/ConfidenceBadge'
import { UI_LABELS, SUGGESTED_QUESTIONS } from '@/constants/ui'

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
        <span className="text-xs font-medium text-slate-400">{UI_LABELS.MESSAGE_LABEL_YOU}</span>
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-800">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400">{UI_LABELS.MESSAGE_LABEL_ASSISTANT}</span>
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

function EmptyQueryState({ onSelectQuestion }: { onSelectQuestion: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 pt-12 text-center">
      <div>
        <p className="text-base font-semibold text-slate-700">{UI_LABELS.ASK_ANYTHING}</p>
        <p className="mt-1 text-sm text-slate-400">{UI_LABELS.ANSWERS_GROUNDED}</p>
      </div>
      <div className="flex w-full max-w-lg flex-col gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSelectQuestion(q)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

function NoDocumentSelected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-2xl bg-slate-100 p-5">
        <FileText className="h-10 w-10 text-slate-300" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600">{UI_LABELS.NO_DOCUMENT_SELECTED}</p>
        <p className="mt-1 text-xs text-slate-400">{UI_LABELS.NO_DOCUMENT_DESCRIPTION}</p>
      </div>
    </div>
  )
}

export default function QueryWorkspace({ selectedDocument, messages, onSubmit, isStreaming }: Props) {
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

  function handleSelectSuggestedQuestion(question: string) {
    setInput(question)
    inputRef.current?.focus()
  }

  if (!selectedDocument) {
    return <NoDocumentSelected />
  }

  const canQuery = selectedDocument.status === 'ready'
  const inputPlaceholder = isStreaming
    ? UI_LABELS.STREAMING_PLACEHOLDER
    : UI_LABELS.QUERY_PLACEHOLDER

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5">
        <FileText className="h-4 w-4 text-slate-400" />
        <p className="truncate text-xs text-slate-500">{selectedDocument.name}</p>
        <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Ready
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <EmptyQueryState onSelectQuestion={handleSelectSuggestedQuestion} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 shadow-sm transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canQuery || isStreaming}
            placeholder={inputPlaceholder}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || !canQuery || isStreaming}
            aria-label="Submit question"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">{UI_LABELS.GROUNDED_DISCLAIMER}</p>
      </div>
    </div>
  )
}
