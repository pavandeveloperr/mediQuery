import { retrieveChunks } from '@/lib/ai/retrieval'
import { generateText, streamGenerateText } from '@/lib/ai/gemini'
import { buildReformulationPrompt, buildAnswerPrompt } from '@/lib/ai/prompts'
import { evaluateAnswer } from '@/lib/ai/evaluation'
import {
  SIMILARITY_THRESHOLD,
  NOT_FOUND_MESSAGE,
  CONFIDENCE_WEIGHT_RETRIEVAL,
  CONFIDENCE_WEIGHT_GROUNDEDNESS,
  CONFIDENCE_WEIGHT_COMPLETENESS,
} from '@/constants/ai'
import type { AgentStep, MedicalChunk } from '@/types'

export interface AgentResult {
  steps: AgentStep[]
  citations: MedicalChunk[]
  confidenceScore: number
}

export interface AgentCallbacks {
  onToken: (token: string) => void
  onStep: (step: AgentStep) => void
}

function makeStep(
  thought: string,
  action: AgentStep['action'],
  queryUsed: string,
  scoreAchieved: number
): AgentStep {
  return { thought, action, queryUsed, scoreAchieved, timestamp: new Date().toISOString() }
}

export async function runAgent(
  question: string,
  documentId: string,
  callbacks: AgentCallbacks
): Promise<AgentResult> {
  const { onToken, onStep } = callbacks
  const steps: AgentStep[] = []
  let citations: MedicalChunk[] = []
  let retrievalSimilarity = 0
  let effectiveQuery = question

  // onStep fires before steps.push so the frontend sees the step immediately;
  // steps.push maintains the local trace for the final AgentResult return value.
  function pushStep(step: AgentStep) {
    onStep(step)
    steps.push(step)
  }

  try {
    // ── Step 1: Initial retrieval ──────────────────────────────────────────────
    const initial = await retrieveChunks(effectiveQuery, documentId)
    retrievalSimilarity = initial.avgSimilarity
    citations = initial.chunks

    pushStep(makeStep(
      `Searching document for: "${effectiveQuery}"`,
      'RETRIEVE',
      effectiveQuery,
      retrievalSimilarity
    ))

    // ── Step 2: Reformulate if below confidence threshold ─────────────────────
    if (retrievalSimilarity < SIMILARITY_THRESHOLD) {
      pushStep(makeStep(
        `Confidence ${retrievalSimilarity.toFixed(2)} is below threshold ${SIMILARITY_THRESHOLD}. Reformulating query with clinical terminology.`,
        'REFORMULATE',
        effectiveQuery,
        retrievalSimilarity
      ))

      try {
        const reformulated = await generateText(buildReformulationPrompt(question))
        effectiveQuery = reformulated.trim()

        const retry = await retrieveChunks(effectiveQuery, documentId)
        retrievalSimilarity = retry.avgSimilarity
        citations = retry.chunks

        pushStep(makeStep(
          `Re-querying with reformulated query: "${effectiveQuery}"`,
          'RETRIEVE',
          effectiveQuery,
          retrievalSimilarity
        ))
      } catch (reformError) {
        // Reformulation failed (e.g. rate limit) — proceed with original retrieval results.
        console.error('[runAgent] Reformulation failed, using original results:', reformError)
        pushStep(makeStep(
          'Reformulation unavailable — proceeding with original retrieval results.',
          'RETRIEVE',
          effectiveQuery,
          retrievalSimilarity
        ))
      }
    }

    // ── Step 3: Answer or fail ────────────────────────────────────────────────
    if (citations.length === 0) {
      pushStep(makeStep(
        'No relevant chunks found in document. Cannot generate a grounded answer.',
        'FAIL',
        effectiveQuery,
        retrievalSimilarity
      ))
      onToken(NOT_FOUND_MESSAGE)
      return { steps, citations, confidenceScore: 0 }
    }

    pushStep(makeStep(
      `Generating answer from ${citations.length} retrieved chunks (avg similarity: ${retrievalSimilarity.toFixed(2)}).`,
      'ANSWER',
      effectiveQuery,
      retrievalSimilarity
    ))

    const tokens: string[] = []
    await streamGenerateText(buildAnswerPrompt(question, citations), (token) => {
      tokens.push(token)
      onToken(token)
    })
    const fullAnswer = tokens.join('')

    // ── Step 4: Evaluate the answer with LLM-as-judge ─────────────────────────
    // Retrieval similarity caps around 0.85 on clinical text — groundedness and
    // completeness give the composite score full headroom into the 0.9+ range
    // when the answer is genuinely well-supported by the retrieved chunks.
    const evaluation = await evaluateAnswer(question, fullAnswer, citations)

    const confidenceScore =
      CONFIDENCE_WEIGHT_RETRIEVAL * retrievalSimilarity +
      CONFIDENCE_WEIGHT_GROUNDEDNESS * evaluation.groundedness +
      CONFIDENCE_WEIGHT_COMPLETENESS * evaluation.completeness

    pushStep(makeStep(
      `Self-evaluation — groundedness ${evaluation.groundedness.toFixed(2)}, completeness ${evaluation.completeness.toFixed(2)}. Composite confidence ${confidenceScore.toFixed(2)}.`,
      'EVALUATE',
      effectiveQuery,
      confidenceScore
    ))

    return { steps, citations, confidenceScore }
  } catch (error) {
    console.error('[runAgent] Failed:', error)
    throw error
  }
}
