'use client'

import dynamic from 'next/dynamic'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Loader2, Lock, MessageCircle, NotebookPen, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useConfettiStore } from '@/hooks/use-confetti'
import type { VideoCheckpoint } from '@/types/video'

type ProgressState = {
  playedSeconds: number
}

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

interface VideoPlayerProps {
  courseId: string
  chapterId: string
  nextChapterId?: string
  isLocked: boolean
  completeOnEnd: boolean
  title: string
  videoUrl?: string | null
  checkpoints?: VideoCheckpoint[] | null
}

const buildCheckpointUrl = (courseId: string, checkpoint: VideoCheckpoint): string | null => {
  if (!courseId || !checkpoint.action) return null

  switch (checkpoint.action.type) {
    case 'QUIZ':
      return `/courses/${courseId}/quizzes/${checkpoint.action.blockId}`
    case 'SCENARIO':
      return `/courses/${courseId}/scenarios/${checkpoint.action.blockId}`
    case 'FLASHCARDS':
      return `/courses/${courseId}/flashcards/${checkpoint.action.deckId}`
    case 'MESSAGE':
      return checkpoint.action.ctaUrl ?? null
    default:
      return null
  }
}

export const VideoPlayer = ({
  courseId,
  chapterId,
  nextChapterId,
  isLocked,
  completeOnEnd,
  title,
  videoUrl,
  checkpoints = [],
}: VideoPlayerProps) => {
  const router = useRouter()
  const confetti = useConfettiStore()

  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(!isLocked)
  const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(null)
  const [seenCheckpointIds, setSeenCheckpointIds] = useState<Set<string>>(() => new Set())
  const notesStorageKey = useMemo(() => `chapter-notes:${chapterId}`, [chapterId])
  const [notesDraft, setNotesDraft] = useState('')
  const [isNotesOpen, setIsNotesOpen] = useState(false)

  useEffect(() => {
    setIsPlaying(!isLocked)
  }, [isLocked])

  useEffect(() => {
    setIsReady(false)
    setActiveCheckpointId(null)
    setSeenCheckpointIds(new Set())
    setIsNotesOpen(false)
  }, [videoUrl])

  useEffect(() => {
    setActiveCheckpointId(null)
    setSeenCheckpointIds(new Set())
  }, [checkpoints])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(notesStorageKey)
    if (stored) {
      setNotesDraft(stored)
    } else {
      setNotesDraft('')
    }
  }, [notesStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(notesStorageKey, notesDraft)
  }, [notesDraft, notesStorageKey])

  const orderedCheckpoints = useMemo(
    () => [...checkpoints].sort((a, b) => a.timeInSeconds - b.timeInSeconds),
    [checkpoints],
  )

  const activeCheckpoint = useMemo(
    () => orderedCheckpoints.find((checkpoint) => checkpoint.id === activeCheckpointId) ?? null,
    [orderedCheckpoints, activeCheckpointId],
  )

  const onEnd = useCallback(async () => {
    try {
      if (!completeOnEnd) return

      await axios.put(`/api/courses/${courseId}/chapters/${chapterId}/progress`, {
        isCompleted: true,
      })

      if (!nextChapterId) {
        confetti.onOpen()
      }

      toast.success('Progress updated')
      router.refresh()

      if (nextChapterId) {
        router.push(`/courses/${courseId}/chapters/${nextChapterId}`)
      }
    } catch {
      toast.error('Something went wrong')
    }
  }, [chapterId, completeOnEnd, confetti, courseId, nextChapterId, router])

  const handleProgress = useCallback(
    (state: ProgressState) => {
      if (isLocked || !videoUrl) return
      if (activeCheckpoint) return

      const nextCheckpoint = orderedCheckpoints.find(
        (checkpoint) => !seenCheckpointIds.has(checkpoint.id) && state.playedSeconds >= checkpoint.timeInSeconds,
      )

      if (nextCheckpoint) {
        setActiveCheckpointId(nextCheckpoint.id)
        setIsPlaying(false)
      }
    },
    [activeCheckpoint, orderedCheckpoints, seenCheckpointIds, isLocked, videoUrl],
  )

  const markCheckpointAsSeen = useCallback((checkpointId: string | null) => {
    if (!checkpointId) return
    setSeenCheckpointIds((previous) => {
      const next = new Set(previous)
      next.add(checkpointId)
      return next
    })
  }, [])

  const handleResume = () => {
    markCheckpointAsSeen(activeCheckpointId)
    setActiveCheckpointId(null)
    setIsPlaying(true)
  }

  const handleOpenLink = (href: string | null) => {
    if (!href) return
    try {
      window.open(href, '_blank', 'noopener,noreferrer')
    } catch {
      // Ignore window open errors (popup blockers)
    }
  }

  const playerShouldPlay = !isLocked && isPlaying && !activeCheckpoint
  const actionUrl = activeCheckpoint ? buildCheckpointUrl(courseId, activeCheckpoint) : null
  const actionType = activeCheckpoint?.action?.type ?? 'MESSAGE'
  const actionLabel =
    activeCheckpoint?.action?.type === 'MESSAGE'
      ? activeCheckpoint.action.ctaLabel?.trim() || 'Continua'
      : activeCheckpoint?.action?.type === 'QUIZ'
        ? 'Apri quiz'
        : activeCheckpoint?.action?.type === 'SCENARIO'
          ? 'Apri Decision Lab'
          : activeCheckpoint?.action?.type === 'FLASHCARDS'
            ? 'Apri flashcard'
            : 'Continua'

  return (
    <div className="relative aspect-video">
      {!isReady && !isLocked ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/80">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      ) : null}

      {isLocked ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-y-2 rounded-xl bg-black/80 text-white">
          <Lock className="h-8 w-8" />
          <p className="text-sm">This chapter is locked</p>
        </div>
      ) : null}

      {!videoUrl && !isLocked ? (
        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/30 bg-white/40 text-sm text-muted-foreground backdrop-blur-md supports-[backdrop-filter]:bg-white/30">
          Lesson video will appear here once uploaded.
        </div>
      ) : null}

      {videoUrl && !isLocked ? (
        <ReactPlayer
          url={videoUrl}
          width="100%"
          height="100%"
          controls
          playing={playerShouldPlay}
          onReady={() => setIsReady(true)}
          onPlay={() => {
            setIsPlaying(true)
          }}
          onPause={() => {
            setIsPlaying(false)
            setIsNotesOpen(true)
          }}
          onEnded={onEnd}
          onProgress={handleProgress}
          progressInterval={750}
          config={{ file: { attributes: { controlsList: 'nodownload', playsInline: true, title } } }}
          style={{ borderRadius: '0.75rem', overflow: 'hidden' }}
        />
      ) : null}

     {activeCheckpoint ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/80 p-6 text-white">
          <div className="max-w-lg space-y-5 text-center">
            <div className="flex justify-center">
              {actionType === 'MESSAGE' ? (
                <MessageCircle className="h-8 w-8 text-white/80" />
              ) : (
                <Sparkles className="h-8 w-8 text-white/80" />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{activeCheckpoint.title}</h3>
              {activeCheckpoint.description ? (
                <p className="text-sm text-white/80">{activeCheckpoint.description}</p>
              ) : null}
            </div>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              {actionUrl && actionType !== 'MESSAGE' ? (
                <Button onClick={() => handleOpenLink(actionUrl)} className="w-full sm:w-auto">
                  {actionLabel}
                </Button>
              ) : null}
              {actionType === 'MESSAGE' ? (
                <Button
                  onClick={() => {
                    if (actionUrl) {
                      handleOpenLink(actionUrl)
                    }
                    handleResume()
                  }}
                  className="w-full sm:w-auto"
                >
                  {actionLabel}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleResume} className="w-full sm:w-auto">
                  Riprendi video
                </Button>
              )}
            </div>
            {actionType !== 'MESSAGE' ? (
              <p className="text-xs text-white/60">
                Il contenuto si apre in una nuova scheda. Torna qui quando hai terminato per continuare il video.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!activeCheckpoint && !isLocked ? (
        <div className="absolute inset-y-0 right-0 z-10 flex flex-col items-end justify-start p-4">
          <Button
            size="icon"
            variant={isNotesOpen ? 'secondary' : 'outline'}
            className="mb-2 h-9 w-9 rounded-full bg-white/80 text-slate-900 shadow"
            onClick={() => setIsNotesOpen((prev) => !prev)}
          >
            {isNotesOpen ? <X className="h-4 w-4" /> : <NotebookPen className="h-4 w-4" />}
          </Button>
          {isNotesOpen ? (
            <div className="w-60 max-w-full rounded-xl bg-white/95 p-3 text-slate-900 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <NotebookPen className="h-4 w-4" />
                  Blocco note
                </div>
                <span className="text-[10px] uppercase text-muted-foreground">solo per te</span>
              </div>
              <Textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                placeholder="Annota idee, domande o insight mentre guardi il video…"
                className="min-h-[140px] resize-none text-sm"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">Le note sono salvate nel tuo browser.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
