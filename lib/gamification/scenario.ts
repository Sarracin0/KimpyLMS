import type { GeneratedScenarioPayload, GeneratedScenarioNode, GeneratedScenarioChoice } from './types'

type MaybeRecord = Record<string, unknown>

const getString = (value: unknown, fallback: string | null) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  return fallback
}

const getNumber = (value: unknown, fallback: number | null) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const getStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

const normalizeChoice = (choice: unknown, fallbackId: string): GeneratedScenarioChoice | null => {
  if (!choice || typeof choice !== 'object') return null
  const record = choice as MaybeRecord
  const id = getString(record.id, fallbackId) ?? fallbackId
  const label = getString(record.label, 'Avanza') ?? 'Avanza'
  const feedback = getString(record.feedback, '') ?? ''
  const nextNodeId = getString(record.nextNodeId, null)
  const impactRecord = record.impact && typeof record.impact === 'object' ? (record.impact as MaybeRecord) : null

  return {
    id,
    label,
    feedback,
    nextNodeId,
    impact: {
      score: getNumber(impactRecord?.score, null) ?? 0,
      risk: getNumber(impactRecord?.risk, null) ?? 0,
      competencyTags: getStringArray(impactRecord?.competencyTags),
      summary: getString(impactRecord?.summary, null),
    },
  }
}

const normalizeNode = (node: unknown, index: number): GeneratedScenarioNode | null => {
  if (!node || typeof node !== 'object') return null
  const record = node as MaybeRecord
  const id = getString(record.id, `node-${index}`) ?? `node-${index}`
  const type = record.type === 'reflection' ? 'reflection' : 'decision'
  const situation = getString(record.situation, 'Analizza la situazione e scegli come procedere.') ??
    'Analizza la situazione e scegli come procedere.'
  const headline = getString(record.headline, null)
  const narrative = getString(record.narrative, null)
  const prompt = getString(record.prompt, null)
  const guidance = getString(record.guidance, null)
  const maxScore = getNumber(record.maxScore, null)

  const choicesArray = Array.isArray(record.choices) ? record.choices : []
  const normalizedChoices = choicesArray
    .map((choice, choiceIndex) => normalizeChoice(choice, `${id}-choice-${choiceIndex}`))
    .filter((choice): choice is GeneratedScenarioChoice => Boolean(choice))

  const rubricRecord = record.rubric && typeof record.rubric === 'object' ? (record.rubric as MaybeRecord) : null

  return {
    id,
    type,
    situation,
    headline,
    narrative,
    prompt,
    guidance,
    choices: type === 'decision' ? normalizedChoices : undefined,
    rubric: rubricRecord
      ? {
          excellent: getString(rubricRecord.excellent, null) ?? undefined,
          satisfactory: getString(rubricRecord.satisfactory, null) ?? undefined,
          needsSupport: getString(rubricRecord.needsSupport, null) ?? undefined,
        }
      : null,
    maxScore,
  }
}

export function normalizeScenarioPayload(payload: unknown): GeneratedScenarioPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Scenario payload is not an object')
  }
  const record = payload as MaybeRecord

  const nodesRaw = Array.isArray(record.nodes) ? record.nodes : []
  const normalizedNodes = nodesRaw
    .map((node, index) => normalizeNode(node, index))
    .filter((node): node is GeneratedScenarioNode => Boolean(node))

  if (normalizedNodes.length === 0) {
    throw new Error('Scenario payload does not include nodes')
  }

  const objectives = getStringArray(record.objectives)
  const debriefRecord = record.debrief && typeof record.debrief === 'object' ? (record.debrief as MaybeRecord) : {}

  return {
    intro: getString(record.intro, 'Benvenuto nel Decision Lab dell’azienda.') ?? 'Benvenuto nel Decision Lab dell’azienda.',
    objectives: objectives.length > 0 ? objectives : ['Applicare le policy interne in un contesto realistico.'],
    estimatedDurationMinutes: getNumber(record.estimatedDurationMinutes, null),
    contextNotes: getString(record.contextNotes, null),
    nodes: normalizedNodes,
    debrief: {
      summary:
        getString(debriefRecord.summary, 'Rivedi le decisioni prese e confrontale con le best practice aziendali.') ??
        'Rivedi le decisioni prese e confrontale con le best practice aziendali.',
      coachingPoints: getStringArray(debriefRecord.coachingPoints),
      skillSignals: getStringArray(debriefRecord.skillSignals),
      riskAlerts: getStringArray(debriefRecord.riskAlerts),
      followUpQuestions: getStringArray(debriefRecord.followUpQuestions),
    },
  }
}

export function extractScenarioPayload(result: unknown): GeneratedScenarioPayload | null {
  if (!result || typeof result !== 'object') return null
  const container = result as MaybeRecord
  const scenarioSource =
    container.scenario && typeof container.scenario === 'object' && container.scenario !== null
      ? (container.scenario as MaybeRecord)
      : container
  try {
    return normalizeScenarioPayload(scenarioSource)
  } catch {
    return null
  }
}

export const summarizeScenario = (payload: GeneratedScenarioPayload) => ({
  intro: payload.intro,
  objectives: payload.objectives,
  nodeCount: payload.nodes.length,
  estimatedDurationMinutes: payload.estimatedDurationMinutes ?? null,
})
