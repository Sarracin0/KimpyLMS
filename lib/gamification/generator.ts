import { GamificationContentType, QuizQuestionType } from '@prisma/client'
import { getOpenAIClient } from '@/lib/openai/client'
import {
  GamificationGenerationResult,
  GamificationGenerationInput,
  GeneratedQuizPayload,
  GeneratedFlashcardPayload,
  GeneratedQuizQuestion,
  GeneratedScenarioPayload,
  GeneratedArenaPayload,
} from './types'
import { normalizeScenarioPayload } from './scenario'
import { normalizeArenaPayload } from './arena'
import { logWarn } from '@/lib/logger'

type ToolCall = {
  type: string
  name: string
  arguments: string
}

const QUIZ_TOOL = {
  type: 'function' as const,
  name: 'create_quiz',
  description: 'Produce a quiz aligned with the provided learning materials.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      description: { type: ['string', 'null'] },
      passScore: { type: 'number' },
      pointsReward: { type: 'number' },
      maxAttempts: { type: ['number', 'null'] },
      timeLimitSeconds: { type: ['number', 'null'] },
      shuffleQuestions: { type: 'boolean' },
      shuffleOptions: { type: 'boolean' },
      questions: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string' },
            explanation: { type: ['string', 'null'] },
            required: { type: 'boolean' },
            points: { type: 'number' },
            type: {
              type: 'string',
              enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER'],
            },
            options: {
              type: 'array',
              minItems: 0,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: { type: 'string' },
                  isCorrect: { type: 'boolean' },
                  points: { type: 'number' },
                },
                required: ['text', 'isCorrect', 'points'],
              },
            },
          },
          required: ['text', 'required', 'points', 'type', 'options', 'explanation'],
        },
      },
    },
    required: [
      'title',
      'description',
      'passScore',
      'pointsReward',
      'maxAttempts',
      'timeLimitSeconds',
      'shuffleQuestions',
      'shuffleOptions',
      'questions',
    ],
  },
}

const FLASHCARD_TOOL = {
  type: 'function' as const,
  name: 'create_flashcard_deck',
  description: 'Produce a flashcard deck that reinforces the provided learning materials.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      description: { type: ['string', 'null'] },
      cards: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            front: { type: 'string' },
            back: { type: 'string' },
            points: { type: 'number' },
          },
          required: ['front', 'back', 'points'],
        },
      },
    },
    required: ['title', 'description', 'cards'],
  },
}

const SCENARIO_TOOL = {
  type: 'function' as const,
  name: 'create_scenario_lab',
  description: 'Produce an immersive branching scenario lab grounded in the provided materials.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      intro: { type: 'string' },
      objectives: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
      },
      estimatedDurationMinutes: { type: ['number', 'null'] },
      contextNotes: { type: ['string', 'null'] },
      nodes: {
        type: 'array',
        minItems: 2,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['decision', 'reflection'] },
            situation: { type: 'string' },
            headline: { type: ['string', 'null'] },
            narrative: { type: ['string', 'null'] },
            prompt: { type: ['string', 'null'] },
            guidance: { type: ['string', 'null'] },
            maxScore: { type: ['number', 'null'] },
            choices: {
              type: ['array', 'null'],
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  label: { type: 'string' },
                  feedback: { type: 'string' },
                  nextNodeId: { type: ['string', 'null'] },
                  impact: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      score: { type: ['number', 'null'] },
                      risk: { type: ['number', 'null'] },
                      competencyTags: {
                        type: 'array',
                        minItems: 0,
                        items: { type: 'string' },
                      },
                      summary: { type: ['string', 'null'] },
                    },
                    required: ['score', 'risk', 'competencyTags', 'summary'],
                  },
                },
                required: ['id', 'label', 'feedback', 'nextNodeId', 'impact'],
              },
              minItems: 0,
            },
            rubric: {
              type: ['object', 'null'] ,
              additionalProperties: false,
              properties: {
                excellent: { type: ['string', 'null'] },
                satisfactory: { type: ['string', 'null'] },
                needsSupport: { type: ['string', 'null'] },
              },
              required: ['excellent', 'satisfactory', 'needsSupport'],
            },
          },
          required: ['id', 'type', 'situation', 'headline', 'narrative', 'prompt', 'guidance', 'maxScore', 'choices', 'rubric'],
        },
      },
      debrief: {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: { type: 'string' },
          coachingPoints: {
            type: 'array',
            minItems: 0,
            items: { type: 'string' },
          },
          skillSignals: {
            type: 'array',
            minItems: 0,
            items: { type: 'string' },
          },
          riskAlerts: {
            type: 'array',
            minItems: 0,
            items: { type: 'string' },
          },
          followUpQuestions: {
            type: 'array',
            minItems: 0,
            items: { type: 'string' },
          },
        },
        required: ['summary', 'coachingPoints', 'skillSignals', 'riskAlerts', 'followUpQuestions'],
      },
    },
    required: ['intro', 'objectives', 'estimatedDurationMinutes', 'contextNotes', 'nodes', 'debrief'],
  },
}

