'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { UIMessage, MedicalChunk, RAGStreamPayload } from '@/types'

export function useQueryStream(selectedDocId: string | null) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [activeCitations, setActiveCitations] = useState<MedicalChunk[]>([])
  const [isCitationsOpen, setIsCitationsOpen] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      streamingRef.current = false
    }
  }, [])

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
              }
            } catch {
              // Malformed JSON line — skip silently.
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return

        console.error('[useQueryStream] stream error:', error)
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
    handleSubmit,
    clearMessages,
  }
}
