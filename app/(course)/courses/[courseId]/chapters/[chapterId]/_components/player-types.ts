export type CoachMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  pending?: boolean
}

export type ChapterCommentVisibilityOption = 'PRIVATE' | 'PUBLIC' | 'HR_ONLY'

export type ChapterCommentItem = {
  id: string
  content: string
  visibility: ChapterCommentVisibilityOption
  playbackSecond: number | null
  createdAt: string
  authorId: string
  isMine: boolean
}

export type HeatmapBucket = {
  second: number
  count: number
}

export type PlayerEventPayload = {
  type: 'PAUSE' | 'RESUME' | 'REWATCH' | 'COACH_PROMPT'
  playbackSecond?: number | null
  timestampMs?: number | null
}
