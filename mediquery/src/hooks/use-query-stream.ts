'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useQueryHistory } from '@/hooks/use-query-history'
import { useQueryQuota } from '@/hooks/use-query-quota'
import type { UIMessage, MedicalChunk, RAGStreamPayload } from '@/types'
import { API_ROUTES } from '@/constants/routes'
import { UI_LABELS } from '@/constants/ui'

export function useQueryStream(selectedDocId: string | null) {
  const { messages, setMessages, lastCitations, isHistoryLoading } = useQueryHistory(selectedDocId)
  const { remainingQueries, setRemainingQueries } = useQueryQuota()

  const [activeCitations, setActiveCitations] = useState<MedicalChunk[]>([])
  const [isCitationsOpen, setIsCitationsOpen] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)

  const streamingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Surface the most recent query's citations when history loads.
  useEffect(() => {
    if (lastCitations.length > 0) setActiveCitations(lastCitations)
  }, [lastCitations])

  // Cancel any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      streamingRef.current = false
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setActiveCitations([])
  }, [setMessages])

  const streamQuery = useCallback(
    async (messageId: string, question: string, docId: string) => {
      const abort = new AbortController()
      abortRef.current = abort
      streamingRef.current = true
      setIsStreaming(true)

      try {
        const response = await fetch(API_ROUTES.QUERY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, documentId: docId }),
          signal: abort.signal,
        })

        if (!response.ok || !response.body) {
          if (response.status === 429) {
            toast.error(UI_LABELS.RATE_LIMIT_TOAST)
          }
          throw new Error(`Query failed with status ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
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
              handlePayload(payload, messageId)
            } catch {
              // Malformed JSON line — skip silently.
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return

        console.error('[useQueryStream] stream error:', error)
        const is429 = error instanceof Error && error.message.includes('429')
        if (!is429) toast.error(UI_LABELS.QUERY_ERROR_TOAST)

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: UI_LABELS.QUERY_ERROR_CONTENT, isStreaming: false }
              : m
          )
        )
      } finally {
        streamingRef.current = false
        setIsStreaming(false)
        // Safety net: clear blinking cursor regardless of how the stream exited.
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId && m.isStreaming ? { ...m, isStreaming: false } : m))
        )
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  function handlePayload(payload: RAGStreamPayload, messageId: string) {
    if (payload.token) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: m.content + payload.token } : m
        )
      )
    }

    if (payload.error !== undefined) {
      toast.error(payload.error)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: payload.error ?? '', isStreaming: false }
            : m
        )
      )
    }

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
  }

  const handleSubmit = useCallback(
    (question: string) => {
      if (!selectedDocId) return

      const now = new Date().toISOString()
      const userMsg: UIMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: question,
        timestamp: now,
      }
      const assistantId = `msg-${Date.now()}-assistant`
      const assistantMsg: UIMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: now,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      void streamQuery(assistantId, question, selectedDocId)
    },
    [selectedDocId, streamQuery, setMessages]
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