const ARENA_TOOL = {
  type: 'function' as const,
  name: 'create_practice_arena',
  description: 'Produce a reflective Practice Arena exercise focused on action-plan iteration and soft skills.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      scenarioBrief: { type: 'string' },
      learnerRole: { type: 'string' },
      objectives: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
      },
      challenge: { type: 'string' },
      submissionPrompt: { type: 'string' },
      iterationPrompt: { type: 'string' },
      peerReviewPrompt: { type: 'string' },
      expectedSections: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
      },
      axes: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            description: { type: ['string', 'null'] },
            weight: { type: ['number', 'null'] },
            coachingTips: {
              type: 'array',
              minItems: 0,
              items: { type: 'string' },
            },
            levels: {
              type: 'object',
              additionalProperties: false,
              properties: {
                excels: { type: ['string', 'null'] },
                solid: { type: ['string', 'null'] },
                needsSupport: { type: ['string', 'null'] },
              },
              required: ['excels', 'solid', 'needsSupport'],
            },
          },
          required: ['id', 'label', 'description', 'weight', 'coachingTips', 'levels'],
        },
      },
      aiCoachTips: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
      },
      estimatedDurationMinutes: { type: ['number', 'null'] },
      sampleHighScorePlan: { type: ['string', 'null'] },
      tokens: {
        type: 'object',
        additionalProperties: false,
        properties: {
          baseAward: { type: 'number' },
          improvementBonus: { type: 'number' },
          endorsementBonus: { type: 'number' },
        },
        required: ['baseAward', 'improvementBonus', 'endorsementBonus'],
      },
    },
    required: [
      'title',
      'scenarioBrief',
      'learnerRole',
      'objectives',
      'challenge',
      'submissionPrompt',
      'iterationPrompt',
      'peerReviewPrompt',
      'expectedSections',
      'axes',
      'aiCoachTips',
      'estimatedDurationMinutes',
      'sampleHighScorePlan',
      'tokens',
    ],
  },
}

const QUIZ_DEFAULT_PASS_SCORE = 70
const QUIZ_DEFAULT_POINTS = 100

const MAX_SOURCE_SNIPPET = 4000

async function fetchSnippet(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: 'GET' })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || (!contentType.includes('text') && !contentType.includes('json'))) {
      return ''
    }
    const text = await response.text()
    return text.slice(0, MAX_SOURCE_SNIPPET)
  } catch (_error) {
    logWarn('GAMIFICATION_SNIPPET', `Unable to fetch document ${url}`)
    return ''
  }
}

function buildDocumentsContext(
  attachments: GamificationGenerationInput['attachments'],
  snippets: Record<string, string>,
) {
  if (attachments.length === 0) {
    return 'Non sono stati forniti documenti. Genera contenuti di onboarding generici e chiedi conferma all’HR.'
  }

  return attachments
    .map((attachment, index) => {
      const snippet = snippets[attachment.id]
      const excerpt = snippet
        ? snippet
        : 'Nessun estratto disponibile: usa principalmente il titolo, il tipo e il contesto del documento.'
      return [
        `Documento ${index + 1}: ${attachment.name}`,
        `Scope: ${attachment.scope.toLowerCase()}${attachment.chapterId ? ` · chapterId=${attachment.chapterId}` : ''}`,
        `URL: ${attachment.url}`,
        'Estratto:',
        excerpt,
      ].join('\n')
    })
    .join('\n\n')
}

