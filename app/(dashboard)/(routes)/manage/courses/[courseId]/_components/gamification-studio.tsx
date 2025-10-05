'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { LessonBlock } from './module-accordion'
import type { GamificationContentType, GamificationStatus } from '@prisma/client'
import { Loader2, RefreshCw, Sparkles, FileText, ExternalLink, ListChecks } from 'lucide-react'
import { logError } from '@/lib/logger'

import type { GamificationContentType, GamificationStatus } from '@prisma/client'

type CourseDocument = {
  id: string
  name: string
  url: string
  type: string | null
  scope: string
  chapterId: string | null
}

type GamificationStudioProps = {
  courseId: string
  moduleId: string
  lessonId: string
  block: LessonBlock
  onReplaceBlock: (moduleId: string, lessonId: string, blockId: string, block: LessonBlock) => void
}

type GenerationSettings = {
  questionCount: number
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'mixed'
  cardCount: number
  tone: 'neutral' | 'motivational' | 'formal' | 'playful'
  notes?: string
}

const STATUS_COLORS: Record<GamificationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  GENERATING: 'bg-amber-100 text-amber-700',
  READY: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
}

const DEFAULT_SETTINGS: GenerationSettings = {
  questionCount: 6,
  difficulty: 'mixed',
  cardCount: 10,
  tone: 'neutral',
  notes: '',
}

const STATUS_VALUES = ['DRAFT', 'GENERATING', 'READY', 'FAILED'] as const
const CONTENT_VALUES = ['QUIZ', 'FLASHCARDS'] as const

const ensureString = (value: unknown) => (typeof value === 'string' ? value : '')
const ensureNullableString = (value: unknown) => (typeof value === 'string' ? value : null)
const ensureBoolean = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback)
const ensureNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

