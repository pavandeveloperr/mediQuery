'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import { signOut } from 'next-auth/react'
import type { UIDocument, UIMessage, MedicalChunk, AgentStep } from '@/types'
import DocumentSidebar from '@/components/features/DocumentSidebar'
import QueryWorkspace from '@/components/features/QueryWorkspace'
import SourceCitations from '@/components/features/SourceCitations'

// ── Phase 3 placeholder: streaming simulation ─────────────────────────────────
// These constants are replaced when POST /api/query SSE is wired up in Phase 3.

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
    documentId: '',
    similarity: 0.91,
  },
  {
    id: 'chunk-7',
    content:
      'Attending physician Dr. Sarah Chen noted no adverse drug reactions during the 5-day hospital stay. Renal function tests, including creatinine and eGFR, returned within normal limits throughout admission.',
    chunkIndex: 7,
    documentId: '',
    similarity: 0.83,
  },
  {
    id: 'chunk-11',
    content:
      'Follow-up appointment recommended in 4–6 weeks. Patient advised to monitor blood glucose levels daily using home glucometer and report HbA1c results to primary care provider at next scheduled visit.',
    chunkIndex: 11,
    documentId: '',
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
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

export default function AppShell({ userName, userEmail, userImage }: Props) {
  const [documents, setDocuments] = useState<UIDocument[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [activeCitations, setActiveCitations] = useState<MedicalChunk[]>([])
  const [isCitationsOpen, setIsCitationsOpen] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingRef = useRef(false)

  useEffect(() => {
    return () => { streamingRef.current = false }
  }, [])

  // ── Document fetching ───────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents')
      if (!res.ok) return
      const data: UIDocument[] = await res.json()
      setDocuments(data)
      // Auto-select first ready document if nothing is selected yet
      setSelectedDocId((prev) => {
        if (prev) return prev
        return data.find((d) => d.status === 'ready')?.id ?? null
      })
    } catch (error) {
      console.error('[AppShell] fetchDocuments failed:', error)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Poll every 3 s while any document is still processing
  const hasProcessing = documents.some((d) => d.status === 'processing')
  useEffect(() => {
    if (!hasProcessing) return
    const id = setInterval(fetchDocuments, 3000)
    return () => clearInterval(id)
  }, [hasProcessing, fetchDocuments])

  // ── Document actions ────────────────────────────────────────────────────────

  const handleSelectDoc = useCallback((id: string) => {
    setSelectedDocId(id)
    setMessages([])
    setActiveCitations([])
  }, [])

  const handleUploadFile = useCallback(async (file: File) => {
    // Optimistic entry while the API processes the upload
    const tempId = `temp-${Date.now()}`
    setDocuments((prev) => [
      { id: tempId, name: file.name, status: 'processing', uploadedAt: new Date().toISOString().split('T')[0] },
      ...prev,
    ])

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/documents/upload', { method: 'POST', body: form })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Upload failed')
      }

      // Remove optimistic entry; the next poll will surface the real record
      setDocuments((prev) => prev.filter((d) => d.id !== tempId))
      await fetchDocuments()
    } catch (error) {
      console.error('[AppShell] upload error:', error)
      setDocuments((prev) =>
        prev.map((d) => (d.id === tempId ? { ...d, status: 'failed' as const } : d))
      )
    }
  }, [fetchDocuments])

  // ── Phase 3 placeholder: query submission ───────────────────────────────────
  // simulateStream is replaced by SSE fetch to POST /api/query in Phase 3.

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
          ? { ...m, isStreaming: false, confidenceScore: 0.91, citations, agentSteps: MOCK_AGENT_STEPS }
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
      simulateStream(assistantId, selectedDocId)
    },
    [selectedDocId, simulateStream]
  )
  // ─────────────────────────────────────────────────────────────────────────────

  const selectedDocument = documents.find((d) => d.id === selectedDocId) ?? null

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Top nav */}
      <nav className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-800">Clinical Workspace</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-slate-400 sm:block">{userEmail}</span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        <DocumentSidebar
          documents={documents}
          selectedId={selectedDocId}
          onSelect={handleSelectDoc}
          onUploadFile={handleUploadFile}
          userName={userName}
          userImage={userImage}
        />

        <QueryWorkspace
          selectedDocument={selectedDocument}
          messages={messages}
          onSubmit={handleSubmit}
          isStreaming={isStreaming}
        />

        {isCitationsOpen && (
          <SourceCitations
            citations={activeCitations}
            documents={documents}
            onClose={() => setIsCitationsOpen(false)}
          />
        )}

        {!isCitationsOpen && (
          <button
            type="button"
            onClick={() => setIsCitationsOpen(true)}
            className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-slate-200 bg-white px-2 text-xs text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            title="Show sources"
          >
            <span className="rotate-90 whitespace-nowrap">Sources</span>
          </button>
        )}
      </div>
    </div>
  )
}
