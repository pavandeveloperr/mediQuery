'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { UIMessage, MedicalChunk } from '@/types'
import {
  MOCK_RESPONSE,
  MOCK_CITATIONS,
  MOCK_AGENT_STEPS,
  MOCK_CONFIDENCE_SCORE,
} from '@/lib/fixtures/query-mock'

// Phase 3: replace simulateStream with a real SSE fetch to POST /api/query

export function useQueryStream(selectedDocId: string | null) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [activeCitations, setActiveCitations] = useState<MedicalChunk[]>([])
  const [isCitationsOpen, setIsCitationsOpen] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingRef = useRef(false)

  useEffect(() => {
    return () => {
      streamingRef.current = false
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setActiveCitations([])
  }, [])

  const simulateStream = useCallback(async (messageId: string, docId: string) => {
    streamingRef.current = true
    setIsStreaming(true)

    const citations = MOCK_CITATIONS.map((c) => ({ ...c, documentId: docId }))
    const words = MOCK_RESPONSE.split(' ')
    let accumulated = ''

    for (const word of words) {
      if (!streamingRef.current) break
      accumulated += (accumulated ? ' ' : '') + word
      const snapshot = accumulated
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: snapshot } : m))
      )
      await new Promise((resolve) => setTimeout(resolve, 35 + Math.random() * 55))
    }

    if (!streamingRef.current) return

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              isStreaming: false,
              confidenceScore: MOCK_CONFIDENCE_SCORE,
              citations,
              agentSteps: MOCK_AGENT_STEPS,
            }
          : m
      )
    )
    setActiveCitations(citations)
    setIsCitationsOpen(true)
    setIsStreaming(false)
    streamingRef.current = false
  }, [])

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
      void simulateStream(assistantId, selectedDocId)
    },
    [selectedDocId, simulateStream]
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