export const GamificationStudio = ({ courseId, moduleId, lessonId, block, onReplaceBlock }: GamificationStudioProps) => {
  const [documents, setDocuments] = useState<CourseDocument[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [isSavingDoc, setIsSavingDoc] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<string[]>(block.gamification?.sourceAttachmentIds ?? [])
  const [contentType, setContentType] = useState<GamificationContentType>(block.gamification?.contentType ?? 'QUIZ')
  const [settings, setSettings] = useState<GenerationSettings>({ ...DEFAULT_SETTINGS })
  const [newDoc, setNewDoc] = useState<{ name: string; url: string }>({ name: '', url: '' })

  const status = block.gamification?.status ?? 'DRAFT'
  const flashcardDeck = block.gamification?.flashcardDeck
  const quizSummary = block.gamification?.quizSummary ?? block.quizSummary
  const quizManageHref = `/manage/courses/${courseId}/quizzes/${block.id}`
  const flashcardManageHref = flashcardDeck ? `/manage/courses/${courseId}/flashcards/${flashcardDeck.id}` : '#'

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoadingDocs(true)
      const response = await axios.get<CourseDocument[]>(`/api/courses/${courseId}/documents`)
      setDocuments(response.data)
      setSelectedDocs((prev) => prev.filter((id) => response.data.some((doc) => doc.id === id)))
    } catch (error) {
      toast.error('Unable to load course documents')
      logError('GAMIFICATION_DOCS_LOAD', error)
    } finally {
      setIsLoadingDocs(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  useEffect(() => {
    if (!block.gamification) return
    setContentType(block.gamification.contentType)
    setSelectedDocs(block.gamification.sourceAttachmentIds)
    if (block.gamification.config && typeof block.gamification.config === 'object') {
      setSettings((prev) => ({
        ...prev,
        ...(block.gamification.config as Partial<GenerationSettings>),
      }))
    }
  }, [block.gamification])

  const handleToggleDocument = (documentId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId],
    )
  }

  const handleAddDocument = async () => {
    if (!newDoc.url.trim()) {
      toast.error('Add a valid URL')
      return
    }

    try {
      setIsSavingDoc(true)
      const response = await axios.post(`/api/courses/${courseId}/documents`, {
        url: newDoc.url,
        name: newDoc.name || newDoc.url,
        type: 'link',
      })
      const created = response.data as CourseDocument
      setDocuments((prev) => [created, ...prev])
      setSelectedDocs((prev) => [...prev, created.id])
      setNewDoc({ name: '', url: '' })
      toast.success('Document added')
    } catch (error) {
      toast.error('Unable to add document')
      logError('GAMIFICATION_DOCS_CREATE', error)
    } finally {
      setIsSavingDoc(false)
    }
  }

  const handleSettingChange = <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const buildNextBlock = useCallback(
    (raw: Record<string, unknown>): LessonBlock => {
      const gamificationRaw = (raw.gamification as Record<string, unknown> | undefined) ?? null
      const quizRaw =
        (gamificationRaw?.quiz as Record<string, unknown> | undefined) ??
        (raw.quiz as Record<string, unknown> | undefined) ??
        null
      const flashcardsRaw = (gamificationRaw?.flashcardDeck as Record<string, unknown> | undefined) ?? null

      const flashcardCardsRaw = Array.isArray(flashcardsRaw?.cards)
        ? (flashcardsRaw?.cards as Record<string, unknown>[])
        : []

      const mappedFlashcards = flashcardsRaw
        ? {
            id: ensureString(flashcardsRaw.id) || block.gamification?.flashcardDeck?.id || generateId(),
            title: ensureString(flashcardsRaw.title) || block.gamification?.flashcardDeck?.title || 'Deck',
            description: ensureNullableString(flashcardsRaw.description) ?? block.gamification?.flashcardDeck?.description ?? null,
            cardCount: flashcardCardsRaw.length,
            cards: flashcardCardsRaw
              .slice()
              .sort((a, b) => ensureNumber(a?.position, 0) - ensureNumber(b?.position, 0))
              .map((card) => ({
                id: ensureString(card.id) || generateId(),
                front: ensureString(card.front),
                back: ensureString(card.back),
                points: ensureNumber(card.points, 0),
                position: ensureNumber(card.position, 0),
              })),
          }
        : null

      const questionArray = Array.isArray(quizRaw?.questions)
        ? (quizRaw?.questions as Record<string, unknown>[])
        : []

      const mappedQuizSummary = quizRaw
        ? {
            id: ensureString(quizRaw.id) || block.quizSummary?.id || block.gamification?.quizSummary?.id || '',
            title: ensureString(quizRaw.title) || block.quizSummary?.title || 'Quiz',
            questionCount: questionArray.length,
            pointsReward: ensureNumber(quizRaw.pointsReward, block.quizSummary?.pointsReward ?? 0),
          }
        : null

      const statusValue = ensureString(gamificationRaw?.status)
      const contentTypeValue = ensureString(gamificationRaw?.contentType)

      const normalizedStatus = STATUS_VALUES.includes(statusValue as (typeof STATUS_VALUES)[number])
        ? (statusValue as GamificationStatus)
        : block.gamification?.status ?? 'DRAFT'

      const normalizedContentType = CONTENT_VALUES.includes(contentTypeValue as (typeof CONTENT_VALUES)[number])
        ? (contentTypeValue as GamificationContentType)
        : block.gamification?.contentType ?? contentType

      const sourceAttachmentIds = Array.isArray(gamificationRaw?.sourceAttachmentIds)
        ? (gamificationRaw?.sourceAttachmentIds as unknown[]).filter((value): value is string => typeof value === 'string')
        : block.gamification?.sourceAttachmentIds ?? []

      const configValue = gamificationRaw?.config
      const normalizedConfig = typeof configValue === 'object' && configValue !== null ? (configValue as Record<string, unknown>) : block.gamification?.config ?? null

      return {
        ...block,
        title: ensureString(raw.title) || block.title,
        content: ensureNullableString(raw.content) ?? block.content,
        contentUrl: ensureNullableString(raw.contentUrl) ?? block.contentUrl,
        videoUrl: ensureNullableString(raw.videoUrl) ?? block.videoUrl,
        isPublished: typeof raw.isPublished === 'boolean' ? raw.isPublished : block.isPublished,
        gamification: gamificationRaw
          ? {
              id: ensureString(gamificationRaw.id) || block.gamification?.id || generateId(),
              status: normalizedStatus,
              contentType: normalizedContentType,
              quizId:
                ensureNullableString(gamificationRaw.quizId) ??
                ensureNullableString(quizRaw?.id) ??
                block.gamification?.quizId ?? null,
              sourceAttachmentIds,
              config: normalizedConfig,
              flashcardDeck: mappedFlashcards,
              quizSummary: mappedQuizSummary ?? block.gamification?.quizSummary ?? null,
            }
          : block.gamification ?? null,
        quizSummary: mappedQuizSummary ?? block.quizSummary ?? null,
      }
    },
    [block, contentType],
  )

  const handleGenerate = async () => {
    if (selectedDocs.length === 0) {
      toast.error('Select at least one document')
      return
    }

    try {
      setIsGenerating(true)
      const response = await axios.post(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/blocks/${block.id}/gamification`, {
        contentType,
        attachmentIds: selectedDocs,
        settings,
      })

      const payload = response.data?.block
      if (!payload) {
        toast.error('Unexpected response from generator')
        return
      }

      const nextBlock = buildNextBlock(payload)
      onReplaceBlock(moduleId, lessonId, block.id, nextBlock)
      toast.success('Content generated')
    } catch (error) {
      toast.error('Unable to generate content')
      logError('GAMIFICATION_GENERATE_CLIENT', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const statusBadgeClass = STATUS_COLORS[status as GamificationStatus] ?? STATUS_COLORS.DRAFT

  const canGenerate = !isGenerating && selectedDocs.length > 0

  const contextualSettings = useMemo(() => {
    if (contentType === 'QUIZ') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="question-count">Number of questions</Label>
            <Input
              id="question-count"
              type="number"
              min={3}
              max={20}
              value={settings.questionCount}
              onChange={(event) => handleSettingChange('questionCount', Number(event.target.value) || DEFAULT_SETTINGS.questionCount)}
            />
          </div>
          <div className="space-y-1">
            <Label>Difficulty</Label>
            <Select
              value={settings.difficulty}
              onValueChange={(value: GenerationSettings['difficulty']) => handleSettingChange('difficulty', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mixed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="card-count">Number of cards</Label>
          <Input
            id="card-count"
            type="number"
            min={4}
            max={30}
            value={settings.cardCount}
            onChange={(event) => handleSettingChange('cardCount', Number(event.target.value) || DEFAULT_SETTINGS.cardCount)}
          />
        </div>
        <div className="space-y-1">
          <Label>Tone</Label>
          <Select value={settings.tone} onValueChange={(value: GenerationSettings['tone']) => handleSettingChange('tone', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Neutral" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="motivational">Motivational</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="playful">Playful</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }, [contentType, settings])

  return (
    <Card className="border-dashed border-border/60 bg-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={statusBadgeClass}>
              {status.toLowerCase()}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> {contentType === 'QUIZ' ? 'Quiz' : 'Flashcards'}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void loadDocuments()} disabled={isLoadingDocs}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoadingDocs ? 'animate-spin' : ''}`} />
            Refresh docs
          </Button>
        </div>
        <CardTitle className="text-base font-semibold tracking-tight">AI Gamification Studio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Button
            type="button"
            variant={contentType === 'QUIZ' ? 'default' : 'outline'}
            className="justify-start"
            onClick={() => setContentType('QUIZ')}
            disabled={isGenerating}
          >
            <ListChecks className="mr-2 h-4 w-4" /> Quiz
          </Button>
          <Button
            type="button"
            variant={contentType === 'FLASHCARDS' ? 'default' : 'outline'}
            className="justify-start"
            onClick={() => setContentType('FLASHCARDS')}
            disabled={isGenerating}
          >
            <FileText className="mr-2 h-4 w-4" /> Flashcards
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Source documents</span>
            <span className="text-xs text-muted-foreground">{selectedDocs.length} selected</span>
          </div>

          <div className="grid gap-2 max-h-48 overflow-y-auto rounded-md border border-border/40 bg-background/80 p-3 text-xs">
            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading documents
              </div>
            ) : documents.length === 0 ? (
              <p className="text-muted-foreground">No documents uploaded yet. Add one below.</p>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocs.includes(doc.id)
                return (
                  <label
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-background px-3 py-2 hover:border-primary/60"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox checked={isSelected} onCheckedChange={() => handleToggleDocument(doc.id)} id={`doc-${doc.id}`} />
                      <div>
                        <p className="font-medium text-foreground">{doc.name}</p>
                        <p className="text-[11px] text-muted-foreground">{doc.scope.toLowerCase()} · {doc.type ?? 'file'}</p>
                      </div>
                    </div>
                    <Link href={doc.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </label>
                )
              })
            )}
          </div>

        </div>

        <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick add external document</Label>
            <Input
              placeholder="Document name"
              value={newDoc.name}
              onChange={(event) => setNewDoc((prev) => ({ ...prev, name: event.target.value }))}
              disabled={isSavingDoc}
            />
            <Input
              placeholder="https://"
              value={newDoc.url}
              onChange={(event) => setNewDoc((prev) => ({ ...prev, url: event.target.value }))}
              disabled={isSavingDoc}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAddDocument} disabled={isSavingDoc}>
              {isSavingDoc ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
              Add document
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Generation settings</Label>
            <div className="rounded-md border border-border/40 bg-background/70 p-3 space-y-3 text-xs">
              <p className="text-muted-foreground">
                Configure how the assistant should craft the content. Settings adapt to the selected output type.
              </p>
              {contextualSettings}
              <div className="space-y-1">
                <Label htmlFor="tone-notes">Additional instructions</Label>
                <Textarea
                  id="tone-notes"
                  placeholder="Add context, company jargon or scoring guidelines..."
                  className="h-20 text-xs"
                  value={settings.notes ?? ''}
                  onChange={(event) => setSettings((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        <Button type="button" onClick={handleGenerate} disabled={!canGenerate} className="w-full">
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Generate with AI
        </Button>

        {status === 'FAILED' && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">
            The last attempt failed. Update your documents or settings and try again.
          </div>
        )}

        {status === 'READY' && contentType === 'QUIZ' && quizSummary && (
          <div className="rounded-lg border border-border/40 bg-background/70 p-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{quizSummary.title}</p>
                <p className="text-xs text-muted-foreground">
                  {quizSummary.questionCount} questions · {quizSummary.pointsReward} pts reward
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={quizManageHref}>
                  Manage quiz
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {status === 'READY' && contentType === 'FLASHCARDS' && flashcardDeck && (
          <div className="rounded-lg border border-border/40 bg-background/70 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{flashcardDeck.title}</p>
                <p className="text-xs text-muted-foreground">{flashcardDeck.cardCount} cards generated</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={flashcardManageHref}>
                  Manage flashcards
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              {flashcardDeck.cards.slice(0, 3).map((card) => (
                <div key={card.id} className="rounded-md border border-border/30 bg-background/60 px-3 py-2">
                  <p className="text-[11px] font-semibold text-foreground">Q: {card.front}</p>
                  <p className="text-[11px] text-muted-foreground">A: {card.back}</p>
                </div>
              ))}
              {flashcardDeck.cardCount > 3 && (
                <p className="text-[11px] text-muted-foreground">+ {flashcardDeck.cardCount - 3} more cards</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
