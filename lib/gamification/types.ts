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

export type GamificationGenerationResult = {
  type: GamificationContentType
  raw?: unknown
  quiz?: GeneratedQuizPayload
  flashcards?: GeneratedFlashcardPayload
}
