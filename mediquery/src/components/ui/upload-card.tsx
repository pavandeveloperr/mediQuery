interface UploadCardProps {
  title: string
  description: string
  children: React.ReactNode
}

export default function UploadCard({ title, description, children }: UploadCardProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{title}</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  )
}
