export type VideoCheckpointAction =
  | {
      type: 'MESSAGE'
      ctaLabel?: string | null
      ctaUrl?: string | null
    }
  | {
      type: 'QUIZ'
      blockId: string
    }
  | {
      type: 'SCENARIO'
      blockId: string
    }
  | {
      type: 'ARENA'
      blockId: string
    }
  | {
      type: 'FLASHCARDS'
      deckId: string
    }

export type VideoCheckpoint = {
  id: string
  timeInSeconds: number
  title: string
  description?: string | null
  action?: VideoCheckpointAction | null
}
