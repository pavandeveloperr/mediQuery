import type { MedicalChunk } from '@/types'
import { NOT_FOUND_MESSAGE } from '@/constants/ai'

function formatChunksAsContext(chunks: MedicalChunk[]): string {
  return chunks.map((c, i) => `[Source ${i + 1}] ${c.content}`).join('\n\n---\n\n')
}

export function buildEvaluationPrompt(
  question: string,
  answer: string,
  chunks: MedicalChunk[]
): string {
  const context = formatChunksAsContext(chunks)

  return `You are a strict clinical RAG evaluator. Your job is to score how trustworthy an AI-generated answer is, given the source chunks it was generated from.

Score two dimensions on a 0.0–1.0 scale:

1. groundedness — Is every factual claim in the answer directly supported by the provided sources?
   1.0 = every claim has a matching source. 0.0 = the answer contains fabricated or unsupported information.

2. completeness — Does the answer fully address what the question asked?
   1.0 = fully answers the question. 0.5 = partial answer. 0.0 = does not answer the question.

If the answer is exactly "${NOT_FOUND_MESSAGE}", return groundedness=1.0 and completeness=0.0 (correct refusal).

Return ONLY a JSON object on a single line. No code fences, no prose, no explanation. Use exactly this shape:
{"groundedness":0.00,"completeness":0.00}

Question: ${question}

Answer to evaluate:
${answer}

Source chunks:
${context}`
}

export function buildReformulationPrompt(original: string): string {
  return `You are a clinical AI assistant. The following user query did not find confident matches in a patient's medical records:

"${original}"

Rewrite it using formal clinical terminology more likely to appear in a medical document (e.g. "prescribed medications" instead of "drugs", "vital signs" instead of "blood pressure reading", "differential diagnosis" instead of "what might be wrong").

Return ONLY the rewritten query. No explanation, no punctuation changes beyond the query itself.`
}

export function buildAnswerPrompt(question: string, chunks: MedicalChunk[]): string {
  const context = formatChunksAsContext(chunks)

  return `You are a clinical document analysis assistant. Answer the question using ONLY the provided medical document context. Be concise and accurate.

If the answer cannot be determined from the context, respond with exactly: "${NOT_FOUND_MESSAGE}"

Do not add information not present in the context.

Question: ${question}

Medical document context:
${context}`
}
