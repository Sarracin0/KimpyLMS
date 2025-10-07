'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Clock, Layers, ListChecks, MessageCircle, Sparkles, Trash2, PencilLine, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

import type { LessonBlock, Lesson } from './module-accordion'
import type { VideoCheckpoint } from '@/types/video'
import { serializeVideoCheckpoints } from '@/lib/video/checkpoints'

const formatSeconds = (seconds: number) => {
  const total = Math.max(0, Number.isFinite(seconds) ? Math.round(seconds) : 0)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10)

type ActivityOption =
  | {
      id: string
      type: 'QUIZ'
      label: string
    }
  | {
      id: string
      type: 'SCENARIO'
      label: string
    }
  | {
      id: string
      type: 'ARENA'
      label: string
    }
  | {
      id: string
      type: 'FLASHCARDS'
      label: string
      deckId: string
    }

type EditorMode = 'create' | 'edit'

type VideoCheckpointFormState = {
  id: string
  timeInSeconds: number
  title: string
  description: string
  actionType: 'MESSAGE' | 'QUIZ' | 'SCENARIO' | 'ARENA' | 'FLASHCARDS'
  quizBlockId: string
  scenarioBlockId: string
  arenaBlockId: string
  flashcardDeckId: string
  messageCtaLabel: string
  messageCtaUrl: string
}

const createEmptyFormState = (timeInSeconds = 30): VideoCheckpointFormState => ({
  id: generateId(),
  timeInSeconds,
  title: 'Interruzione',
  description: '',
  actionType: 'MESSAGE',
  quizBlockId: '',
  scenarioBlockId: '',
  arenaBlockId: '',
  flashcardDeckId: '',
  messageCtaLabel: 'Continua',
  messageCtaUrl: '',
})

type VideoCheckpointsEditorProps = {
  courseId: string
  moduleId: string
  lesson: Lesson
  block: LessonBlock
  onReplaceBlock: (moduleId: string, lessonId: string, blockId: string, block: LessonBlock) => void
}

