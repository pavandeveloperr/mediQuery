'use client'

import { useState, useEffect } from 'react'
import type { UIMessage, MedicalChunk, QueryHistoryItem } from '@/types'
import { API_ROUTES } from '@/constants/routes'

function mapHistoryToMessages(items: QueryHistoryItem[]): UIMessage[] {
  return items.flatMap((item) => [
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
}

export function useQueryHistory(selectedDocId: string | null) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [lastCitations, setLastCitations] = useState<MedicalChunk[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  useEffect(() => {
    if (!selectedDocId) {
      setMessages([])
      setLastCitations([])
      return
    }

    async function loadHistory() {
      setIsHistoryLoading(true)
      setMessages([])
      try {
        const res = await fetch(`${API_ROUTES.QUERY_HISTORY}?documentId=${selectedDocId}`)
        if (!res.ok) return

        const items: QueryHistoryItem[] = await res.json()
        setMessages(mapHistoryToMessages(items))
        setLastCitations(items.at(-1)?.citations ?? [])
      } catch (error) {
        console.error('[useQueryHistory] loadHistory failed:', error)
      } finally {
        setIsHistoryLoading(false)
      }
    }

    void loadHistory()
  }, [selectedDocId])

  return { messages, setMessages, lastCitations, isHistoryLoading }
}
