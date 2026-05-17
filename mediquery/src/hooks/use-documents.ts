'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import type { UIDocument } from '@/types'
import {
  DOCUMENT_STATUS,
  DOCUMENT_POLL_INTERVAL_MS,
  ACCEPTED_MIME_TYPE,
} from '@/constants/documents'

interface UploadDocumentResponse {
  id: string
  name: string
  status: string
  pageCount: number | null
  createdAt: string
}

export function useDocuments() {
  const [documents, setDocuments] = useState<UIDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents')
      if (!res.ok) return
      const data: UIDocument[] = await res.json()
      setDocuments(data)
      setSelectedDocId((prev) => {
        if (prev) return prev
        return data.find((d) => d.status === DOCUMENT_STATUS.READY)?.id ?? null
      })
    } catch (error) {
      console.error('[useDocuments] fetchDocuments failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const hasProcessing = documents.some((d) => d.status === DOCUMENT_STATUS.PROCESSING)
  useEffect(() => {
    if (!hasProcessing) return
    const intervalId = setInterval(fetchDocuments, DOCUMENT_POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [hasProcessing, fetchDocuments])

  const selectDocument = useCallback((id: string) => {
    setSelectedDocId(id)
  }, [])

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      // Auto-select the next ready doc before removing from state
      if (selectedDocId === id) {
        const next = documents.find((d) => d.id !== id && d.status === DOCUMENT_STATUS.READY)
        setSelectedDocId(next?.id ?? null)
      }

      // Optimistic remove
      setDocuments((prev) => prev.filter((d) => d.id !== id))

      try {
        const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Delete failed')
        toast.success('Document deleted')
      } catch (error) {
        console.error('[useDocuments] delete error:', error)
        toast.error('Delete failed — restoring document')
        void fetchDocuments()
      }
    },
    [selectedDocId, documents, fetchDocuments]
  )

  const handleUploadFile = useCallback(async (file: File) => {
    const tempId = `temp-${Date.now()}`

    setDocuments((prev) => [
      {
        id: tempId,
        name: file.name,
        status: DOCUMENT_STATUS.PROCESSING,
        uploadedAt: new Date().toISOString().split('T')[0],
      },
      ...prev,
    ])

    const toastId = toast.loading('Uploading document…')

    try {
      if (file.type !== ACCEPTED_MIME_TYPE) {
        throw new Error('Only PDF files are accepted')
      }

      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/documents/upload', { method: 'POST', body: form })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Upload failed')
      }

      const doc: UploadDocumentResponse = await res.json()

      setDocuments((prev) => [
        {
          id: doc.id,
          name: doc.name,
          status: doc.status as UIDocument['status'],
          uploadedAt: new Date(doc.createdAt).toISOString().split('T')[0],
          pageCount: doc.pageCount ?? undefined,
        },
        ...prev.filter((d) => d.id !== tempId),
      ])
      setSelectedDocId((prev) => prev ?? doc.id)
      toast.success(`"${doc.name}" uploaded — indexing in background`, { id: toastId })
    } catch (error) {
      console.error('[useDocuments] upload error:', error)
      const message = error instanceof Error ? error.message : 'Upload failed'
      toast.error(message, { id: toastId })
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === tempId ? { ...d, status: DOCUMENT_STATUS.FAILED as UIDocument['status'] } : d
        )
      )
    }
  }, [])

  return {
    documents,
    isLoading,
    selectedDocId,
    selectDocument,
    handleUploadFile,
    handleDeleteDocument,
  }
}