function buildSettingsContext(input: GamificationGenerationInput) {
  const { contentType, settings } = input
  const lines: string[] = []
  const rawSettings = settings as Record<string, unknown>
  const getString = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
  const getNumber = (value: unknown, fallback: number) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  if (contentType === GamificationContentType.QUIZ) {
    lines.push(`Numero richiesto di domande: ${getNumber(rawSettings.questionCount, 6)}`)
    lines.push(`Difficoltà target: ${getString(rawSettings.difficulty, 'mixed')}`)
  } else if (contentType === GamificationContentType.FLASHCARDS) {
    lines.push(`Numero richiesto di flashcard: ${getNumber(rawSettings.cardCount, 10)}`)
  } else if (contentType === GamificationContentType.SCENARIO) {
    lines.push(`Numero di nodi decisionali richiesto: ${getNumber(rawSettings.nodeCount, 5)}`)
    const focus = getString(rawSettings.focusCompetency, '')
    if (focus) {
      lines.push(`Competenza primaria da allenare: ${focus}`)
    }
    const risk = getString(rawSettings.riskProfile, '')
    if (risk) {
      lines.push(`Profilo di rischio desiderato: ${risk}`)
    }
  } else {
    lines.push(`Numero di assi di valutazione desiderato: ${getNumber(rawSettings.axisCount, 3)}`)
    const softSkill = getString(rawSettings.focusCompetency, '')
    if (softSkill) {
      lines.push(`Soft skill da evidenziare: ${softSkill}`)
    }
    const iterationFocus = getString(rawSettings.iterationGoal, '')
    if (iterationFocus) {
      lines.push(`Focus di miglioramento tra i tentativi: ${iterationFocus}`)
    }
    const peerReview = getString(rawSettings.peerVisibility, '')
    if (peerReview) {
      lines.push(`Modalità endorsement tra colleghi: ${peerReview}`)
    }
  }

  lines.push(`Tono da utilizzare: ${getString(rawSettings.tone, 'neutral')}`)
  const notes = getString(rawSettings.notes, '')
  if (notes) {
    lines.push(`Istruzioni extra dall'HR: ${notes}`)
  }

  return lines.join('\n')
}

function normalizeQuizPayload(payload: GeneratedQuizPayload): GeneratedQuizPayload {
  const normalizedQuestions: GeneratedQuizQuestion[] = (payload.questions ?? []).map((question) => ({
    text: question.text,
    explanation: question.explanation ?? null,
    required: question.required ?? true,
    points: question.points ?? 1,
    type: question.type ?? QuizQuestionType.MULTIPLE_CHOICE,
    options: (question.options ?? []).map((option) => ({
      text: option.text,
      isCorrect: option.isCorrect ?? false,
      points: option.points ?? 0,
    })),
  }))

  return {
    title: payload.title,
    description: payload.description ?? null,
    passScore: payload.passScore ?? QUIZ_DEFAULT_PASS_SCORE,
    pointsReward: payload.pointsReward ?? QUIZ_DEFAULT_POINTS,
    maxAttempts: payload.maxAttempts ?? null,
    timeLimitSeconds: payload.timeLimitSeconds ?? null,
    shuffleQuestions: payload.shuffleQuestions ?? true,
    shuffleOptions: payload.shuffleOptions ?? true,
    questions: normalizedQuestions.slice(0, Math.max(1, normalizedQuestions.length)),
  }
}

function normalizeFlashcardPayload(payload: GeneratedFlashcardPayload): GeneratedFlashcardPayload {
  const cards = (payload.cards ?? []).map((card) => ({
    front: card.front,
    back: card.back,
    points: card.points ?? 0,
  }))

  return {
    title: payload.title,
    description: payload.description ?? null,
    cards: cards.slice(0, Math.max(1, cards.length)).map((card) => ({
      front: card.front,
      back: card.back,
      points: card.points,
    })),
  }
}


