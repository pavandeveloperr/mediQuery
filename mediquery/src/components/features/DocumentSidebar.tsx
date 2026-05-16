'use client'

import { useRef } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Plus } from 'lucide-react'
import type { UIDocument } from '@/types'
import { DocumentCardSkeleton } from '@/components/ui/Skeleton'
import { truncateDocumentName } from '@/lib/utils/string'
import {
  DOCUMENT_STATUS,
  ACCEPTED_MIME_TYPE,
  ACCEPTED_FILE_EXTENSION,
} from '@/constants/documents'
import { UI_LABELS } from '@/constants/ui'

interface Props {
  documents: UIDocument[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUploadFile: (file: File) => void
  userName: string | null | undefined
  userImage: string | null | undefined
  isLoading?: boolean
}

const STATUS_DOT_CLASS: Record<UIDocument['status'], string> = {
  ready: 'bg-emerald-400',
  processing: 'bg-amber-400 animate-pulse',
  failed: 'bg-rose-400',
}

const STATUS_ICON: Record<UIDocument['status'], React.ReactNode> = {
  ready: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  processing: <Loader2 className="h-3 w-3 animate-spin text-amber-500" />,
  failed: <AlertCircle className="h-3 w-3 text-rose-500" />,
}

function DocumentCard({
  doc,
  isSelected,
  onSelect,
}: {
  doc: UIDocument
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const isReady = doc.status === DOCUMENT_STATUS.READY
  const cardClass = isSelected
    ? 'border-blue-200 bg-blue-50'
    : isReady
      ? 'border-transparent hover:bg-slate-50'
      : 'cursor-not-allowed border-transparent opacity-50'

  return (
    <button
      type="button"
      disabled={!isReady}
      onClick={() => isReady && onSelect(doc.id)}
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${cardClass}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[doc.status]}`} />
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-medium leading-tight ${
              isSelected ? 'text-blue-700' : 'text-slate-700'
            }`}
          >
            {truncateDocumentName(doc.name)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs capitalize text-slate-400">
            {STATUS_ICON[doc.status]}
            {doc.status}
            {doc.pageCount && isReady && <span>· {doc.pageCount}p</span>}
          </p>
        </div>
      </div>
    </button>
  )
}

export default function DocumentSidebar({
  documents,
  selectedId,
  onSelect,
  onUploadFile,
  userName,
  userImage,
  isLoading = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && file.type === ACCEPTED_MIME_TYPE) {
      onUploadFile(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const readyCount = documents.filter((d) => d.status === DOCUMENT_STATUS.READY).length
  const sectionLabel = isLoading
    ? UI_LABELS.DOCUMENTS_LOADING
    : UI_LABELS.documentsReady(readyCount)

  const documentListContent = isLoading
    ? Array.from({ length: 4 }).map((_, i) => <DocumentCardSkeleton key={i} />)
    : documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          doc={doc}
          isSelected={selectedId === doc.id}
          onSelect={onSelect}
        />
      ))

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
          <span className="text-xs font-bold text-white">M</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">{UI_LABELS.BRAND_NAME}</span>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            {sectionLabel}
          </p>
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {documentListContent}
        </div>

        <div className="shrink-0 border-t border-slate-200 p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={`${ACCEPTED_FILE_EXTENSION},${ACCEPTED_MIME_TYPE}`}
            className="sr-only"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
          >
            <Plus className="h-4 w-4" />
            {UI_LABELS.UPLOAD_PDF}
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 px-4 py-3">
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userImage} alt="avatar" className="h-7 w-7 rounded-full" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {(userName ?? 'U')[0].toUpperCase()}
          </div>
        )}
        <p className="flex-1 truncate text-xs text-slate-500">{userName ?? 'User'}</p>
      </div>
    </aside>
  )
}
