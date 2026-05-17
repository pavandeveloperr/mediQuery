// src/app/page.tsx
import { Activity, Cpu, ShieldCheck } from 'lucide-react'
import LoginForm from '@/components/features/LoginForm'

const featureItems = [
  {
    title: 'Agentic RAG',
    description: 'Precision-guided retrieval with medical context awareness.',
    icon: Activity,
  },
  {
    title: 'Zero Hallucinations',
    description: 'Cited clinical answers that stay grounded in uploaded documents.',
    icon: ShieldCheck,
  },
  {
    title: 'Clinical Insights',
    description: 'Actionable analytics on patient records and document workflows.',
    icon: Cpu,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="relative overflow-hidden px-6 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:grid lg:grid-cols-[1.4fr_0.9fr] lg:items-center lg:gap-16">
          <div className="space-y-8">
            {/* Hero copy intentionally concise and clinical to match MediQuery positioning */}
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--foreground)]/60">
                Clinical Document Intelligence
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                Agentic RAG for fragment-free medical record analysis.
              </h1>
              <p className="mt-6 max-w-xl leading-8 text-[var(--foreground)]/80">
                Clinical Document Intelligence Platform. Agentic RAG for fragment-free medical record analysis.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {featureItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-[var(--foreground)]/10 bg-[var(--background)]/90 p-6 shadow-lg shadow-[var(--foreground)]/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--foreground)]/5 text-[var(--foreground)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--foreground)]/75">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-lg rounded-[2rem] border border-[var(--foreground)]/10 bg-[var(--background)]/95 p-8 shadow-[0_30px_80px_rgba(23,23,23,0.08)] backdrop-blur-xl sm:p-10">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  )
}