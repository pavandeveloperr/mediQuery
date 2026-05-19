import { retrieveChunks } from '@/lib/ai/retrieval'
import { generateText, streamGenerateText } from '@/lib/ai/gemini'
import { buildReformulationPrompt, buildAnswerPrompt } from '@/lib/ai/prompts'
import { SIMILARITY_THRESHOLD, NOT_FOUND_MESSAGE } from '@/constants/ai'
import type { AgentStep, MedicalChunk } from '@/types'

export interface AgentResult {
  steps: AgentStep[]
  citations: MedicalChunk[]
  confidenceScore: number
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
  onToken: (token: string) => void
): Promise<AgentResult> {
  const steps: AgentStep[] = []
  let citations: MedicalChunk[] = []
  let confidenceScore = 0
  let effectiveQuery = question

  try {
    // ── Step 1: Initial retrieval ──────────────────────────────────────────────
    const initial = await retrieveChunks(effectiveQuery, documentId)
    confidenceScore = initial.avgSimilarity
    citations = initial.chunks

    steps.push(makeStep(
      `Searching document for: "${effectiveQuery}"`,
      'RETRIEVE',
      effectiveQuery,
      confidenceScore
    ))

    // ── Step 2: Reformulate if below confidence threshold ─────────────────────
    if (confidenceScore < SIMILARITY_THRESHOLD) {
      steps.push(makeStep(
        `Confidence ${confidenceScore.toFixed(2)} is below threshold ${SIMILARITY_THRESHOLD}. Reformulating query with clinical terminology.`,
        'REFORMULATE',
        effectiveQuery,
        confidenceScore
      ))

      try {
        const reformulated = await generateText(buildReformulationPrompt(question))
        effectiveQuery = reformulated.trim()

        const retry = await retrieveChunks(effectiveQuery, documentId)
        confidenceScore = retry.avgSimilarity
        citations = retry.chunks

        steps.push(makeStep(
          `Re-querying with reformulated query: "${effectiveQuery}"`,
          'RETRIEVE',
          effectiveQuery,
          confidenceScore
        ))
      } catch (reformError) {
        // Reformulation failed (e.g. rate limit) — proceed with original retrieval results.
        console.error('[runAgent] Reformulation failed, using original results:', reformError)
        steps.push(makeStep(
          'Reformulation unavailable — proceeding with original retrieval results.',
          'RETRIEVE',
          effectiveQuery,
          confidenceScore
        ))
      }
    }

    // ── Step 3: Answer or fail ────────────────────────────────────────────────
    if (citations.length === 0) {
      steps.push(makeStep(
        'No relevant chunks found in document. Cannot generate a grounded answer.',
        'FAIL',
        effectiveQuery,
        confidenceScore
      ))
      onToken(NOT_FOUND_MESSAGE)
    } else {
      steps.push(makeStep(
        `Generating answer from ${citations.length} retrieved chunks (avg similarity: ${confidenceScore.toFixed(2)}).`,
        'ANSWER',
        effectiveQuery,
        confidenceScore
      ))
      await streamGenerateText(buildAnswerPrompt(question, citations), onToken)
    }

    return { steps, citations, confidenceScore }
  } catch (error) {
    console.error('[runAgent] Failed:', error)
    throw error
  }
}
