'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Loader2, MessageCircle, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CoachMessage } from './player-types'

type PlayerCoachPanelProps = {
  courseId: string
  chapterId: string
  currentSecond: number
  isOpen: boolean
  onClose: () => void
}

const MAX_CHARACTERS = 800

export const PlayerCoachPanel = ({ courseId, chapterId, currentSecond, isOpen, onClose }: PlayerCoachPanelProps) => {
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, isOpen])

  useEffect(() => {
    if (!isOpen) {
      setError(null)
    }
  }, [isOpen])

  const canSend = useMemo(() => {
    const trimmed = inputValue.trim()
    return trimmed.length > 0 && trimmed.length <= MAX_CHARACTERS && !isSending
  }, [inputValue, isSending])

  const handleSend = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || trimmed.length > MAX_CHARACTERS) return

    const tempId = `temp-${Date.now()}`
    const optimisticMessage: CoachMessage = {
      id: tempId,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
      pending: true,
    }

    setMessages((previous) => [...previous, optimisticMessage])
    setInputValue('')
    setIsSending(true)
    setError(null)

    try {
      const { data } = await axios.post(`/api/courses/${courseId}/chapters/${chapterId}/coach`, {
        message: trimmed,
        sessionId,
        playbackSecond: currentSecond,
      })

      const acknowledgedId = data?.acknowledged?.id as string | undefined
      const acknowledgedCreatedAt = data?.acknowledged?.createdAt as string | undefined
      const assistantMessage = data?.message as CoachMessage | undefined
      const resolvedSessionId = data?.sessionId as string | undefined

      setSessionId((prev) => resolvedSessionId ?? prev)

      setMessages((previous) => {
        const next = previous.map((message) => {
          if (message.id !== tempId) return message
          return {
            id: acknowledgedId ?? tempId,
            role: 'user',
            content: message.content,
            createdAt: acknowledgedCreatedAt ?? message.createdAt,
            pending: false,
          }
        })

        if (assistantMessage) {
          next.push({
            ...assistantMessage,
            role: 'assistant',
            pending: false,
          })
        }

        return next
      })
    } catch {
      setMessages((previous) => previous.filter((message) => message.id !== tempId))
      setError('Il Coach AI non è disponibile in questo momento. Riprova tra poco.')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) {
        void handleSend()
      }
    }
  }

  return (
    <div
      className={`pointer-events-auto h-full w-full max-w-md border-l border-white/20 bg-white/95 p-4 text-slate-900 shadow-lg transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Parla con il tuo Coach AI</p>
            <p className="text-xs text-muted-foreground">Chiedi chiarimenti sul punto corrente del video.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-muted-foreground">
          Chiudi
        </Button>
      </div>

      <div ref={scrollRef} className="mb-3 h-[220px] overflow-y-auto rounded-lg border border-white/40 bg-white/80 p-3 text-sm">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
            Pausa il video e chiedi al coach: ad esempio “Puoi riassumere questo passaggio?”
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-900'}`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  {message.pending ? <span className="mt-1 block text-[10px] uppercase opacity-70">Invio…</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="mb-2 text-xs text-red-500">{error}</p> : null}

      <div className="space-y-2">
        <Textarea
          placeholder="Scrivi una domanda o chiedi un esempio pratico…"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value.slice(0, MAX_CHARACTERS))}
          onKeyDown={handleKeyDown}
          rows={3}
          className="resize-none text-sm"
          disabled={!isOpen}
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{inputValue.trim().length}/{MAX_CHARACTERS}</span>
          <Button size="sm" onClick={() => void handleSend()} disabled={!canSend}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Invia
          </Button>
        </div>
      </div>
    </div>
  )
}
