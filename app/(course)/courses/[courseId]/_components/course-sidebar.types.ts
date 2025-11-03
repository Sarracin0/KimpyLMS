import { Prisma } from '@prisma/client'

export type BlockData = {
  id: string
  title: string
  type: string
  position: number
  isPublished: boolean
  legacyChapterId?: string | null
  contentUrl?: string | null
  liveSession?: { meetingUrl: string | null } | null
  gamification?: {
    contentType: 'QUIZ' | 'FLASHCARDS' | 'SCENARIO' | 'ARENA'
    quizId?: string | null
    flashcardDeck?: {
      id: string
      title: string | null
    } | null
    scenarioSummary?: {
      intro: string | null
      nodeCount: number
    } | null
    arenaSummary?: {
      title: string | null
      axes: number
    } | null
  } | null
}

export type LessonWithBlocks = {
  id: string
  title: string
  description: string | null
  position: number
  isPublished: boolean
  isPreview: boolean
  blocks: BlockData[]
  progress: Array<{
    isCompleted: boolean
  }>
}

export type ModuleWithLessons = {
  id: string
  title: string
  description: string | null
  position: number
  isPublished: boolean
  lessons: LessonWithBlocks[]
}

export type CourseWithStructure = Prisma.CourseGetPayload<{
  include: {
    chapters: {
      include: {
        progress: true
        attachments: true
      }
    }
    enrollments: true
  }
}> & {
  modules?: ModuleWithLessons[]
}
