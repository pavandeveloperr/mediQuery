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
  action: 'RETRIEVE' | 'REFORMULATE' | 'ANSWER' | 'FAIL'
  queryUsed: string
  scoreAchieved?: number
  timestamp: string
}

export interface RAGStreamPayload {
  token: string
  confidenceScore?: number
  citations?: MedicalChunk[]
  steps?: AgentStep[]
  remainingQueries?: number
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
