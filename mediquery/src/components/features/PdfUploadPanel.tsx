"use client"

import { useState, useCallback, type ChangeEvent } from 'react'
import { AlertTriangle, CheckCircle, FileText, UploadCloud } from 'lucide-react'
import UploadCard from '@/components/ui/upload-card'
import { asyncCatchError } from '@/lib/utils/asyncCatchError'

const MAX_FILE_SIZE = 15 * 1024 * 1024
const ALLOWED_TYPE = 'application/pdf'

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`
}

function getFileError(file: File | null) {
  if (!file) return 'No file selected. Please choose a PDF to upload.'
  if (file.type !== ALLOWED_TYPE) return 'Only PDF files are allowed. Please select a valid .pdf document.'
  if (file.size > MAX_FILE_SIZE) return 'File is too large. Please upload a PDF smaller than 15 MB.'
  return null
}

export default function PdfUploadPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const clearMessages = useCallback(() => {
    setStatusMessage(null)
    setErrorMessage(null)
  }, [])

  const handleFileChange = useCallback((file: File | null) => {
    clearMessages()

    if (!file) {
      setSelectedFile(null)
      return
    }

    const validationError = getFileError(file)
    if (validationError) {
      setSelectedFile(null)
      setErrorMessage(validationError)
      return
    }

    setSelectedFile(file)
  }, [clearMessages])

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleFileChange(event.target.files?.[0] ?? null)
    },
    [handleFileChange],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      clearMessages()
      const file = event.dataTransfer.files?.[0] ?? null
      handleFileChange(file)
    },
    [clearMessages, handleFileChange],
  )

  const handleUpload = useCallback(async () => {
    clearMessages()

    if (!selectedFile) {
      setErrorMessage('Please select a PDF document before uploading.')
      return
    }

    const validationError = getFileError(selectedFile)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setIsUploading(true)

    await asyncCatchError(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 850))
        setStatusMessage(`Ready to process ${selectedFile.name}.`)
        setSelectedFile(null)
      },
      () => {
        setErrorMessage('Unable to upload the file. Try again or contact support if the issue persists.')
      },
    )

    setIsUploading(false)
  }, [clearMessages, selectedFile])

  return (
    <UploadCard
      title="Document upload"
      description="Upload a clinical PDF to add it to your secure document workspace. Supported edge cases are handled before submission."
    >
      <div className="grid gap-6">
        <div
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className="group relative rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-slate-400 hover:bg-slate-100"
        >
          <UploadCloud className="mx-auto h-10 w-10 text-slate-500 transition group-hover:text-slate-700" />
          <label htmlFor="pdf-upload" className="mt-6 block cursor-pointer text-sm font-semibold text-slate-900 transition hover:text-slate-700">
            Choose a file or drag it here
          </label>
          <p className="mt-2 text-sm text-slate-500">Only PDF files up to 15 MB are accepted.</p>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={handleInputChange}
          />
        </div>

        {selectedFile ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-slate-500" />
              <div>
                <p className="font-medium text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <p>{errorMessage}</p>
            </div>
          </div>
        ) : null}

        {statusMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4" />
              <p>{statusMessage}</p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? 'Uploading…' : 'Upload PDF'}
          </button>

          <p className="text-xs text-slate-500">
            Tip: Keep file names simple and use PDF documents with clear document titles.
          </p>
        </div>
      </div>
    </UploadCard>
  )
}