export async function generateGamificationContent(
  input: GamificationGenerationInput,
): Promise<GamificationGenerationResult> {
  const client = getOpenAIClient()

  const snippets: Record<string, string> = {}
  await Promise.all(
    input.attachments.map(async (attachment) => {
      const snippet = await fetchSnippet(attachment.url)
      snippets[attachment.id] = snippet
    }),
  )

  const documentsContext = buildDocumentsContext(input.attachments, snippets)
  const settingsContext = buildSettingsContext(input)

  const systemPrompt = `Sei un instructional designer senior. Genera contenuti di gamification per un corso aziendale senza inventare fatti non presenti nei documenti. Mantieni uno stile professionale e adatto a dipendenti corporate italiani.`

  const baseUserPrompt = [`Contenuti da studiare:`, documentsContext, '', 'Parametri HR:', settingsContext].join('\n')

  const model = process.env.OPENAI_GAMIFICATION_MODEL || 'gpt-4.1-mini'

  const toolChoice =
    input.contentType === GamificationContentType.QUIZ
      ? { type: 'function', name: 'create_quiz' as const }
      : input.contentType === GamificationContentType.FLASHCARDS
        ? { type: 'function', name: 'create_flashcard_deck' as const }
        : input.contentType === GamificationContentType.SCENARIO
          ? { type: 'function', name: 'create_scenario_lab' as const }
          : { type: 'function', name: 'create_practice_arena' as const }

  const tools = [QUIZ_TOOL, FLASHCARD_TOOL, SCENARIO_TOOL, ARENA_TOOL]

  const instructionText =
    input.contentType === GamificationContentType.QUIZ
      ? 'Genera un quiz strutturato seguendo lo schema JSON della funzione create_quiz. Ogni domanda deve essere agganciata ai contenuti forniti.'
      : input.contentType === GamificationContentType.FLASHCARDS
        ? 'Genera un mazzo di flashcard seguendo lo schema JSON della funzione create_flashcard_deck. Ogni carta deve essere fondata sui materiali.'
        : input.contentType === GamificationContentType.SCENARIO
          ? 'Genera un laboratorio decisionale ramificato seguendo lo schema JSON della funzione create_scenario_lab. Mantieni 4-6 nodi con feedback specifico, punteggio e analisi del rischio per HR.'
          : 'Genera una Practice Arena seguendo lo schema JSON della funzione create_practice_arena. Fornisci un briefing realistico, rubriche soft-skill e prompt per iterazione e peer endorsement.'

  const response = await client.responses.create({
    model,
    temperature: 0.6,
    top_p: 0.9,
    parallel_tool_calls: false,
    tool_choice: toolChoice,
    tools,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: baseUserPrompt },
          { type: 'input_text', text: instructionText },
        ],
      },
    ],
  })

  const toolCall = (response.output ?? []).find(
    (item): item is ToolCall => item.type === 'function_call',
  )

  if (!toolCall) {
    throw new Error('Model did not return a function call')
  }

  const args = toolCall.arguments?.trim()
  if (!args) {
    throw new Error('Model returned an empty payload')
  }

  const parsed = JSON.parse(args)

  if (toolCall.name === 'create_quiz') {
    const normalized = normalizeQuizPayload(parsed as GeneratedQuizPayload)
    if (!normalized.questions || normalized.questions.length === 0) {
      throw new Error('Quiz payload does not contain questions')
    }

    const desired = typeof input.settings.questionCount === 'number' ? input.settings.questionCount : normalized.questions.length
    const limit = Math.max(1, Math.min(desired, normalized.questions.length))
    normalized.questions = normalized.questions.slice(0, limit)

    return {
      type: GamificationContentType.QUIZ,
      quiz: normalized,
      raw: response,
    }
  }

  if (toolCall.name === 'create_flashcard_deck') {
    const normalized = normalizeFlashcardPayload(parsed as GeneratedFlashcardPayload)
    if (!normalized.cards || normalized.cards.length === 0) {
      throw new Error('Flashcard payload does not contain cards')
    }

    const desired = typeof input.settings.cardCount === 'number' ? input.settings.cardCount : normalized.cards.length
    const limit = Math.max(1, Math.min(desired, normalized.cards.length))
    normalized.cards = normalized.cards.slice(0, limit)

    return {
      type: GamificationContentType.FLASHCARDS,
      flashcards: normalized,
      raw: response,
    }
  }

  if (toolCall.name === 'create_scenario_lab') {
    const normalized = normalizeScenarioPayload(parsed as GeneratedScenarioPayload)
    if (!normalized.nodes || normalized.nodes.length === 0) {
      throw new Error('Scenario payload does not contain decision nodes')
    }

    return {
      type: GamificationContentType.SCENARIO,
      scenario: normalized,
      raw: response,
    }
  }

  if (toolCall.name === 'create_practice_arena') {
    const normalized = normalizeArenaPayload(parsed as GeneratedArenaPayload)
    if (!normalized.axes || normalized.axes.length === 0) {
      throw new Error('Arena payload does not contain axes for evaluation')
    }

    return {
      type: GamificationContentType.ARENA,
      arena: normalized,
      raw: response,
    }
  }

  throw new Error(`Unsupported tool call: ${toolCall.name}`)
}
