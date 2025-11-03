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
import { Loader2, RefreshCw, Sparkles, FileText, ExternalLink, ListChecks, GitBranch } from 'lucide-react'
import { logError } from '@/lib/logger'
import { extractScenarioPayload, summarizeScenario } from '@/lib/gamification/scenario'
import { extractArenaPayload, summarizeArena } from '@/lib/gamification/arena'

type CourseDocument = {
  id: string
  name: string
  url: string
  type: string | null
  scope: string
  chapterId: string | null
}

type StudioContentType = 'QUIZ' | 'FLASHCARDS' | 'SCENARIO' | 'ARENA'

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
  nodeCount: number
  focusCompetency: string
  riskProfile: 'prudente' | 'bilanciato' | 'audace'
  axisCount: number
  iterationGoal: string
  peerVisibility: 'private' | 'team' | 'company'
  contextLabel: string
  audience: string
  mustInclude: string
  notes?: string
}

const STATUS_COLORS: Record<GamificationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  GENERATING: 'bg-amber-100 text-amber-700',
  READY: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
}

const STATUS_LABELS: Record<GamificationStatus, string> = {
  DRAFT: 'Bozza',
  GENERATING: 'In generazione',
  READY: 'Pronto',
  FAILED: 'Errore',
}

const DEFAULT_SETTINGS: GenerationSettings = {
  questionCount: 6,
  difficulty: 'mixed',
  cardCount: 10,
  tone: 'neutral',
  nodeCount: 5,
  focusCompetency: '',
  riskProfile: 'bilanciato',
  axisCount: 3,
  iterationGoal: '',
  peerVisibility: 'team',
  contextLabel: '',
  audience: '',
  mustInclude: '',
  notes: '',
}

const STATUS_VALUES = ['DRAFT', 'GENERATING', 'READY', 'FAILED'] as const
const CONTENT_VALUES = ['QUIZ', 'FLASHCARDS', 'SCENARIO', 'ARENA'] as const

