'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useDocuments } from '@/hooks/use-documents'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useQueryStream } from '@/hooks/use-query-stream'
import DashboardNav from '@/components/features/DashboardNav'
import DocumentSidebar from '@/components/features/DocumentSidebar'
import QueryWorkspace from '@/components/features/QueryWorkspace'
import SourceCitations from '@/components/features/SourceCitations'
import { UI_LABELS } from '@/constants/ui'
import { PAGE_ROUTES } from '@/constants/routes'

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
      <DashboardNav
        remainingQueries={remainingQueries}
        onSignOut={() => setIsSignOutModalOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <DocumentSidebar
          documents={documents}
          selectedId={selectedDocId}
          onSelect={handleSelectDoc}
          onUploadFile={handleUploadFile}
          onDeleteDocument={handleDeleteDoc}
          userName={userName}
          userEmail={userEmail}
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
            isStreaming={isStreaming}
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
        title={UI_LABELS.SIGN_OUT_TITLE}
        subtitle={UI_LABELS.SIGN_OUT_SUBTITLE}
        confirmLabel={UI_LABELS.SIGN_OUT}
        cancelLabel="Cancel"
        onConfirm={() => void signOut({ callbackUrl: PAGE_ROUTES.HOME })}
        onCancel={() => setIsSignOutModalOpen(false)}
      />
    </div>
  )
}