export const VideoCheckpointsEditor = ({ courseId, moduleId, lesson, block, onReplaceBlock }: VideoCheckpointsEditorProps) => {
  const [checkpoints, setCheckpoints] = useState<VideoCheckpoint[]>(block.videoCheckpoints ?? [])
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('create')
  const [formState, setFormState] = useState<VideoCheckpointFormState>(() => createEmptyFormState())

  useEffect(() => {
    setCheckpoints(block.videoCheckpoints ?? [])
  }, [block.videoCheckpoints])

  const activityOptions = useMemo<ActivityOption[]>(
    () =>
      lesson.blocks
        .filter((lessonBlock) => lessonBlock.id !== block.id)
        .flatMap<ActivityOption>((lessonBlock) => {
          if (lessonBlock.type === 'QUIZ') {
            return [{ id: lessonBlock.id, type: 'QUIZ', label: lessonBlock.title || 'Quiz' }]
          }
          if (lessonBlock.type === 'GAMIFICATION' && lessonBlock.gamification) {
            if (lessonBlock.gamification.contentType === 'QUIZ') {
              return [{ id: lessonBlock.id, type: 'QUIZ', label: lessonBlock.title || 'Quiz gamificato' }]
            }
            if (lessonBlock.gamification.contentType === 'SCENARIO') {
              return [{ id: lessonBlock.id, type: 'SCENARIO', label: lessonBlock.title || 'Decision Lab' }]
            }
            if (lessonBlock.gamification.contentType === 'ARENA') {
              return [{ id: lessonBlock.id, type: 'ARENA', label: lessonBlock.title || 'Practice Arena' }]
            }
            if (
              lessonBlock.gamification.contentType === 'FLASHCARDS' &&
              lessonBlock.gamification.flashcardDeck?.id
            ) {
              return [
                {
                  id: lessonBlock.id,
                  type: 'FLASHCARDS',
                  label: lessonBlock.gamification.flashcardDeck.title || 'Flashcard deck',
                  deckId: lessonBlock.gamification.flashcardDeck.id,
                },
              ]
            }
          }
          return []
        }),
    [lesson.blocks, block.id],
  )

  const quizList = activityOptions.filter((option) => option.type === 'QUIZ')
  const scenarioList = activityOptions.filter((option) => option.type === 'SCENARIO')
  const arenaList = activityOptions.filter((option) => option.type === 'ARENA')
  const flashcardList = activityOptions.filter(
    (option): option is Extract<ActivityOption, { type: 'FLASHCARDS' }> => option.type === 'FLASHCARDS',
  )

  const resetEditor = () => {
    setFormState(createEmptyFormState())
    setEditorMode('create')
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    resetEditor()
  }

  const openCreateDialog = () => {
    setEditorMode('create')
    setFormState(createEmptyFormState())
    setIsDialogOpen(true)
  }

  const openEditDialog = (checkpoint: VideoCheckpoint) => {
    const form: VideoCheckpointFormState = {
      id: checkpoint.id,
      timeInSeconds: checkpoint.timeInSeconds,
      title: checkpoint.title,
      description: checkpoint.description ?? '',
      actionType: checkpoint.action?.type ?? 'MESSAGE',
      quizBlockId: checkpoint.action?.type === 'QUIZ' ? checkpoint.action.blockId : '',
      scenarioBlockId: checkpoint.action?.type === 'SCENARIO' ? checkpoint.action.blockId : '',
      arenaBlockId: checkpoint.action?.type === 'ARENA' ? checkpoint.action.blockId : '',
      flashcardDeckId: checkpoint.action?.type === 'FLASHCARDS' ? checkpoint.action.deckId : '',
      messageCtaLabel: checkpoint.action?.type === 'MESSAGE' ? checkpoint.action.ctaLabel ?? '' : 'Continua',
      messageCtaUrl: checkpoint.action?.type === 'MESSAGE' ? checkpoint.action.ctaUrl ?? '' : '',
    }
    setEditorMode('edit')
    setFormState(form)
    setIsDialogOpen(true)
  }

  const handleDelete = async (checkpointId: string) => {
    const nextCheckpoints = checkpoints.filter((item) => item.id !== checkpointId)
    await persist(nextCheckpoints)
  }

  const persist = async (nextCheckpoints: VideoCheckpoint[]) => {
    setIsSaving(true)
    try {
      const payload = serializeVideoCheckpoints(nextCheckpoints)
      await axios.patch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}/blocks/${block.id}`,
        {
          videoCheckpoints: payload,
        },
      )
      const updatedBlock: LessonBlock = {
        ...block,
        videoCheckpoints: payload,
      }
      setCheckpoints(payload)
      onReplaceBlock(moduleId, lesson.id, block.id, updatedBlock)
      toast.success('Interruzioni salvate')
      closeDialog()
    } catch {
      toast.error('Impossibile salvare le interruzioni video')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    const timeValue = Number.isFinite(formState.timeInSeconds)
      ? Math.max(0, Math.round(formState.timeInSeconds))
      : Math.max(0, Math.round(Number(formState.timeInSeconds)))

    if (!Number.isFinite(timeValue)) {
      toast.error('Inserisci un timecode valido (secondi)')
      return
    }

    if (!formState.title.trim()) {
      toast.error('Aggiungi un titolo per l\'interruzione')
      return
    }

    let action: VideoCheckpoint['action'] = null

    if (formState.actionType === 'MESSAGE') {
      action = {
        type: 'MESSAGE',
        ctaLabel: formState.messageCtaLabel.trim() || 'Continua',
        ctaUrl: formState.messageCtaUrl.trim() || null,
      }
    }

    if (formState.actionType === 'QUIZ') {
      if (!formState.quizBlockId) {
        toast.error('Seleziona un quiz da collegare')
        return
      }
      action = {
        type: 'QUIZ',
        blockId: formState.quizBlockId,
      }
    }

    if (formState.actionType === 'SCENARIO') {
      if (!formState.scenarioBlockId) {
        toast.error('Collega un Decision Lab esistente')
        return
      }
      action = {
        type: 'SCENARIO',
        blockId: formState.scenarioBlockId,
      }
    }

    if (formState.actionType === 'ARENA') {
      if (!formState.arenaBlockId) {
        toast.error('Collega una Practice Arena esistente')
        return
      }
      action = {
        type: 'ARENA',
        blockId: formState.arenaBlockId,
      }
    }

    if (formState.actionType === 'FLASHCARDS') {
      if (!formState.flashcardDeckId) {
        toast.error('Seleziona un deck di flashcard')
        return
      }
      action = {
        type: 'FLASHCARDS',
        deckId: formState.flashcardDeckId,
      }
    }

    const checkpoint: VideoCheckpoint = {
      id: editorMode === 'edit' ? formState.id : generateId(),
      timeInSeconds: timeValue,
      title: formState.title.trim(),
      description: formState.description.trim() || null,
      action,
    }

    const nextCheckpoints = editorMode === 'edit'
      ? checkpoints.map((item) => (item.id === checkpoint.id ? checkpoint : item))
      : [...checkpoints, checkpoint]

    await persist(nextCheckpoints)
  }

  const renderActionBadge = (checkpoint: VideoCheckpoint) => {
    switch (checkpoint.action?.type) {
      case 'QUIZ':
        return (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Quiz
          </Badge>
        )
      case 'SCENARIO':
        return (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Decision Lab
          </Badge>
        )
      case 'ARENA':
        return (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Practice Arena
          </Badge>
        )
      case 'FLASHCARDS':
        return (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Flashcards
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            Messaggio
          </Badge>
        )
    }
  }

  return (
    <Card className="border-dashed border-border/60 bg-background/70">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Interruzioni video & gamification</p>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Aggiungi
          </Button>
        </div>

        {checkpoints.length === 0 ? (
          <div className="rounded-md border border-border/40 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
            Nessuna interruzione ancora. Aggiungi un checkpoint per fermare il video e lanciare gamification.
          </div>
        ) : (
          <div className="space-y-3">
            {checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.id}
                className="flex items-start justify-between rounded-md border border-border/40 bg-card/80 p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary">{formatSeconds(checkpoint.timeInSeconds)}</Badge>
                    {renderActionBadge(checkpoint)}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{checkpoint.title}</p>
                  {checkpoint.description ? (
                    <p className="text-xs text-muted-foreground">{checkpoint.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => openEditDialog(checkpoint)}>
                    <PencilLine className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(checkpoint.id)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? openCreateDialog() : closeDialog())}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editorMode === 'edit' ? 'Modifica interruzione' : 'Nuova interruzione'}</DialogTitle>
              <DialogDescription>
                Gestisci il timecode in cui fermare il video e scegli la gamification da lanciare.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Label htmlFor="checkpoint-time">Timecode (sec)</Label>
                  <Input
                    id="checkpoint-time"
                    type="number"
                    min={0}
                    value={formState.timeInSeconds}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, timeInSeconds: Number(event.target.value) }))
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="checkpoint-title">Titolo</Label>
                  <Input
                    id="checkpoint-title"
                    value={formState.title}
                    onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="checkpoint-description">Descrizione</Label>
                <Textarea
                  id="checkpoint-description"
                  value={formState.description}
                  onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Spiega al learner cosa deve fare prima di proseguire."
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo di interruzione</Label>
                <Select
                  value={formState.actionType}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      actionType: value as VideoCheckpointFormState['actionType'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MESSAGE">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-3.5 w-3.5" /> Messaggio informativo
                      </div>
                    </SelectItem>
                    <SelectItem value="QUIZ">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-3.5 w-3.5" /> Quiz esistente
                      </div>
                    </SelectItem>
                    <SelectItem value="SCENARIO">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5" /> Decision Lab
                      </div>
                    </SelectItem>
                    <SelectItem value="ARENA">
                      <div className="flex items-center gap-2">
                        <PencilLine className="h-3.5 w-3.5" /> Practice Arena
                      </div>
                    </SelectItem>
                    <SelectItem value="FLASHCARDS">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5" /> Flashcard deck
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formState.actionType === 'MESSAGE' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Label bottone</Label>
                    <Input
                      value={formState.messageCtaLabel}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, messageCtaLabel: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>URL (opzionale)</Label>
                    <Input
                      value={formState.messageCtaUrl}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, messageCtaUrl: event.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>
              ) : null}

              {formState.actionType === 'QUIZ' ? (
                <div className="space-y-2">
                  <Label>Quiz collegato</Label>
                  {quizList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nessun quiz pubblicato nella lezione. Aggiungi un blocco Quiz nel curriculum per sbloccare questa opzione.
                    </p>
                  ) : (
                    <Select
                      value={formState.quizBlockId}
                      onValueChange={(value) => setFormState((prev) => ({ ...prev, quizBlockId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un quiz" />
                      </SelectTrigger>
                      <SelectContent>
                        {quizList.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}

              {formState.actionType === 'SCENARIO' ? (
                <div className="space-y-2">
                  <Label>Decision Lab</Label>
                  {scenarioList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nessun Decision Lab disponibile. Generane uno dal blocco Gamification per collegarlo al video.
                    </p>
                  ) : (
                    <Select
                      value={formState.scenarioBlockId}
                      onValueChange={(value) => setFormState((prev) => ({ ...prev, scenarioBlockId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un Decision Lab" />
                      </SelectTrigger>
                      <SelectContent>
                        {scenarioList.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}

              {formState.actionType === 'ARENA' ? (
                <div className="space-y-2">
                  <Label>Practice Arena</Label>
                  {arenaList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nessuna Practice Arena disponibile. Generane una dal blocco Gamification per collegarla al video.
                    </p>
                  ) : (
                    <Select
                      value={formState.arenaBlockId}
                      onValueChange={(value) => setFormState((prev) => ({ ...prev, arenaBlockId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona una Practice Arena" />
                      </SelectTrigger>
                      <SelectContent>
                        {arenaList.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}

              {formState.actionType === 'FLASHCARDS' ? (
                <div className="space-y-2">
                  <Label>Deck di flashcard</Label>
                  {flashcardList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nessun deck di flashcard pronto. Genera un deck dal blocco Gamification per attivare questa interruzione.
                    </p>
                  ) : (
                    <Select
                      value={formState.flashcardDeckId}
                      onValueChange={(value) => setFormState((prev) => ({ ...prev, flashcardDeckId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un deck" />
                      </SelectTrigger>
                      <SelectContent>
                        {flashcardList.map((option) => (
                          <SelectItem key={option.deckId} value={option.deckId}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}

              <Separator />

              <div className="flex items-center gap-3 rounded-md bg-muted/20 p-3 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                I checkpoint vengono mostrati solo agli studenti che hanno accesso al video. Il player mette in pausa automaticamente.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
                Annulla
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? 'Salvataggio…' : editorMode === 'edit' ? 'Aggiorna' : 'Crea interruzione'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
