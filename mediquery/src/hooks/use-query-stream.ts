'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import type { UIMessage, MedicalChunk, RAGStreamPayload } from '@/types'
import type { QueryHistoryItem } from '@/app/api/queries/route'

export function useQueryStream(selectedDocId: string | null) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [activeCitations, setActiveCitations] = useState<MedicalChunk[]>([])
  const [isCitationsOpen, setIsCitationsOpen] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [remainingQueries, setRemainingQueries] = useState<number | null>(null)
  const streamingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      streamingRef.current = false
    }
  }, [])

  // Populate the quota chip immediately on mount without waiting for a query.
  useEffect(() => {
    async function fetchQuota() {
      try {
        const res = await fetch('/api/query/quota')
        if (!res.ok) return
        const data = (await res.json()) as { remaining: number }
        setRemainingQueries(data.remaining)
      } catch (error) {
        console.error('[useQueryStream] fetchQuota failed:', error)
      }
    }
    void fetchQuota()
  }, [])

  // Load query history whenever the selected document changes
  useEffect(() => {
    if (!selectedDocId) {
      setMessages([])
      setActiveCitations([])
      return
    }

    async function loadHistory() {
      setIsHistoryLoading(true)
      setMessages([])
      try {
        const res = await fetch(`/api/queries?documentId=${selectedDocId}`)
        if (!res.ok) return

        const items: QueryHistoryItem[] = await res.json()

        const hydrated: UIMessage[] = items.flatMap((item) => [
          {
            id: `${item.id}-user`,
            role: 'user' as const,
            content: item.question,
            timestamp: item.createdAt,
          },
          {
            id: `${item.id}-assistant`,
            role: 'assistant' as const,
            content: item.answer,
            isStreaming: false,
            confidenceScore: item.confidence,
            citations: item.citations,
            agentSteps: item.agentSteps,
            timestamp: item.createdAt,
          },
        ])

        setMessages(hydrated)

        // Surface the most recent query's citations on load
        const lastCitations = items.at(-1)?.citations ?? []
        if (lastCitations.length > 0) {
          setActiveCitations(lastCitations)
        }
      } catch (error) {
        console.error('[useQueryStream] loadHistory failed:', error)
      } finally {
        setIsHistoryLoading(false)
      }
    }

    void loadHistory()
  }, [selectedDocId])

  const clearMessages = useCallback(() => {
    setMessages([])
    setActiveCitations([])
  }, [])

  const streamQuery = useCallback(
    async (messageId: string, question: string, docId: string) => {
      const abort = new AbortController()
      abortRef.current = abort
      streamingRef.current = true
      setIsStreaming(true)

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, documentId: docId }),
          signal: abort.signal,
        })

        if (!response.ok || !response.body) {
          if (response.status === 429) {
            toast.error('Daily query limit reached — 20 queries per day')
          }
          throw new Error(`Query failed with status ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        // Incomplete SSE lines accumulate here across multiple read() chunks.
        let buffer = ''

        while (streamingRef.current) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // The last element may be an incomplete line — keep it in the buffer.
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const rawData = line.slice(6).trim()

            if (rawData === '[DONE]') {
              streamingRef.current = false
              break
            }

            try {
              const payload = JSON.parse(rawData) as RAGStreamPayload

              if (payload.token) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId ? { ...m, content: m.content + payload.token } : m
                  )
                )
              }

              // Error event — show the message and stop streaming.
              if (payload.error !== undefined) {
                toast.error(payload.error)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId
                      ? { ...m, content: payload.error!, isStreaming: false }
                      : m
                  )
                )
              }

              // Citations present means this is the final metadata event.
              if (payload.citations !== undefined) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === messageId
                      ? {
                          ...m,
                          isStreaming: false,
                          confidenceScore: payload.confidenceScore,
                          citations: payload.citations,
                          agentSteps: payload.steps,
                        }
                      : m
                  )
                )
                if (payload.citations.length > 0) {
                  setActiveCitations(payload.citations)
                  setIsCitationsOpen(true)
                }
                if (payload.remainingQueries !== undefined) {
                  setRemainingQueries(payload.remainingQueries)
                }
              }
            } catch {
              // Malformed JSON line — skip silently.
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return

        console.error('[useQueryStream] stream error:', error)
        const is429 = error instanceof Error && error.message.includes('429')
        if (!is429) toast.error('Query failed — please try again')
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: 'An error occurred. Please try again.', isStreaming: false }
              : m
          )
        )
      } finally {
        streamingRef.current = false
        setIsStreaming(false)
        // Safety net: clear the blinking cursor on the message regardless of how the stream ended.
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId && m.isStreaming ? { ...m, isStreaming: false } : m))
        )
      }
    },
    []
  )

  const handleSubmit = useCallback(
    (question: string) => {
      if (!selectedDocId) return

      const userMsg: UIMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      }
      const assistantId = `msg-${Date.now()}-assistant`
      const assistantMsg: UIMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      void streamQuery(assistantId, question, selectedDocId)
    },
    [selectedDocId, streamQuery]
  )

  return {
    messages,
    activeCitations,
    isCitationsOpen,
    setIsCitationsOpen,
    isStreaming,
    isHistoryLoading,
    remainingQueries,
    handleSubmit,
    clearMessages,
  }
}
