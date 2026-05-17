'use client'

import { useEffect } from 'react'

interface Props {
  isOpen: boolean
  title: string
  subtitle?: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'default'
}

export default function ConfirmModal({
  isOpen,
  title,
  subtitle,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'default',
}: Props) {
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const confirmClass =
    variant === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500'
      : 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-modal-title"
          className="text-base font-semibold text-slate-900"
        >
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{subtitle}</p>
        )}

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
