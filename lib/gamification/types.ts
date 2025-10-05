import type {
  AttachmentScope,
  GamificationContentType,
  QuizQuestionType,
} from '@prisma/client'

export type GamificationAttachment = {
  id: string
  name: string
  url: string
  type: string | null
  scope: AttachmentScope
  chapterId: string | null
}

export type GamificationGenerationInput = {
  companyId: string
  courseId: string
  lessonId: string
  blockId: string
  contentType: GamificationContentType
  attachments: GamificationAttachment[]
  settings: Record<string, unknown>
  requestedBy: {
    profileId: string
    name?: string | null
  }
}

export type GeneratedQuizOption = {
  text: string
  isCorrect?: boolean
  points?: number
}

export type GeneratedQuizQuestion = {
  text: string
  explanation?: string | null
  required?: boolean
  points?: number
  type?: QuizQuestionType
  options?: GeneratedQuizOption[]
}

export type GeneratedQuizPayload = {
  title: string
  description?: string | null
  passScore?: number
  pointsReward?: number
  maxAttempts?: number | null
  timeLimitSeconds?: number | null
  shuffleQuestions?: boolean
  shuffleOptions?: boolean
  questions: GeneratedQuizQuestion[]
}

export type GeneratedFlashcardCard = {
  front: string
  back: string
  points?: number
}

export type GeneratedFlashcardPayload = {
  title: string
  description?: string | null
  cards: GeneratedFlashcardCard[]
}

export type GeneratedScenarioImpact = {
  score?: number
  risk?: number
  competencyTags?: string[]
  summary?: string | null
}

export type GeneratedScenarioChoice = {
  id: string
  label: string
  feedback: string
  impact?: GeneratedScenarioImpact
  nextNodeId?: string | null
}

export type GeneratedScenarioRubric = {
  excellent?: string
  satisfactory?: string
  needsSupport?: string
}

export type GeneratedScenarioNode = {
  id: string
  type: 'decision' | 'reflection'
  situation: string
  headline?: string | null
  narrative?: string | null
  prompt?: string | null
  guidance?: string | null
  choices?: GeneratedScenarioChoice[]
  rubric?: GeneratedScenarioRubric | null
  maxScore?: number | null
}

export type GeneratedScenarioDebrief = {
  summary: string
  coachingPoints?: string[]
  skillSignals?: string[]
  riskAlerts?: string[]
  followUpQuestions?: string[]
}

export type GeneratedScenarioPayload = {
  intro: string
  objectives: string[]
  estimatedDurationMinutes?: number | null
  contextNotes?: string | null
  nodes: GeneratedScenarioNode[]
  debrief: GeneratedScenarioDebrief
}

export type GamificationGenerationResult = {
  type: GamificationContentType
  raw?: unknown
  quiz?: GeneratedQuizPayload
  flashcards?: GeneratedFlashcardPayload
  scenario?: GeneratedScenarioPayload
}