const ensureString = (value: unknown) => (typeof value === 'string' ? value : '')
const ensureNullableString = (value: unknown) => (typeof value === 'string' ? value : null)
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
  const [contentType, setContentType] = useState<StudioContentType>((block.gamification?.contentType as StudioContentType) ?? 'QUIZ')
  const [settings, setSettings] = useState<GenerationSettings>({ ...DEFAULT_SETTINGS })
  const [newDoc, setNewDoc] = useState<{ name: string; url: string }>({ name: '', url: '' })

  const status = block.gamification?.status ?? 'DRAFT'
  const flashcardDeck = block.gamification?.flashcardDeck
  const quizSummary = block.gamification?.quizSummary ?? block.quizSummary
  const quizManageHref = `/manage/courses/${courseId}/quizzes/${block.id}`
  const flashcardManageHref = flashcardDeck ? `/manage/courses/${courseId}/flashcards/${flashcardDeck.id}` : '#'
  const scenarioSummary = block.gamification?.scenarioSummary ?? null
  const scenarioPreviewHref = `/courses/${courseId}/scenarios/${block.id}`
  const arenaSummary = block.gamification?.arenaSummary ?? null
  const arenaPreviewHref = `/courses/${courseId}/arenas/${block.id}`
  const arenaConfig =
    block.gamification?.config && typeof block.gamification.config === 'object'
      ? (block.gamification.config as Record<string, unknown>)
      : null
  const arenaContextLabel = arenaConfig ? ensureString(arenaConfig['contextLabel']) : ''
  const arenaAudience = arenaConfig ? ensureString(arenaConfig['audience']) : ''
  const arenaMustInclude = arenaConfig ? ensureString(arenaConfig['mustInclude']) : ''

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoadingDocs(true)
      const response = await axios.get<CourseDocument[]>(`/api/courses/${courseId}/documents`)
      setDocuments(response.data)
      setSelectedDocs((prev) => prev.filter((id) => response.data.some((doc) => doc.id === id)))
    } catch (error) {
      toast.error('Impossibile caricare i documenti del corso')
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
    setContentType(block.gamification.contentType as StudioContentType)
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
      toast.error('Inserisci un URL valido')
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
      toast.success('Documento aggiunto')
    } catch (error) {
      toast.error('Impossibile aggiungere il documento')
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
            title: ensureString(flashcardsRaw.title) || block.gamification?.flashcardDeck?.title || 'Mazzo',
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

      if (process.env.NODE_ENV !== 'production') {
        console.groupCollapsed('[GamificationStudio] buildNextBlock');
        console.log('raw gamification payload', gamificationRaw);
        console.log('incoming block snapshot', block);
        console.groupEnd();
      }

      const scenarioPayload = extractScenarioPayload(gamificationRaw?.result ?? null)
      const mappedScenarioSummary = scenarioPayload ? summarizeScenario(scenarioPayload) : null

      const arenaPayload = extractArenaPayload(gamificationRaw?.result ?? null)
      const mappedArenaSummary = arenaPayload ? summarizeArena(arenaPayload) : null

      if (process.env.NODE_ENV !== 'production') {
        console.groupCollapsed('[GamificationStudio] buildNextBlock payloads');
        console.log('scenario payload', scenarioPayload);
        console.log('arena payload', arenaPayload);
        console.groupEnd();
      }

      const statusValue = ensureString(gamificationRaw?.status)
      const contentTypeValue = ensureString(gamificationRaw?.contentType)

      const normalizedStatus = STATUS_VALUES.includes(statusValue as (typeof STATUS_VALUES)[number])
        ? (statusValue as GamificationStatus)
        : block.gamification?.status ?? 'DRAFT'

      const normalizedContentType = CONTENT_VALUES.includes(contentTypeValue as StudioContentType)
        ? (contentTypeValue as StudioContentType)
        : ((block.gamification?.contentType as StudioContentType) ?? contentType)

      if (process.env.NODE_ENV !== 'production') {
        console.log('[GamificationStudio] normalized content type', normalizedContentType, 'from value', contentTypeValue, 'current state', contentType);
      }
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
              contentType: normalizedContentType as unknown as GamificationContentType,
              quizId:
                ensureNullableString(gamificationRaw.quizId) ??
                ensureNullableString(quizRaw?.id) ??
                block.gamification?.quizId ?? null,
              sourceAttachmentIds,
              config: normalizedConfig,
              flashcardDeck: mappedFlashcards,
              quizSummary: mappedQuizSummary ?? block.gamification?.quizSummary ?? null,
              scenarioSummary: mappedScenarioSummary ?? block.gamification?.scenarioSummary ?? null,
              arenaSummary: mappedArenaSummary ?? block.gamification?.arenaSummary ?? null,
            }
          : block.gamification ?? null,
        quizSummary: mappedQuizSummary ?? block.quizSummary ?? null,
      }
    },
    [block, contentType],
  )

  const handleGenerate = async () => {
    if (selectedDocs.length === 0) {
      toast.error('Seleziona almeno un documento')
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
        toast.error('Risposta inattesa dal generatore')
        return
      }

      const nextBlock = buildNextBlock(payload)
      const nextContentType = (nextBlock.gamification?.contentType as StudioContentType | undefined) ?? contentType
      if (process.env.NODE_ENV !== 'production') {
        console.groupCollapsed('[GamificationStudio] handleGenerate result');
        console.log('API payload block', payload);
        console.log('next block gamification', nextBlock.gamification);
        console.log('next content type', nextContentType);
        console.groupEnd();
      }
      setContentType(nextContentType)
      setSelectedDocs(nextBlock.gamification?.sourceAttachmentIds ?? [])
      onReplaceBlock(moduleId, lessonId, block.id, nextBlock)
      toast.success('Contenuto generato')
    } catch (error) {
      toast.error('Impossibile generare il contenuto')
      logError('GAMIFICATION_GENERATE_CLIENT', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const statusBadgeClass = STATUS_COLORS[status as GamificationStatus] ?? STATUS_COLORS.DRAFT

  const contentLabel =
    contentType === 'QUIZ'
      ? 'Quiz'
      : contentType === 'FLASHCARDS'
        ? 'Flashcard'
        : contentType === 'SCENARIO'
          ? 'Decision Lab'
          : 'Arena di pratica'
  const ResolvedContentIcon =
    contentType === 'QUIZ'
      ? ListChecks
      : contentType === 'FLASHCARDS'
        ? FileText
        : contentType === 'SCENARIO'
          ? GitBranch
          : Sparkles

  const canGenerate = !isGenerating && selectedDocs.length > 0

  const contextualSettings = useMemo(() => {
    if (contentType === 'QUIZ') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="question-count">Numero di domande</Label>
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
            <Label>Difficoltà</Label>
            <Select
              value={settings.difficulty}
              onValueChange={(value: GenerationSettings['difficulty']) => handleSettingChange('difficulty', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Misto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Principiante</SelectItem>
                <SelectItem value="intermediate">Intermedio</SelectItem>
                <SelectItem value="advanced">Avanzato</SelectItem>
                <SelectItem value="mixed">Misto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    }
    if (contentType === 'FLASHCARDS') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="card-count">Numero di carte</Label>
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
            <Label>Tono</Label>
            <Select value={settings.tone} onValueChange={(value: GenerationSettings['tone']) => handleSettingChange('tone', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Neutro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutro</SelectItem>
                <SelectItem value="motivational">Motivazionale</SelectItem>
                <SelectItem value="formal">Formale</SelectItem>
                <SelectItem value="playful">Giocoso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    }
    if (contentType === 'ARENA') {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="arena-context-label">Contesto prioritario</Label>
            <Input
              id="arena-context-label"
              placeholder="Es. Sprint di project management, onboarding retail, sicurezza in cantiere"
              value={settings.contextLabel}
              onChange={(event) => handleSettingChange('contextLabel', event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Titolo breve che indica l&apos;area di applicazione. Verrà usato dall&apos;AI per incorniciare scenario e brief.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="arena-audience">Pubblico target</Label>
            <Input
              id="arena-audience"
              placeholder="Es. Junior PM, Responsabili sicurezza, Team retail store"
              value={settings.audience}
              onChange={(event) => handleSettingChange('audience', event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="axis-count">Assi di valutazione</Label>
            <Input
              id="axis-count"
              type="number"
              min={2}
              max={5}
              value={settings.axisCount}
              onChange={(event) => handleSettingChange('axisCount', Number(event.target.value) || DEFAULT_SETTINGS.axisCount)}
            />
            <p className="text-[11px] text-muted-foreground">Suggerito: 3 assi per mantenere la valutazione chiara.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="peer-visibility">Endorsement dei pari</Label>
            <Select
              value={settings.peerVisibility}
              onValueChange={(value: GenerationSettings['peerVisibility']) =>
                handleSettingChange('peerVisibility', value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona visibilità" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Nessun endorsement</SelectItem>
                <SelectItem value="team">Endorsement visibili al team</SelectItem>
                <SelectItem value="company">Endorsement aperti a tutta l&apos;azienda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="iteration-goal">Focus di miglioramento tra tentativi</Label>
            <Textarea
              id="iteration-goal"
              rows={2}
              placeholder="Es. Spingere sul coinvolgimento del team e metriche di outcome"
              value={settings.iterationGoal}
              onChange={(event) => handleSettingChange('iterationGoal', event.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="arena-competency">Soft skill o competenza chiave</Label>
            <Input
              id="arena-competency"
              placeholder="Es. Comunicazione con il cliente, Risk management, Conformità safety"
              value={settings.focusCompetency}
              onChange={(event) => handleSettingChange('focusCompetency', event.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="arena-must-include">Elementi obbligatori nello scenario</Label>
            <Textarea
              id="arena-must-include"
              rows={2}
              placeholder="Elenca procedure, metriche o vincoli che devono comparire (es. checklist sicurezza, milestone PMI, KPI di progetto)."
              value={settings.mustInclude}
              onChange={(event) => handleSettingChange('mustInclude', event.target.value)}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="node-count">Punti decisionali</Label>
          <Input
            id="node-count"
            type="number"
            min={3}
            max={8}
            value={settings.nodeCount}
            onChange={(event) => handleSettingChange('nodeCount', Number(event.target.value) || DEFAULT_SETTINGS.nodeCount)}
          />
          <p className="text-[11px] text-muted-foreground">Intervallo consigliato: 4–6 nodi decisionali.</p>
        </div>
        <div className="space-y-1">
          <Label>Profilo di rischio</Label>
          <Select
            value={settings.riskProfile}
            onValueChange={(value) => handleSettingChange('riskProfile', value as GenerationSettings['riskProfile'])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Bilanciato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prudente">Prudente · privilegia la sicurezza</SelectItem>
              <SelectItem value="bilanciato">Bilanciato · mix rischio/beneficio</SelectItem>
              <SelectItem value="audace">Audace · scenario sfidante</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tono</Label>
          <Select value={settings.tone} onValueChange={(value: GenerationSettings['tone']) => handleSettingChange('tone', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Neutro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Neutro</SelectItem>
              <SelectItem value="motivational">Motivazionale</SelectItem>
              <SelectItem value="formal">Formale</SelectItem>
              <SelectItem value="playful">Giocoso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="focus-competency">Competenza chiave</Label>
          <Input
            id="focus-competency"
            placeholder="Es. gestione del cliente, leadership, compliance"
            value={settings.focusCompetency}
            onChange={(event) => handleSettingChange('focusCompetency', event.target.value)}
          />
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
              {STATUS_LABELS[status as GamificationStatus] ?? status}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <ResolvedContentIcon className="h-3 w-3" /> {contentLabel}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void loadDocuments()} disabled={isLoadingDocs}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoadingDocs ? 'animate-spin' : ''}`} />
            Aggiorna documenti
          </Button>
        </div>
        <CardTitle className="text-base font-semibold tracking-tight">Gamification Studio AI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {contentType === 'SCENARIO' ? (
          <div className="rounded-lg border border-[#5D62E1]/30 bg-[#5D62E1]/5 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-2 text-sm font-semibold text-[#3437a3]">Decision Lab – cosa succede per l&apos;HR</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                L&apos;AI crea una situazione ramificata di 4-6 punti decisionali con feedback immediato e punteggi su giudizio,
                rischio e competenze emerse.
              </li>
              <li>
                Ogni scelta alimenta analytics: punteggio medio, rischio aggregato, focus di competenza e riflessioni testuali
                vengono salvati in <code>ScenarioAttempt</code> e mostrati nella dashboard Gamification.
              </li>
              <li>
                Il learner vede un debrief finale con coaching points prima di inviare il percorso; il submit sblocca i punti solo
                al primo completamento per evitare farming.
              </li>
              <li>
                Puoi calibrare l&apos;esperienza regolando i controlli qui sotto (numero di nodi, profilo di rischio, competenza focus)
                e aggiungendo note HR per contestualizzare policy e tono.
              </li>
            </ul>
          </div>
        ) : contentType === 'ARENA' ? (
          <div className="rounded-lg border border-[#2F90B9]/30 bg-[#2F90B9]/5 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-2 text-sm font-semibold text-[#1b6584]">Arena di pratica – cosa ottieni</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                L&apos;AI propone uno scenario operativo post-capitolo e chiede ai learner un piano d&apos;azione sintetico da iterare.
              </li>
              <li>
                Il coaching automatico valuta il piano su 2-4 assi soft-skill (es. comunicazione, iniziativa, empatia) e genera
                feedback mirato, pronto per HR.
              </li>
              <li>
                Gli Insight Tokens vengono assegnati alla prima iterazione efficace e quando i peer rilasciano endorsement: la
                distribuzione è salvata in <code>ScenarioAttempt</code> (campo <code>attemptType=ARENA</code>).
              </li>
              <li>
                Puoi guidare il taglio dell&apos;esercizio impostando assi prioritari, focus di miglioramento e visibilità degli endorsement.
              </li>
            </ul>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
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
            <FileText className="mr-2 h-4 w-4" /> Flashcard
          </Button>
          <Button
            type="button"
            variant={contentType === 'SCENARIO' ? 'default' : 'outline'}
            className="justify-start"
            onClick={() => setContentType('SCENARIO')}
            disabled={isGenerating}
          >
            <GitBranch className="mr-2 h-4 w-4" /> Decision Lab
          </Button>
          <Button
            type="button"
            variant={contentType === 'ARENA' ? 'default' : 'outline'}
            className="justify-start"
            onClick={() => setContentType('ARENA')}
            disabled={isGenerating}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Arena di pratica
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Documenti di riferimento</span>
            <span className="text-xs text-muted-foreground">{selectedDocs.length} selezionati</span>
          </div>

          <div className="grid gap-2 max-h-48 overflow-y-auto rounded-md border border-border/40 bg-background/80 p-3 text-xs">
            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Caricamento documenti
              </div>
            ) : documents.length === 0 ? (
              <p className="text-muted-foreground">Nessun documento caricato. Aggiungine uno qui sotto.</p>
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
            <Label className="text-sm font-medium">Aggiungi rapidamente un documento esterno</Label>
            <Input
              placeholder="Nome del documento"
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
              Aggiungi documento
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Impostazioni di generazione</Label>
            <div className="rounded-md border border-border/40 bg-background/70 p-3 space-y-3 text-xs">
              <p className="text-muted-foreground">
                Configura come l&apos;assistente deve creare il contenuto. Le impostazioni si adattano al tipo di output scelto.
              </p>
              {contextualSettings}
              <div className="space-y-1">
                <Label htmlFor="tone-notes">Istruzioni aggiuntive</Label>
                <Textarea
                  id="tone-notes"
                  placeholder="Aggiungi contesto, linguaggio aziendale o linee guida di valutazione..."
                  className="h-20 text-xs"
                  value={settings.notes ?? ''}
                  onChange={(event) => setSettings((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        <Button type="button" onClick={handleGenerate} disabled={!canGenerate} className="w-full">
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Genera con l&apos;AI
        </Button>

        {status === 'FAILED' && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">
            L&apos;ultimo tentativo non è riuscito. Aggiorna documenti o impostazioni e riprova.
          </div>
        )}

        {status === 'READY' && contentType === 'QUIZ' && quizSummary && (
          <div className="rounded-lg border border-border/40 bg-background/70 p-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{quizSummary.title}</p>
                <p className="text-xs text-muted-foreground">
                  {quizSummary.questionCount} domande · {quizSummary.pointsReward} punti assegnati
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={quizManageHref}>
                  Gestisci quiz
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
                <p className="text-xs text-muted-foreground">{flashcardDeck.cardCount} carte generate</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={flashcardManageHref}>
                  Gestisci flashcard
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              {flashcardDeck.cards.slice(0, 3).map((card) => (
                <div key={card.id} className="rounded-md border border-border/30 bg-background/60 px-3 py-2">
                  <p className="text-[11px] font-semibold text-foreground">D: {card.front}</p>
                  <p className="text-[11px] text-muted-foreground">R: {card.back}</p>
                </div>
              ))}
              {flashcardDeck.cardCount > 3 && (
                <p className="text-[11px] text-muted-foreground">+ {flashcardDeck.cardCount - 3} carte aggiuntive</p>
              )}
            </div>
          </div>
        )}

        {status === 'READY' && contentType === 'SCENARIO' && scenarioSummary && (
          <div className="rounded-lg border border-border/40 bg-background/70 p-3 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground line-clamp-2">{scenarioSummary.intro}</p>
                <p className="text-xs text-muted-foreground">
                  {scenarioSummary.nodeCount} decision nodes
                  {typeof scenarioSummary.estimatedDurationMinutes === 'number'
                    ? ` · ~${scenarioSummary.estimatedDurationMinutes} min`
                    : ''}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={scenarioPreviewHref}>
                  Anteprima vista learner
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground">Obiettivi</p>
              <div className="space-y-1">
                {(scenarioSummary.objectives ?? []).slice(0, 3).map((objective, index) => (
                  <p key={`${objective}-${index}`} className="text-[11px] text-muted-foreground">
                    • {objective}
                  </p>
                ))}
                {scenarioSummary.objectives && scenarioSummary.objectives.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Gli obiettivi generati dall&apos;AI compariranno qui.</p>
                ) : null}
              </div>
              {scenarioSummary.objectives && scenarioSummary.objectives.length > 3 ? (
                <p className="text-[11px] text-muted-foreground">
                  + {scenarioSummary.objectives.length - 3} obiettivi formativi aggiuntivi
                </p>
              ) : null}
            </div>
          </div>
        )}

        {status === 'READY' && contentType === 'ARENA' && arenaSummary && (
          <div className="rounded-lg border border-border/40 bg-background/70 p-3 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground line-clamp-2">{arenaSummary.title}</p>
                <p className="text-xs text-muted-foreground">
                  {arenaSummary.axes} assi · ruolo learner: {arenaSummary.learnerRole}
                  {typeof arenaSummary.estimatedDurationMinutes === 'number'
                    ? ` · ~${arenaSummary.estimatedDurationMinutes} min`
                    : ''}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={arenaPreviewHref}>
                  Anteprima vista learner
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
            <Separator />
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold text-foreground">Obiettivi di apprendimento</p>
                <p className="text-[11px] text-muted-foreground">{arenaSummary.objectives} risultati chiave</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground">Focus del coach AI</p>
                <p className="text-[11px] text-muted-foreground">
                  Iterazioni tracciate e Insight Tokens assegnati in automatico.
                </p>
              </div>
            </div>
            {(arenaContextLabel || arenaAudience || arenaMustInclude) && (
              <>
                <Separator />
                <div className="space-y-2">
                  {arenaContextLabel ? (
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">Contesto dichiarato</p>
                      <p className="text-[11px] text-muted-foreground">{arenaContextLabel}</p>
                    </div>
                  ) : null}
                  {arenaAudience ? (
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">Pubblico target</p>
                      <p className="text-[11px] text-muted-foreground">{arenaAudience}</p>
                    </div>
                  ) : null}
                  {arenaMustInclude ? (
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">Vincoli o elementi obbligatori</p>
                      <p className="text-[11px] text-muted-foreground whitespace-pre-line">{arenaMustInclude}</p>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
