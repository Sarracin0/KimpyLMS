'use client'

import dynamic from 'next/dynamic'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { toast } from 'react-hot-toast'
import {
  Loader2,
  Lock,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useConfettiStore } from '@/hooks/use-confetti'
import type { VideoCheckpoint } from '@/types/video'
import { PlayerCoachPanel } from './player-coach-panel'
import { PlayerCommentsPanel } from './player-comments-panel'
import type { HeatmapBucket, PlayerEventPayload } from './player-types'

type ProgressState = {
  playedSeconds: number
  played?: number
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })
type ReactPlayerInstance = import('react-player').ReactPlayer

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
    case 'ARENA':
      return `/courses/${courseId}/arenas/${checkpoint.action.blockId}`
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
  const [played, setPlayed] = useState(0)
  const [playedSeconds, setPlayedSeconds] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCoachOpen, setIsCoachOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [heatmapBuckets, setHeatmapBuckets] = useState<HeatmapBucket[]>([])
  const [hasLoadedHeatmap, setHasLoadedHeatmap] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<ReactPlayerInstance | null>(null)
  const pendingEventsRef = useRef<PlayerEventPayload[]>([])
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProgressRef = useRef(0)

  useEffect(() => {
    setIsPlaying(!isLocked)
  }, [isLocked])

  useEffect(() => {
    setIsReady(false)
    setActiveCheckpointId(null)
    setSeenCheckpointIds(new Set())
    setIsNotesOpen(false)
    setIsCoachOpen(false)
    setIsCommentsOpen(false)
    setHeatmapBuckets([])
    setHasLoadedHeatmap(false)
    setPlayed(0)
    setPlayedSeconds(0)
    setDuration(0)
    pendingEventsRef.current = []
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }
    lastProgressRef.current = 0
  }, [videoUrl, chapterId])

  useEffect(() => {
    setActiveCheckpointId(null)
    setSeenCheckpointIds(new Set())
  }, [checkpoints])

  useEffect(() => {
    if (!videoUrl || isLocked || hasLoadedHeatmap) return
    let cancelled = false

    const fetchHeatmap = async () => {
      try {
        const { data } = await axios.get(`/api/courses/${courseId}/chapters/${chapterId}/player-events`)
        if (!cancelled && Array.isArray(data?.buckets)) {
          setHeatmapBuckets(data.buckets as HeatmapBucket[])
        }
      } catch {
        // Swallow network errors: heatmap is a progressive enhancement
      } finally {
        if (!cancelled) {
          setHasLoadedHeatmap(true)
        }
      }
    }

    void fetchHeatmap()

    return () => {
      cancelled = true
    }
  }, [videoUrl, isLocked, courseId, chapterId, hasLoadedHeatmap])

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenDocument = document as FullscreenDocument
      const isFull = Boolean(fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement)
      setIsFullscreen(isFull)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const orderedCheckpoints = useMemo(
    () => [...checkpoints].sort((a, b) => a.timeInSeconds - b.timeInSeconds),
    [checkpoints],
  )

  const activeCheckpoint = useMemo(
    () => orderedCheckpoints.find((checkpoint) => checkpoint.id === activeCheckpointId) ?? null,
    [orderedCheckpoints, activeCheckpointId],
  )

  const timelineMarkers = useMemo(() => {
    if (!duration || duration <= 0) return []
    return orderedCheckpoints.map((checkpoint) => ({
      id: checkpoint.id,
      position: Math.min(Math.max(checkpoint.timeInSeconds / duration, 0), 1),
      type: checkpoint.action?.type ?? 'MESSAGE',
    }))
  }, [duration, orderedCheckpoints])

  const heatmapSegments = useMemo(() => {
    if (!duration || duration <= 0 || heatmapBuckets.length === 0) return []
    const maxCount = Math.max(...heatmapBuckets.map((bucket) => bucket.count))
    if (!maxCount || maxCount <= 0) return []
    const baseWidth = Math.max(0.6, (1 / duration) * 100)

    return heatmapBuckets
      .filter((bucket) => Number.isFinite(bucket.second))
      .map((bucket) => {
        const position = Math.min(Math.max(bucket.second / duration, 0), 1) * 100
        const width = Math.min(baseWidth, 12)
        const color = heatColor(bucket.count / maxCount)
        return {
          key: `${bucket.second}-${bucket.count}`,
          left: position,
          width,
          color,
        }
      })
  }, [duration, heatmapBuckets])

  const markerColor = (type: string) => {
    switch (type) {
      case 'QUIZ':
        return 'bg-emerald-400'
      case 'SCENARIO':
        return 'bg-sky-400'
      case 'ARENA':
        return 'bg-indigo-400'
      case 'FLASHCARDS':
        return 'bg-orange-400'
      default:
        return 'bg-white/80'
    }
  }

  const heatColor = (intensity: number) => {
    const clamped = Math.max(0, Math.min(intensity, 1))
    const start = [250, 204, 21]
    const end = [239, 68, 68]
    const r = Math.round(start[0] + (end[0] - start[0]) * clamped)
    const g = Math.round(start[1] + (end[1] - start[1]) * clamped)
    const b = Math.round(start[2] + (end[2] - start[2]) * clamped)
    const alpha = 0.25 + 0.35 * clamped
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
  }

  const flushEvents = useCallback(async () => {
    if (isLocked) {
      pendingEventsRef.current = []
      return
    }

    const batch = pendingEventsRef.current.splice(0, pendingEventsRef.current.length)
    if (batch.length === 0) return

    try {
      await axios.post(`/api/courses/${courseId}/chapters/${chapterId}/player-events`, {
        events: batch,
      })
    } catch {
      pendingEventsRef.current = [...batch, ...pendingEventsRef.current]
    }
  }, [chapterId, courseId, isLocked])

  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) return
    flushTimeoutRef.current = setTimeout(() => {
      flushTimeoutRef.current = null
      void flushEvents()
    }, 1200)
  }, [flushEvents])

  const queueEvent = useCallback(
    (event: PlayerEventPayload) => {
      if (isLocked) return
      pendingEventsRef.current = [...pendingEventsRef.current, event]

      if (pendingEventsRef.current.length >= 8) {
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current)
          flushTimeoutRef.current = null
        }
        void flushEvents()
        return
      }

      scheduleFlush()
    },
    [flushEvents, isLocked, scheduleFlush],
  )

  useEffect(() => () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }
    if (pendingEventsRef.current.length > 0) {
      void flushEvents()
    }
  }, [flushEvents])

  const toggleCoachPanel = () => {
    setIsCoachOpen((previous) => {
      const next = !previous
      if (next) {
        setIsCommentsOpen(false)
        setIsNotesOpen(false)
      }
      return next
    })
  }

  const toggleCommentsPanel = () => {
    setIsCommentsOpen((previous) => {
      const next = !previous
      if (next) {
        setIsCoachOpen(false)
        setIsNotesOpen(false)
      }
      return next
    })
  }

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

      if (typeof state.played === 'number') {
        setPlayed(state.played)
      }
      if (typeof state.playedSeconds === 'number') {
        setPlayedSeconds(state.playedSeconds)
        const delta = state.playedSeconds - lastProgressRef.current
        if (delta < -2) {
          queueEvent({
            type: 'REWATCH',
            playbackSecond: Math.max(0, Math.round(state.playedSeconds)),
          })
        }
        lastProgressRef.current = state.playedSeconds
      }

      const nextCheckpoint = orderedCheckpoints.find(
        (checkpoint) => !seenCheckpointIds.has(checkpoint.id) && state.playedSeconds >= checkpoint.timeInSeconds,
      )

      if (nextCheckpoint) {
        setActiveCheckpointId(nextCheckpoint.id)
        setIsPlaying(false)
      }
    },
    [activeCheckpoint, orderedCheckpoints, seenCheckpointIds, isLocked, videoUrl, queueEvent],
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

  const togglePlay = () => {
    if (activeCheckpoint) return
    setIsPlaying((previous) => {
      const next = !previous
      if (next) {
        setIsNotesOpen(false)
        setIsCoachOpen(false)
        setIsCommentsOpen(false)
      }
      if (!next) {
        setIsCoachOpen(true)
        setIsCommentsOpen(false)
        setIsNotesOpen(false)
      }
      return next
    })
  }

  const seekToClientPosition = (clientX: number, target: HTMLDivElement) => {
    const rect = target.getBoundingClientRect()
    const fraction = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    playerRef.current?.seekTo(fraction, 'fraction')
    setPlayed(fraction)
    setPlayedSeconds(fraction * duration)
    lastProgressRef.current = fraction * duration
  }

  const handleSeek = (event: ReactMouseEvent<HTMLDivElement>) => {
    seekToClientPosition(event.clientX, event.currentTarget)
  }

  const handleSeekTouch = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.preventDefault()
    const touch = event.touches[0]
    if (!touch) return
    seekToClientPosition(touch.clientX, event.currentTarget)
  }

  const toggleMute = () => {
    setIsMuted((prev) => !prev)
  }

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return
    const node = containerRef.current
    if (!node) return
    const exit = () => {
      const fullscreenDocument = document as FullscreenDocument
      if (fullscreenDocument.exitFullscreen) {
        void fullscreenDocument.exitFullscreen().catch(() => undefined)
      } else if (fullscreenDocument.webkitExitFullscreen) {
        void fullscreenDocument.webkitExitFullscreen()
      }
    }

    const enter = () => {
      const element = node as FullscreenElement
      if (element.requestFullscreen) {
        void element.requestFullscreen().catch(() => undefined)
      } else if (element.webkitRequestFullscreen) {
        void element.webkitRequestFullscreen()
      }
    }

    const fullscreenDocument = document as FullscreenDocument
    const isFull = Boolean(fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement)
    if (isFull) {
      exit()
    } else {
      enter()
    }
  }

  const handlePlayerRef = (instance: ReactPlayerInstance | null) => {
    playerRef.current = instance
  }

  const formatDuration = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '00:00'
    const minutes = Math.floor(value / 60)
    const seconds = Math.floor(value % 60)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
        : activeCheckpoint?.action?.type === 'ARENA'
          ? 'Apri Practice Arena'
          : activeCheckpoint?.action?.type === 'FLASHCARDS'
            ? 'Apri flashcard'
            : 'Continua'

  return (
    <div className="relative aspect-video" ref={containerRef}>
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
        <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
          <ReactPlayer
            url={videoUrl}
            width="100%"
            height="100%"
            playing={playerShouldPlay}
            controls={false}
            onReady={() => setIsReady(true)}
            onPlay={() => {
              setIsPlaying(true)
              setIsCoachOpen(false)
              setIsCommentsOpen(false)
              setIsNotesOpen(false)
              queueEvent({
                type: 'RESUME',
                playbackSecond: Math.max(0, Math.round(lastProgressRef.current)),
              })
            }}
            onPause={() => {
              setIsPlaying(false)
              setIsNotesOpen(false)
              setIsCoachOpen((previous) => {
                if (isCommentsOpen) {
                  return previous
                }
                return true
              })
              queueEvent({
                type: 'PAUSE',
                playbackSecond: Math.max(0, Math.round(lastProgressRef.current)),
              })
            }}
            onEnded={onEnd}
            onProgress={handleProgress}
            progressInterval={750}
            muted={isMuted}
            volume={isMuted ? 0 : 1}
            config={{
              file: { attributes: { controlsList: 'nodownload', playsInline: true, title } },
              youtube: {
                playerVars: {
                  controls: 0,
                  modestbranding: 1,
                  fs: 0,
                  iv_load_policy: 3,
                  rel: 0,
                },
              },
              vimeo: {
                playerOptions: {
                  controls: false,
                  title: false,
                  portrait: false,
                  byline: false,
                },
              },
            }}
            ref={handlePlayerRef}
            onDuration={(value) => setDuration(Number.isFinite(value) ? value : 0)}
          />

          {!activeCheckpoint ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
              <div className={`pointer-events-none absolute inset-0 transition-opacity ${isPlaying ? 'opacity-0' : 'opacity-100'} bg-black/60`} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              {!isPlaying ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-6 pt-6 text-sm text-white/85">
                  <span className="font-medium">Pausa attiva</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wider">Coach AI pronto a rispondere</span>
                </div>
              ) : null}
              <div className="pointer-events-auto relative z-10 flex w-full items-center gap-3 px-4 pb-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary/90"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white/85">{formatDuration(playedSeconds)}</span>
                    <div
                      className="relative h-2 flex-1 cursor-pointer rounded-full bg-white/25"
                      onMouseDown={handleSeek}
                      onClick={handleSeek}
                      onTouchStart={handleSeekTouch}
                    >
                      {heatmapSegments.length > 0 ? (
                        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                          {heatmapSegments.map((segment) => (
                            <span
                              key={segment.key}
                              className="absolute top-0 bottom-0 rounded-full"
                              style={{
                                left: `${segment.left}%`,
                                width: `${segment.width}%`,
                                background: segment.color,
                                transform: 'translateX(-50%)',
                                pointerEvents: 'none',
                              }}
                            />
                          ))}
                        </div>
                      ) : null}
                      <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${played * 100}%` }} />
                      {timelineMarkers.map((marker) => (
                        <span
                          key={marker.id}
                          className={`absolute top-0 bottom-0 w-[3px] -translate-x-1/2 rounded-full ${markerColor(marker.type)}`}
                          style={{ left: `${marker.position * 100}%` }}
                        />
                      ))}
                      <span
                        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border border-white/80 bg-primary shadow-sm"
                        style={{ left: `${played * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-white/85">{formatDuration(duration)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow transition hover:bg-white"
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow transition hover:bg-white"
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
              </div>
            </div>
          ) : null}
        </div>
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
        <div className="absolute inset-y-0 right-0 z-30 flex flex-col items-end gap-3 p-4">
          <div className="flex flex-col items-end gap-2">
            <Button
              size="icon"
              variant={isCoachOpen ? 'secondary' : 'outline'}
              className="h-9 w-9 rounded-full bg-white/85 text-slate-900 shadow"
              onClick={toggleCoachPanel}
              title="Apri Coach AI"
            >
              {isCoachOpen ? <Sparkles className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant={isCommentsOpen ? 'secondary' : 'outline'}
              className="h-9 w-9 rounded-full bg-white/85 text-slate-900 shadow"
              onClick={toggleCommentsPanel}
              title="Gestisci commenti"
            >
              {isCommentsOpen ? <MessageSquare className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant={isNotesOpen ? 'secondary' : 'outline'}
              className="h-9 w-9 rounded-full bg-white/80 text-slate-900 shadow"
              onClick={() => {
                setIsNotesOpen((prev) => !prev)
                setIsCoachOpen(false)
                setIsCommentsOpen(false)
              }}
              title="Blocco note personale"
            >
              {isNotesOpen ? <X className="h-4 w-4" /> : <NotebookPen className="h-4 w-4" />}
            </Button>
          </div>
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

      {!isLocked && videoUrl ? (
        <>
          <div className="pointer-events-none absolute inset-0 flex justify-end">
            <PlayerCoachPanel
              courseId={courseId}
              chapterId={chapterId}
              currentSecond={Math.max(0, Math.round(playedSeconds))}
              isOpen={isCoachOpen}
              onClose={() => setIsCoachOpen(false)}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 flex justify-end">
            <PlayerCommentsPanel
              courseId={courseId}
              chapterId={chapterId}
              currentSecond={Math.max(0, Math.round(playedSeconds))}
              isOpen={isCommentsOpen}
              onClose={() => setIsCommentsOpen(false)}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
