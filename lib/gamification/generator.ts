import { GamificationContentType, QuizQuestionType } from '@prisma/client'
import { getOpenAIClient } from '@/lib/openai/client'
import {
  GamificationGenerationResult,
  GamificationGenerationInput,
  GeneratedQuizPayload,
  GeneratedFlashcardPayload,
  GeneratedQuizQuestion,
} from './types'
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
  } catch (error) {
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

  if (contentType === GamificationContentType.QUIZ) {
    lines.push(`Numero richiesto di domande: ${settings.questionCount ?? 6}`)
    lines.push(`Difficoltà target: ${(settings.difficulty ?? 'mixed').toString()}`)
  } else {
    lines.push(`Numero richiesto di flashcard: ${settings.cardCount ?? 10}`)
  }

  lines.push(`Tono da utilizzare: ${(settings.tone ?? 'neutral').toString()}`)
  if (settings.notes) {
    lines.push(`Istruzioni extra dall'HR: ${settings.notes}`)
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
      : { type: 'function', name: 'create_flashcard_deck' as const }

  const tools = [QUIZ_TOOL, FLASHCARD_TOOL]

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
          {
            type: 'input_text',
            text:
              input.contentType === GamificationContentType.QUIZ
                ? 'Genera un quiz strutturato seguendo lo schema JSON della funzione create_quiz. Ogni domanda deve essere agganciata ai contenuti forniti.'
                : 'Genera un mazzo di flashcard seguendo lo schema JSON della funzione create_flashcard_deck. Ogni carta deve essere fondata sui materiali.',
          },
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

  throw new Error(`Unsupported tool call: ${toolCall.name}`)
}
