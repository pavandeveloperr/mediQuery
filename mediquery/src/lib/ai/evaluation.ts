import { generateText } from '@/lib/ai/gemini'
import { buildEvaluationPrompt } from '@/lib/ai/prompts'
import type { MedicalChunk } from '@/types'

export interface AnswerEvaluation {
  groundedness: number
  completeness: number
}

const FALLBACK_EVALUATION: AnswerEvaluation = { groundedness: 0.7, completeness: 0.7 }

// Extracts the first JSON object from a model response. Tolerates code fences,
// surrounding prose, or trailing whitespace — anything Gemini might wrap around
// the structured output despite the prompt asking for raw JSON.
function parseEvaluation(raw: string): AnswerEvaluation {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in evaluation response')
  }

  const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  const groundedness = clamp01(parsed.groundedness)
  const completeness = clamp01(parsed.completeness)
  return { groundedness, completeness }
}

function clamp01(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('Evaluation score is not a finite number')
  }
  return Math.max(0, Math.min(1, value))
}

// LLM-as-judge faithfulness scoring. Returns groundedness (is the answer
// supported by the chunks?) and completeness (does it actually answer the
// question?). On failure, falls back to a neutral mid-range score rather than
// breaking the user-facing flow — the agent's answer already streamed
// successfully, this is purely a post-hoc confidence signal.
export async function evaluateAnswer(
  question: string,
  answer: string,
  chunks: MedicalChunk[]
): Promise<AnswerEvaluation> {
  try {
    const raw = await generateText(buildEvaluationPrompt(question, answer, chunks))
    return parseEvaluation(raw)
  } catch (error) {
    console.error('[evaluateAnswer] Evaluation failed, using fallback:', error)
    return FALLBACK_EVALUATION
  }
}
