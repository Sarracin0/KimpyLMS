'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import axios from 'axios'
import { Loader2, MessageSquare, ShieldCheck, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ChapterCommentItem, ChapterCommentVisibilityOption } from './player-types'

type PlayerCommentsPanelProps = {
  courseId: string
  chapterId: string
  currentSecond: number
  isOpen: boolean
  onClose: () => void
}

const VISIBILITY_OPTIONS: Array<{
  value: ChapterCommentVisibilityOption
  label: string
  icon: ReactNode
  description: string
}> = [
  {
    value: 'PRIVATE',
    label: 'Solo per me',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    description: 'Annotazione personale salvata per te',
  },
  {
    value: 'PUBLIC',
    label: 'Visibile al team',
    icon: <Users className="h-3.5 w-3.5" />,
    description: 'Condivisa con i colleghi iscritti al corso',
  },
  {
    value: 'HR_ONLY',
    label: 'Invia a HR',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    description: 'Segnalazione riservata per HR',
  },
]

const MAX_COMMENT_LENGTH = 600

function formatSecond(second: number | null) {
  if (second === null || second < 0 || !Number.isFinite(second)) return null
  const minutes = Math.floor(second / 60)
  const seconds = Math.floor(second % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const PlayerCommentsPanel = ({ courseId, chapterId, currentSecond, isOpen, onClose }: PlayerCommentsPanelProps) => {
  const [comments, setComments] = useState<ChapterCommentItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const [draft, setDraft] = useState('')
  const [visibility, setVisibility] = useState<ChapterCommentVisibilityOption>('PRIVATE')

  useEffect(() => {
    if (!isOpen || hasLoaded) return

    const loadComments = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await axios.get(`/api/courses/${courseId}/chapters/${chapterId}/comments`)
        const fetched = Array.isArray(data?.comments) ? (data.comments as ChapterCommentItem[]) : []
        setComments(fetched)
        setHasLoaded(true)
      } catch {
        setError('Impossibile caricare i commenti. Riprova tra poco.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadComments()
  }, [isOpen, hasLoaded, courseId, chapterId])

  useEffect(() => {
    if (!isOpen) {
      setError(null)
    }
  }, [isOpen])

  const filteredComments = useMemo(() => {
    return [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [comments])

  const handleSubmit = async () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) return

    setIsSubmitting(true)
    setError(null)

    const optimistic: ChapterCommentItem = {
      id: `temp-${Date.now()}`,
      content: trimmed,
      visibility,
      playbackSecond: currentSecond,
      createdAt: new Date().toISOString(),
      authorId: 'me',
      isMine: true,
    }

    setComments((prev) => [...prev, optimistic])
    setDraft('')

    try {
      const { data } = await axios.post(`/api/courses/${courseId}/chapters/${chapterId}/comments`, {
        content: trimmed,
        visibility,
        playbackSecond: currentSecond,
      })

      const saved = data?.comment as ChapterCommentItem | undefined
      if (saved) {
        setComments((prev) => prev.map((item) => (item.id === optimistic.id ? saved : item)))
      } else {
        setComments((prev) => prev.filter((item) => item.id !== optimistic.id))
      }
    } catch {
      setComments((prev) => prev.filter((item) => item.id !== optimistic.id))
      setError('Non siamo riusciti a salvare il commento. Riprova.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div
      className={`pointer-events-auto h-full w-full max-w-md border-l border-white/20 bg-white/95 p-4 text-slate-900 shadow-lg transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Appunti & segnalazioni</p>
            <p className="text-xs text-muted-foreground">Scegli chi può vedere questo commento.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-muted-foreground">
          Chiudi
        </Button>
      </div>

      <div className="mb-3 space-y-2 text-xs text-muted-foreground">
        <p>Stai commentando il secondo {formatSecond(currentSecond ?? null) ?? '—'} del video.</p>
        <p className="italic">Suggerimento: usa ⌘+Invio per salvare al volo.</p>
      </div>

      <div className="mb-4 space-y-2">
        <Textarea
          placeholder="Scrivi un insight o segnala un punto critico…"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_COMMENT_LENGTH))}
          onKeyDown={handleKeyDown}
          rows={3}
          className="resize-none text-sm"
          disabled={!isOpen}
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{draft.trim().length}/{MAX_COMMENT_LENGTH}</span>
          <div className="flex items-center gap-2">
            <Select value={visibility} onValueChange={(value: ChapterCommentVisibilityOption) => setVisibility(value)}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="flex items-center gap-1 font-medium">
                        <span className="text-muted-foreground">{option.icon}</span>
                        {option.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={isSubmitting || draft.trim().length === 0} onClick={() => void handleSubmit()}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salva
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="mb-3 text-xs text-red-500">{error}</p> : null}

      <div className="flex-1 overflow-y-auto rounded-lg border border-white/40 bg-white/80 p-3 text-sm">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carico commenti…
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
            Nessun commento ancora. Aggiungine uno per iniziare la discussione.
          </div>
        ) : (
          <ul className="space-y-3 text-sm">
            {filteredComments.map((comment) => {
              const badgeLabel = VISIBILITY_OPTIONS.find((option) => option.value === comment.visibility)?.label ?? comment.visibility
              const badgeClass = cn(
                'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600',
                comment.visibility === 'PUBLIC' && 'bg-emerald-50 text-emerald-700',
                comment.visibility === 'HR_ONLY' && 'bg-amber-50 text-amber-800',
              )
              return (
                <li key={comment.id} className="rounded-xl border border-white/40 bg-white/90 p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className={badgeClass}>{badgeLabel}</span>
                    <span>{formatSecond(comment.playbackSecond)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{comment.content}</p>
                  <div className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {comment.isMine ? 'Tu' : 'Collega'} · {new Date(comment.createdAt).toLocaleDateString()}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
