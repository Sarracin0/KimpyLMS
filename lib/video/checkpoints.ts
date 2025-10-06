import type { VideoCheckpoint, VideoCheckpointAction } from '@/types/video'

const ensureString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

const ensureNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const parseVideoCheckpointAction = (value: unknown): VideoCheckpointAction | null => {
  if (!value || typeof value !== 'object') return null

  const raw = value as Record<string, unknown>
  const type = ensureString(raw.type).toUpperCase()

  switch (type) {
    case 'MESSAGE':
      return {
        type: 'MESSAGE',
        ctaLabel: ensureString(raw.ctaLabel) || null,
        ctaUrl: ensureString(raw.ctaUrl) || null,
      }
    case 'QUIZ': {
      const blockId = ensureString(raw.blockId)
      return blockId ? { type: 'QUIZ', blockId } : null
    }
    case 'SCENARIO': {
      const blockId = ensureString(raw.blockId)
      return blockId ? { type: 'SCENARIO', blockId } : null
    }
    case 'FLASHCARDS': {
      const deckId = ensureString(raw.deckId)
      return deckId ? { type: 'FLASHCARDS', deckId } : null
    }
    default:
      return null
  }
}

export const parseVideoCheckpoints = (value: unknown): VideoCheckpoint[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Record<string, unknown>
      const id = ensureString(raw.id)
      const time = ensureNumber(raw.timeInSeconds)
      if (!id || time === null) return null

      const action = parseVideoCheckpointAction(raw.action)

      const checkpoint: VideoCheckpoint = {
        id,
        timeInSeconds: Math.max(0, Math.round(time)),
        title: ensureString(raw.title, 'Interruzione video'),
        description: ensureString(raw.description) || null,
        action,
      }

      return checkpoint
    })
    .filter((item): item is VideoCheckpoint => item !== null)
    .sort((a, b) => a.timeInSeconds - b.timeInSeconds)
}

export const serializeVideoCheckpoints = (checkpoints: VideoCheckpoint[]): VideoCheckpoint[] =>
  checkpoints
    .map((checkpoint) => ({
      ...checkpoint,
      description: checkpoint.description ?? null,
      action: checkpoint.action ?? null,
    }))
    .sort((a, b) => a.timeInSeconds - b.timeInSeconds)
