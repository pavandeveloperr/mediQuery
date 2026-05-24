import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
    }
  }

  interface User {
    id: string
  }
}

// ── Domain types ──────────────────────────────────────────────────────────────

export interface MedicalChunk {
  id: string
  content: string
  chunkIndex: number
  documentId: string
  similarity?: number
}

export interface AgentStep {
  thought: string
  action: 'RETRIEVE' | 'REFORMULATE' | 'ANSWER' | 'EVALUATE' | 'FAIL'
  queryUsed: string
  scoreAchieved?: number
  timestamp: string
}

export interface RAGStreamPayload {
  token: string
  step?: AgentStep
  confidenceScore?: number
  citations?: MedicalChunk[]
  remainingQueries?: number
  error?: string
}

export interface QueryHistoryItem {
  id: string
  question: string
  answer: string
  confidence: number
  agentSteps: AgentStep[]
  citations: MedicalChunk[]
  createdAt: string
}

// ── UI types ──────────────────────────────────────────────────────────────────

export type DocumentStatus = 'processing' | 'ready' | 'failed'

export interface UIDocument {
  id: string
  name: string
  status: DocumentStatus
  uploadedAt: string
  pageCount?: number
}

export type MessageRole = 'user' | 'assistant'

export interface UIMessage {
  id: string
  role: MessageRole
  content: string
  isStreaming?: boolean
  confidenceScore?: number
  citations?: MedicalChunk[]
  agentSteps?: AgentStep[]
  timestamp: string
}
