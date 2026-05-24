import { FileText, X } from 'lucide-react'
import type { MedicalChunk, UIDocument } from '@/types'
import ConfidenceBadge from '@/components/ui/ConfidenceBadge'
import { CitationCardSkeleton } from '@/components/ui/Skeleton'
import { MAX_RETRIEVED_CHUNKS } from '@/constants/ai'

interface Props {
  citations: MedicalChunk[]
  documents: UIDocument[]
  isStreaming: boolean
  onClose: () => void
}

function docName(documentId: string, documents: UIDocument[]): string {
  return documents.find((d) => d.id === documentId)?.name ?? 'Unknown document'
}

function CitationsBody({ citations, documents }: { citations: MedicalChunk[]; documents: UIDocument[] }) {
  if (citations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-2xl bg-slate-100 p-4">
          <FileText className="h-8 w-8 text-slate-300" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-500">No sources yet</p>
        <p className="mt-1 max-w-[180px] text-xs leading-5 text-slate-400">
          Ask a question to see retrieved document chunks here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {citations.map((chunk, idx) => (
        <div
          key={chunk.id}
          className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="flex-1 truncate text-xs font-medium text-slate-500">
              {docName(chunk.documentId, documents)}
            </p>
            <span className="shrink-0 text-xs text-slate-400">#{idx + 1}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Chunk {chunk.chunkIndex}</span>
            {chunk.similarity !== undefined && (
              <ConfidenceBadge score={chunk.similarity} showScore />
            )}
          </div>

          <p className="line-clamp-4 text-xs leading-5 text-slate-600">{chunk.content}</p>
        </div>
      ))}
    </div>
  )
}

function CitationsSkeletonBody() {
  return (
    <div className="space-y-3">
      {Array.from({ length: MAX_RETRIEVED_CHUNKS }).map((_, i) => (
        <CitationCardSkeleton key={i} />
      ))}
    </div>
  )
}

export default function SourceCitations({ citations, documents, isStreaming, onClose }: Props) {
  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Sources</span>
          {!isStreaming && citations.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {citations.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isStreaming
          ? <CitationsSkeletonBody />
          : <CitationsBody citations={citations} documents={documents} />
        }
      </div>
    </aside>
  )
}
