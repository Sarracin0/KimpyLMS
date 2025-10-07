import { getOpenAIClient } from '@/lib/openai/client'
import type { GeneratedArenaPayload } from './types'

export type ArenaEvaluationAxis = {
  axisId: string
  label: string
  score: number
  evidence: string
  suggestion: string
}

export type ArenaEvaluation = {
  overallScore: number
  axes: ArenaEvaluationAxis[]
  summary: string
  improvementAdvice: string
}

type EvaluationInput = {
  arena: GeneratedArenaPayload
  plan: string
  previousPlan?: string | null
}

const SCORE_TOOL = {
  type: 'function' as const,
  name: 'score_practice_arena_plan',
  description: 'Valuta un piano d\'azione confrontandolo con la rubrica della Practice Arena e restituisce punteggi e coaching.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      overall_score: { type: 'number' },
      axis_scores: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            axis_id: { type: 'string' },
            label: { type: 'string' },
            score: { type: 'number' },
            evidence: { type: 'string' },
            suggestion: { type: 'string' },
          },
          required: ['axis_id', 'label', 'score', 'evidence', 'suggestion'],
        },
      },
      summary: { type: 'string' },
      improvement_advice: { type: 'string' },
    },
    required: ['overall_score', 'axis_scores', 'summary', 'improvement_advice'],
  },
}

const clampScore = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)))
  }
  const parsed = Number(value)
  if (Number.isFinite(parsed)) {
    return Math.min(100, Math.max(0, Math.round(parsed)))
  }
  return 0
}

export async function evaluatePracticeArenaPlan({ arena, plan, previousPlan }: EvaluationInput): Promise<ArenaEvaluation> {
  const client = getOpenAIClient()

  const axisContext = arena.axes
    .map((axis, index) => {
      const levels = [
        axis.levels.excels ? `Eccellenza: ${axis.levels.excels}` : null,
        axis.levels.solid ? `Solido: ${axis.levels.solid}` : null,
        axis.levels.needsSupport ? `Da migliorare: ${axis.levels.needsSupport}` : null,
      ]
        .filter(Boolean)
        .join('\n')
      const tips = (axis.coachingTips ?? []).length > 0 ? `Suggerimenti HR: ${(axis.coachingTips ?? []).join('; ')}` : ''
      return `Asse ${index + 1}: ${axis.label}${axis.description ? ` — ${axis.description}` : ''}\n${levels}${tips ? `\n${tips}` : ''}`
    })
    .join('\n\n')

  const objectives = arena.objectives.map((item, index) => `${index + 1}. ${item}`).join('\n')
  const expectedSections = arena.expectedSections.join(', ')

  const messages = [
    {
      role: 'system' as const,
      content: [
        {
          type: 'input_text' as const,
          text: 'Sei un performance coach aziendale. Valuta piani d\'azione di dipendenti assegnando punteggi 0-100 per ogni asse soft-skill, coerentemente con la rubrica e senza inventare nuove metriche.',
        },
      ],
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'input_text' as const,
          text: [
            `Scenario: ${arena.title}`,
            `Ruolo learner: ${arena.learnerRole}`,
            `Brief: ${arena.scenarioBrief}`,
            `Sfida: ${arena.challenge}`,
            `Obiettivi chiave:\n${objectives}`,
            `Sezioni attese nel piano: ${expectedSections}`,
            `Assi di valutazione:\n${axisContext}`,
            arena.aiCoachTips.length ? `Linee guida del coach AI: ${arena.aiCoachTips.join(' · ')}` : '',
            previousPlan ? `Piano precedente per confronto:\n${previousPlan}` : '',
            `Piano attuale da valutare:\n${plan}`,
            'Restituisci punteggio complessivo e dettagli per asse rispettando la rubrica. Se qualche sezione manca, abbassa il punteggio e suggerisci come colmare il gap.',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    },
  ]

  const model = process.env.OPENAI_GAMIFICATION_MODEL || 'gpt-4.1-mini'

  const response = await client.responses.create({
    model,
    temperature: 0.3,
    top_p: 0.9,
    tool_choice: { type: 'function', name: SCORE_TOOL.name },
    tools: [SCORE_TOOL],
    input: messages,
  })

  const toolCall = (response.output ?? []).find(
    (item): item is { type: 'function_call'; name: string; arguments: string } => item.type === 'function_call',
  )

  if (!toolCall || !toolCall.arguments) {
    throw new Error('Model did not return an arena evaluation')
  }

  const parsed = JSON.parse(toolCall.arguments) as {
    overall_score?: number
    axis_scores?: Array<{
      axis_id?: string
      label?: string
      score?: number
      evidence?: string
      suggestion?: string
    }>
    summary?: string
    improvement_advice?: string
  }

  const axes = (parsed.axis_scores ?? [])
    .map((axis, index): ArenaEvaluationAxis | null => {
      const axisId = typeof axis.axis_id === 'string' && axis.axis_id.trim().length > 0 ? axis.axis_id.trim() : arena.axes[index]?.id
      if (!axisId) return null
      const label = typeof axis.label === 'string' && axis.label.trim().length > 0 ? axis.label.trim() : arena.axes[index]?.label ?? axisId
      const evidence = typeof axis.evidence === 'string' ? axis.evidence.trim() : ''
      const suggestion = typeof axis.suggestion === 'string' ? axis.suggestion.trim() : ''
      return {
        axisId,
        label,
        score: clampScore(axis.score),
        evidence,
        suggestion,
      }
    })
    .filter((axis): axis is ArenaEvaluationAxis => Boolean(axis))

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  const improvementAdvice = typeof parsed.improvement_advice === 'string' ? parsed.improvement_advice.trim() : ''

  return {
    overallScore: clampScore(parsed.overall_score),
    axes,
    summary,
    improvementAdvice,
  }
}
