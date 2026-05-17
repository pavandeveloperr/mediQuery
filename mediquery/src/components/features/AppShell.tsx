'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useDocuments } from '@/hooks/use-documents'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useQueryStream } from '@/hooks/use-query-stream'
import DocumentSidebar from '@/components/features/DocumentSidebar'
import QueryWorkspace from '@/components/features/QueryWorkspace'
import SourceCitations from '@/components/features/SourceCitations'
import { UI_LABELS } from '@/constants/ui'

interface Props {
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

export default function AppShell({ userName, userEmail, userImage }: Props) {
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false)
  const {
    documents,
    isLoading: isDocumentsLoading,
    selectedDocId,
    selectDocument,
    handleUploadFile,
    handleDeleteDocument,
  } = useDocuments()

  const {
    messages,
    activeCitations,
    isCitationsOpen,
    setIsCitationsOpen,
    isStreaming,
    isHistoryLoading,
    remainingQueries,
    handleSubmit,
    clearMessages,
  } = useQueryStream(selectedDocId)

  function handleSelectDoc(id: string) {
    selectDocument(id)
    clearMessages()
  }

  function handleDeleteDoc(id: string) {
    if (selectedDocId === id) clearMessages()
    void handleDeleteDocument(id)
  }

  const selectedDocument = documents.find((d) => d.id === selectedDocId) ?? null

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <nav className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-800">{UI_LABELS.APP_TITLE}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-slate-400 sm:block">{userEmail}</span>
          {remainingQueries !== null && (
            <span
              className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:block ${
                remainingQueries <= 5
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
              title="Queries remaining today"
            >
              {remainingQueries} / 20 left
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsSignOutModalOpen(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {UI_LABELS.SIGN_OUT}
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <DocumentSidebar
          documents={documents}
          selectedId={selectedDocId}
          onSelect={handleSelectDoc}
          onUploadFile={handleUploadFile}
          onDeleteDocument={handleDeleteDoc}
          userName={userName}
          userImage={userImage}
          isLoading={isDocumentsLoading}
          isStreaming={isStreaming}
        />

        <QueryWorkspace
          selectedDocument={selectedDocument}
          messages={messages}
          onSubmit={handleSubmit}
          isStreaming={isStreaming}
          isHistoryLoading={isHistoryLoading}
        />

        {isCitationsOpen ? (
          <SourceCitations
            citations={activeCitations}
            documents={documents}
            onClose={() => setIsCitationsOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsCitationsOpen(true)}
            aria-label={UI_LABELS.SHOW_SOURCES}
            className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-slate-200 bg-white px-2 text-xs text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <span className="rotate-90 whitespace-nowrap">{UI_LABELS.SOURCES}</span>
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={isSignOutModalOpen}
        title="Sign out?"
        subtitle="You'll be returned to the login page."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        onConfirm={() => void signOut({ callbackUrl: '/' })}
        onCancel={() => setIsSignOutModalOpen(false)}
      />
    </div>
  )
}
