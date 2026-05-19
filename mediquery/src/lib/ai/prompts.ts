import type { MedicalChunk } from '@/types'
import { NOT_FOUND_MESSAGE } from '@/constants/ai'

export function buildReformulationPrompt(original: string): string {
  return `You are a clinical AI assistant. The following user query did not find confident matches in a patient's medical records:

"${original}"

Rewrite it using formal clinical terminology more likely to appear in a medical document (e.g. "prescribed medications" instead of "drugs", "vital signs" instead of "blood pressure reading", "differential diagnosis" instead of "what might be wrong").

Return ONLY the rewritten query. No explanation, no punctuation changes beyond the query itself.`
}

export function buildAnswerPrompt(question: string, chunks: MedicalChunk[]): string {
  const context = chunks
    .map((c, i) => `[Source ${i + 1}] ${c.content}`)
    .join('\n\n---\n\n')

  return `You are a clinical document analysis assistant. Answer the question using ONLY the provided medical document context. Be concise and accurate.

If the answer cannot be determined from the context, respond with exactly: "${NOT_FOUND_MESSAGE}"

Do not add information not present in the context.

Question: ${question}

Medical document context:
${context}`
}
