import { retrieveChunks } from '@/lib/ai/retrieval'
import { generateText, streamGenerateText } from '@/lib/ai/gemini'
import { SIMILARITY_THRESHOLD } from '@/constants/ai'
import type { AgentStep, MedicalChunk } from '@/types'

export interface AgentResult {
  steps: AgentStep[]
  citations: MedicalChunk[]
  confidenceScore: number
}

const NOT_FOUND_MESSAGE = "Information not found in the patient's medical timeline."

// Prompt to rewrite a low-confidence clinical query using formal medical terminology.
function buildReformulationPrompt(original: string): string {
  return `You are a clinical AI assistant. The following user query did not find confident matches in a patient's medical records:

"${original}"

Rewrite it using formal clinical terminology more likely to appear in a medical document (e.g. "prescribed medications" instead of "drugs", "vital signs" instead of "blood pressure reading", "differential diagnosis" instead of "what might be wrong").

Return ONLY the rewritten query. No explanation, no punctuation changes beyond the query itself.`
}

function buildAnswerPrompt(question: string, chunks: MedicalChunk[]): string {
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

    steps.push({
      thought: `Searching document for: "${effectiveQuery}"`,
      action: 'RETRIEVE',
      queryUsed: effectiveQuery,
      scoreAchieved: confidenceScore,
      timestamp: new Date().toISOString(),
    })

    // ── Step 2: Reformulate if below confidence threshold ─────────────────────
    if (confidenceScore < SIMILARITY_THRESHOLD) {
      steps.push({
        thought: `Confidence ${confidenceScore.toFixed(2)} is below threshold ${SIMILARITY_THRESHOLD}. Reformulating query with clinical terminology.`,
        action: 'REFORMULATE',
        queryUsed: effectiveQuery,
        scoreAchieved: confidenceScore,
        timestamp: new Date().toISOString(),
      })

      try {
        const reformulated = await generateText(buildReformulationPrompt(question))
        effectiveQuery = reformulated.trim()

        const retry = await retrieveChunks(effectiveQuery, documentId)
        confidenceScore = retry.avgSimilarity
        citations = retry.chunks

        steps.push({
          thought: `Re-querying with reformulated query: "${effectiveQuery}"`,
          action: 'RETRIEVE',
          queryUsed: effectiveQuery,
          scoreAchieved: confidenceScore,
          timestamp: new Date().toISOString(),
        })
      } catch (reformError) {
        // Reformulation failed (e.g. rate limit) — proceed with original retrieval results
        // rather than failing the entire query.
        console.error('[runAgent] Reformulation failed, using original results:', reformError)
        steps.push({
          thought: 'Reformulation unavailable — proceeding with original retrieval results.',
          action: 'RETRIEVE',
          queryUsed: effectiveQuery,
          scoreAchieved: confidenceScore,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // ── Step 3: Answer or fail ────────────────────────────────────────────────
    if (citations.length === 0) {
      steps.push({
        thought: 'No relevant chunks found in document. Cannot generate a grounded answer.',
        action: 'FAIL',
        queryUsed: effectiveQuery,
        scoreAchieved: confidenceScore,
        timestamp: new Date().toISOString(),
      })
      onToken(NOT_FOUND_MESSAGE)
    } else {
      steps.push({
        thought: `Generating answer from ${citations.length} retrieved chunks (avg similarity: ${confidenceScore.toFixed(2)}).`,
        action: 'ANSWER',
        queryUsed: effectiveQuery,
        scoreAchieved: confidenceScore,
        timestamp: new Date().toISOString(),
      })

      await streamGenerateText(buildAnswerPrompt(question, citations), onToken)
    }

    return { steps, citations, confidenceScore }
  } catch (error) {
    console.error('[runAgent] Failed:', error)
    throw error
  }
}
