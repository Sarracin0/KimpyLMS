import type { GeneratedArenaPayload, GeneratedArenaAxis, GeneratedArenaTokens } from './types'

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
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

const normalizeTokens = (value: unknown): GeneratedArenaTokens => {
  if (!value || typeof value !== 'object') {
    return {
      baseAward: 5,
      improvementBonus: 10,
      endorsementBonus: 5,
    }
  }

  const record = value as MaybeRecord
  const baseAward = getNumber(record.baseAward, 5) ?? 5
  const improvementBonus = getNumber(record.improvementBonus, 10) ?? 10
  const endorsementBonus = getNumber(record.endorsementBonus, 5) ?? 5

  return {
    baseAward,
    improvementBonus,
    endorsementBonus,
  }
}

const normalizeAxis = (axis: unknown, fallbackId: string): GeneratedArenaAxis | null => {
  if (!axis || typeof axis !== 'object') return null
  const record = axis as MaybeRecord

  const id = getString(record.id, fallbackId) ?? fallbackId
  const label = getString(record.label, 'Competenza chiave') ?? 'Competenza chiave'
  const description = getString(record.description, null)
  const weight = getNumber(record.weight, null)
  const coachingTips = getStringArray(record.coachingTips)

  const levelsRecord = record.levels && typeof record.levels === 'object' ? (record.levels as MaybeRecord) : null

  return {
    id,
    label,
    description,
    weight,
    levels: {
      excels: getString(levelsRecord?.excels, null) ?? undefined,
      solid: getString(levelsRecord?.solid, null) ?? undefined,
      needsSupport: getString(levelsRecord?.needsSupport, null) ?? undefined,
    },
    coachingTips,
  }
}

export function normalizeArenaPayload(payload: unknown): GeneratedArenaPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Arena payload is not an object')
  }

  const record = payload as MaybeRecord
  const objectives = getStringArray(record.objectives)
  const expectedSections = getStringArray(record.expectedSections)
  const aiCoachTips = getStringArray(record.aiCoachTips)
  const axesRaw = Array.isArray(record.axes) ? record.axes : []

  const axes = axesRaw
    .map((axis, index) => normalizeAxis(axis, `axis-${index + 1}`))
    .filter((axis): axis is GeneratedArenaAxis => Boolean(axis))

  if (axes.length === 0) {
    throw new Error('Arena payload requires at least one axis')
  }

  return {
    title: getString(record.title, 'Practice Arena') ?? 'Practice Arena',
    scenarioBrief:
      getString(
        record.scenarioBrief,
        'Applica quanto appreso nel capitolo a uno scenario operativo realistico.',
      ) ?? 'Applica quanto appreso nel capitolo a uno scenario operativo realistico.',
    learnerRole: getString(record.learnerRole, 'Learner') ?? 'Learner',
    objectives: objectives.length > 0 ? objectives : ['Tradurre la teoria in azione concreta.'],
    challenge:
      getString(record.challenge, 'Definisci un piano d’azione chiaro e motivante per affrontare la situazione.') ??
      'Definisci un piano d’azione chiaro e motivante per affrontare la situazione.',
    submissionPrompt:
      getString(
        record.submissionPrompt,
        'Scrivi un piano concreto (max 200 parole) spiegando come agiresti nei prossimi 30 giorni.',
      ) ?? 'Scrivi un piano concreto (max 200 parole) spiegando come agiresti nei prossimi 30 giorni.',
    iterationPrompt:
      getString(
        record.iterationPrompt,
        'Rivedi il tuo piano incorporando i suggerimenti ricevuti: quali adattamenti farai per ottenere un impatto maggiore?',
      ) ??
      'Rivedi il tuo piano incorporando i suggerimenti ricevuti: quali adattamenti farai per ottenere un impatto maggiore?',
    peerReviewPrompt:
      getString(
        record.peerReviewPrompt,
        'Quando dai endorsement a un collega, commenta chiarezza, impatto e fattibilità del suo piano.',
      ) ?? 'Quando dai endorsement a un collega, commenta chiarezza, impatto e fattibilità del suo piano.',
    expectedSections: expectedSections.length > 0 ? expectedSections : ['Obiettivi', 'Azioni chiave', 'Metriche di successo'],
    axes,
    aiCoachTips: aiCoachTips.length > 0 ? aiCoachTips : ['Concentra il piano su risultati misurabili e responsabilità chiare.'],
    estimatedDurationMinutes: getNumber(record.estimatedDurationMinutes, null),
    sampleHighScorePlan: getString(record.sampleHighScorePlan, null),
    tokens: normalizeTokens(record.tokens),
  }
}

export function extractArenaPayload(result: unknown): GeneratedArenaPayload | null {
  if (!result || typeof result !== 'object') return null
  const container = result as MaybeRecord
  const arenaSource =
    container.arena && typeof container.arena === 'object' && container.arena !== null
      ? (container.arena as MaybeRecord)
      : container
  try {
    return normalizeArenaPayload(arenaSource)
  } catch {
    return null
  }
}

export const summarizeArena = (payload: GeneratedArenaPayload) => ({
  title: payload.title,
  learnerRole: payload.learnerRole,
  axes: payload.axes.length,
  objectives: payload.objectives.length,
  estimatedDurationMinutes: payload.estimatedDurationMinutes ?? null,
})
