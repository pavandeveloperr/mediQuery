// Phase 3 placeholder — remove this file when POST /api/query SSE is wired up.
import type { MedicalChunk, AgentStep } from '@/types'

export const MOCK_RESPONSE =
  'Based on the discharge summary, the patient is currently prescribed the following medications:\n\n' +
  '• Metformin 500mg — twice daily with meals, for blood glucose management\n' +
  '• Lisinopril 10mg — once daily in the morning, for blood pressure control\n' +
  '• Atorvastatin 40mg — once at bedtime, added at discharge for lipid management\n\n' +
  'The attending physician Dr. Sarah Chen noted no adverse drug reactions during the 5-day hospital stay. ' +
  'Renal function tests, including creatinine and eGFR, returned within normal limits throughout admission.\n\n' +
  'Follow-up bloodwork (HbA1c and renal panel) is recommended in 4–6 weeks. The patient was advised to monitor ' +
  'blood glucose levels daily and report any changes to their primary care provider.'

export const MOCK_CITATIONS: MedicalChunk[] = [
  {
    id: 'chunk-4',
    content:
      'Patient is currently prescribed metformin 500mg twice daily with meals and lisinopril 10mg once daily in the morning. Atorvastatin 40mg was added at discharge for lipid management following elevated LDL readings.',
    chunkIndex: 4,
    documentId: '',
    similarity: 0.91,
  },
  {
    id: 'chunk-7',
    content:
      'Attending physician Dr. Sarah Chen noted no adverse drug reactions during the 5-day hospital stay. Renal function tests, including creatinine and eGFR, returned within normal limits throughout admission.',
    chunkIndex: 7,
    documentId: '',
    similarity: 0.83,
  },
  {
    id: 'chunk-11',
    content:
      'Follow-up appointment recommended in 4–6 weeks. Patient advised to monitor blood glucose levels daily using home glucometer and report HbA1c results to primary care provider at next scheduled visit.',
    chunkIndex: 11,
    documentId: '',
    similarity: 0.74,
  },
]

export const MOCK_AGENT_STEPS: AgentStep[] = [
  {
    thought: 'Searching document for sections related to current medications and prescriptions',
    action: 'RETRIEVE',
    queryUsed: 'current medications prescribed patient discharge',
    scoreAchieved: 0.91,
    timestamp: new Date().toISOString(),
  },
  {
    thought: 'Confidence score 0.91 exceeds threshold of 0.75 — proceeding to generate grounded answer',
    action: 'ANSWER',
    queryUsed: 'current medications prescribed patient discharge',
    scoreAchieved: 0.91,
    timestamp: new Date().toISOString(),
  },
]

export const MOCK_CONFIDENCE_SCORE = 0.91
