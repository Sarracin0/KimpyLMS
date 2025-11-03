'use client'

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Award,
  Flag,
  Sparkles,
  Star,
  Trophy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Plus,
  Settings2,
} from 'lucide-react'

import type { Module } from './module-accordion'
import type { CourseAchievement } from './course-builder-wizard'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type AchievementTemplate = {
  id: string
  name: string
  description: string
  unlockType: CourseAchievement['unlockType']
  defaultPoints: number
  icon: string
  requiresModule?: boolean
  requiresLesson?: boolean
  requiresQuiz?: boolean
  requiresScenario?: boolean
  requiresArena?: boolean
  requiresDeck?: boolean
  defaultQuizSettings?: {
    requirePass?: boolean
    minScore?: number | null
  }
  defaultScenarioSettings?: {
    minScore?: number | null
    maxRisk?: number | null
  }
  defaultArenaSettings?: {
    minScore?: number | null
    minTokens?: number | null
    minEndorsements?: number | null
  }
  defaultPointsThreshold?: number | null
}

const ACHIEVEMENT_TEMPLATES: AchievementTemplate[] = [
  {
    id: 'kickoff-hero',
    name: "L'inizio",
    description: 'Premia chi completa per primo una lezione del corso.',
    unlockType: 'FIRST_CHAPTER',
    defaultPoints: 50,
    icon: 'sparkles',
  },
  {
    id: 'module-master',
    name: 'Modulo maestro',
    description: 'Sblocca quando un modulo viene completato al 100%.',
    unlockType: 'MODULE_COMPLETION',
    defaultPoints: 100,
    icon: 'flag',
    requiresModule: true,
  },
  {
    id: 'course-champion',
    name: 'Campione del corso',
    description: 'Celebra chi conclude l’intero corso.',
    unlockType: 'COURSE_COMPLETION',
    defaultPoints: 150,
    icon: 'trophy',
  },
  {
    id: 'quiz-ace',
    name: 'Asso dei quiz',
    description: 'Ricompensa chi supera un quiz con successo.',
    unlockType: 'QUIZ_SCORE',
    defaultPoints: 120,
    icon: 'star',
    requiresLesson: true,
    requiresQuiz: true,
    defaultQuizSettings: {
      requirePass: true,
      minScore: null,
    },
  },
  {
    id: 'flashcard-completer',
    name: 'Campione delle flashcard',
    description: 'Sblocca quando il learner completa il deck di flashcard.',
    unlockType: 'LESSON_COMPLETION',
    defaultPoints: 80,
    icon: 'sparkles',
    requiresLesson: true,
    requiresDeck: true,
  },
  {
    id: 'decision-pro',
    name: 'Pro del Decision Lab',
    description: 'Premia chi chiude il Decision Lab con punteggio alto e rischio sotto controllo.',
    unlockType: 'SCENARIO_PERFORMANCE',
    defaultPoints: 150,
    icon: 'flag',
    requiresLesson: true,
    requiresScenario: true,
    defaultScenarioSettings: {
      minScore: 200,
      maxRisk: 40,
    },
  },
  {
    id: 'practice-elite',
    name: 'Campione Practice Arena',
    description: 'Ricompensa chi eccelle nella Practice Arena con tokens e endorsement.',
    unlockType: 'ARENA_PERFORMANCE',
    defaultPoints: 160,
    icon: 'sparkles',
    requiresLesson: true,
    requiresArena: true,
    defaultArenaSettings: {
      minScore: 75,
      minTokens: 40,
      minEndorsements: 1,
    },
  },
  {
    id: 'points-milestone',
    name: 'Milestone punti corso',
    description: 'Premia chi raggiunge un certo totale di punti in questo corso.',
    unlockType: 'COURSE_POINTS',
    defaultPoints: 120,
    icon: 'trophy',
    defaultPointsThreshold: 300,
  },
]

const ICON_OPTIONS = [
  { value: 'sparkles', label: 'Scintille', icon: Sparkles },
  { value: 'flag', label: 'Bandiera', icon: Flag },
  { value: 'trophy', label: 'Trofeo', icon: Trophy },
  { value: 'star', label: 'Stella', icon: Star },
]

type CourseAchievementsPanelProps = {
  courseId: string
  achievements: CourseAchievement[]
  modules: Module[]
  onAchievementsChange: Dispatch<SetStateAction<CourseAchievement[]>>
}

type AchievementFormState = {
  title: string
  description: string
  unlockType: CourseAchievement['unlockType']
  pointsReward: number
  targetModuleId: string | null
  targetLessonId: string | null
  icon: string | null
  selectedQuizId: string | null
  selectedScenarioId: string | null
  selectedArenaId: string | null
  selectedDeckId: string | null
  quizRequirePass: boolean
  quizMinScore: number | null
  scenarioMinScore: number | null
  scenarioMaxRisk: number | null
  arenaMinScore: number | null
  arenaMinTokens: number | null
  arenaMinEndorsements: number | null
  pointsThreshold: number | null
}

type ApiAchievement = CourseAchievement & {
  createdAt: string
}

const mapAchievementResponse = (achievement: ApiAchievement): CourseAchievement => ({
  id: achievement.id,
  title: achievement.title,
  description: achievement.description ?? null,
  unlockType: achievement.unlockType,
  targetModuleId: achievement.targetModuleId ?? null,
  targetLessonId: achievement.targetLessonId ?? null,
  targetModule: achievement.targetModule ?? null,
  targetLesson: achievement.targetLesson ?? null,
  pointsReward: achievement.pointsReward,
  icon: achievement.icon ?? null,
  isActive: achievement.isActive,
  criteria: achievement.criteria ?? null,
  createdAt: achievement.createdAt,
})

const describeUnlock = (achievement: CourseAchievement) => {
  switch (achievement.unlockType) {
    case 'FIRST_CHAPTER':
      return 'Completa la prima lezione.'
    case 'MODULE_COMPLETION':
      return achievement.targetModule?.title
        ? `Completa il modulo “${achievement.targetModule.title}”.`
        : 'Completa un modulo specifico.'
    case 'COURSE_COMPLETION':
      return 'Conclude il corso al 100%.'
    case 'LESSON_COMPLETION':
      return achievement.targetLesson?.title
        ? `Completa la lezione “${achievement.targetLesson.title}”.`
        : 'Completa la lezione associata.'
    case 'QUIZ_SCORE': {
      const criteria = (achievement.criteria as Record<string, unknown> | null) ?? null
      const requirePass = criteria && typeof (criteria as { requirePass?: unknown }).requirePass === 'boolean'
        ? Boolean((criteria as { requirePass?: boolean }).requirePass)
        : true
      const minScore = criteria && typeof (criteria as { minScore?: unknown }).minScore === 'number'
        ? (criteria as { minScore?: number }).minScore
        : null
      const base = requirePass ? 'Supera il quiz selezionato' : 'Completa il quiz selezionato'
      if (typeof minScore === 'number') {
        return `${base} con punteggio ≥ ${minScore}`
      }
      return base
    }
    case 'SCENARIO_PERFORMANCE': {
      const criteria = (achievement.criteria as Record<string, unknown> | null) ?? null
      const minScore = criteria && typeof (criteria as { minScore?: unknown }).minScore === 'number'
        ? (criteria as { minScore?: number }).minScore
        : null
      const maxRisk = criteria && typeof (criteria as { maxRisk?: unknown }).maxRisk === 'number'
        ? (criteria as { maxRisk?: number }).maxRisk
        : null
      if (minScore != null && maxRisk != null) {
        return `Decision Lab: punteggio ≥ ${minScore} e rischio ≤ ${maxRisk}%`
      }
      if (minScore != null) {
        return `Decision Lab: raggiungi almeno ${minScore} punti`
      }
      if (maxRisk != null) {
        return `Decision Lab: mantieni rischio ≤ ${maxRisk}%`
      }
      return 'Chiudi il Decision Lab con buone performance.'
    }
    case 'ARENA_PERFORMANCE': {
      const criteria = (achievement.criteria as Record<string, unknown> | null) ?? null
      const minScore = criteria && typeof (criteria as { minScore?: unknown }).minScore === 'number'
        ? (criteria as { minScore?: number }).minScore
        : null
      const minTokens = criteria && typeof (criteria as { minTokens?: unknown }).minTokens === 'number'
        ? (criteria as { minTokens?: number }).minTokens
        : null
      const minEndorsements =
        criteria && typeof (criteria as { minEndorsements?: unknown }).minEndorsements === 'number'
          ? (criteria as { minEndorsements?: number }).minEndorsements
          : null

      const parts: string[] = []
      if (minScore != null) {
        parts.push(`punteggio ≥ ${minScore}`)
      }
      if (minTokens != null) {
        parts.push(`Insight Tokens ≥ ${minTokens}`)
      }
      if (minEndorsements != null) {
        parts.push(
          `${minEndorsements} endorsement${minEndorsements === 1 ? '' : 's'}`,
        )
      }

      if (parts.length > 0) {
        return `Practice Arena: ${parts.join(' · ')}`
      }

      return 'Completa la Practice Arena con un piano approvato.'
    }
    case 'COURSE_POINTS': {
      const criteria = (achievement.criteria as Record<string, unknown> | null) ?? null
      const threshold = criteria && typeof (criteria as { pointsThreshold?: unknown }).pointsThreshold === 'number'
        ? Math.max(0, (criteria as { pointsThreshold?: number }).pointsThreshold ?? 0)
        : null
      if (threshold && threshold > 0) {
        return `Raggiungi almeno ${threshold} punti nel corso.`
      }
      return 'Raggiungi la soglia punti definita per il corso.'
    }
    default:
      return 'Obiettivo personalizzato.'
  }
}

const iconToComponent = (iconKey?: string | null) => {
  switch (iconKey) {
    case 'sparkles':
      return Sparkles
    case 'flag':
      return Flag
    case 'trophy':
      return Trophy
    case 'star':
      return Star
    default:
      return Award
  }
}

const formatUnlockTypeLabel = (unlockType: CourseAchievement['unlockType']) =>
  unlockType
    .split('_')
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(' ')

const WIZARD_STEPS = [
  {
    key: 'template',
    title: 'Tipo',
    description: 'Scegli come si sblocca il badge.',
  },
  {
    key: 'identity',
    title: 'Identità',
    description: 'Icona e titolo in stile notebook.',
  },
  {
    key: 'details',
    title: 'Dettagli',
    description: 'Descrizione e collegamenti al corso.',
  },
  {
    key: 'reward',
    title: 'Ricompensa',
    description: 'Punti e condizioni di sblocco.',
  },
]

function EnableLeaderboardToggle({ courseId }: { courseId: string }) {
  // Inline client component that fetches and toggles the course flag via PATCH
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Minimal fetch to read current flag
    ;(async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}`, { method: 'GET' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setEnabled(Boolean(data.isLeaderboardEnabled))
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [courseId])

  const toggle = async () => {
    if (enabled == null) return
    setSaving(true)
    try {
      await axios.patch(`/api/courses/${courseId}`, { isLeaderboardEnabled: !enabled })
      setEnabled((v) => !v)
      toast.success(!enabled ? 'Leaderboard abilitata' : 'Leaderboard disabilitata')
    } catch {
      toast.error('Impossibile aggiornare la leaderboard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 inline-flex items-center gap-3 rounded-lg border border-border/40 bg-card/80 px-3 py-2">
      <span className="text-xs text-muted-foreground">Classifica del corso</span>
      <Button type="button" size="sm" variant={enabled ? 'default' : 'outline'} onClick={toggle} disabled={saving || enabled == null}>
        {enabled ? 'Abilitata' : 'Disabilitata'}
      </Button>
    </div>
  )
}

export const CourseAchievementsPanel = ({
  courseId,
  achievements,
  modules,
  onAchievementsChange,
}: CourseAchievementsPanelProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(ACHIEVEMENT_TEMPLATES[0].id)
  const [formState, setFormState] = useState<AchievementFormState>(() => ({
    title: ACHIEVEMENT_TEMPLATES[0].name,
    description: ACHIEVEMENT_TEMPLATES[0].description,
    unlockType: ACHIEVEMENT_TEMPLATES[0].unlockType,
    pointsReward: ACHIEVEMENT_TEMPLATES[0].defaultPoints,
    targetModuleId: null,
    targetLessonId: null,
    icon: ACHIEVEMENT_TEMPLATES[0].icon,
    selectedQuizId: null,
    selectedScenarioId: null,
    selectedDeckId: null,
    quizRequirePass: ACHIEVEMENT_TEMPLATES[0].defaultQuizSettings?.requirePass ?? true,
    quizMinScore: ACHIEVEMENT_TEMPLATES[0].defaultQuizSettings?.minScore ?? null,
    scenarioMinScore: ACHIEVEMENT_TEMPLATES[0].defaultScenarioSettings?.minScore ?? null,
    scenarioMaxRisk: ACHIEVEMENT_TEMPLATES[0].defaultScenarioSettings?.maxRisk ?? null,
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [busyAchievementId, setBusyAchievementId] = useState<string | null>(null)
  const totalSteps = WIZARD_STEPS.length
  const isLastStep = currentStep === totalSteps - 1
  const titleInputId = 'achievement-title'
  const descriptionInputId = 'achievement-description'

  const sortedAchievements = useMemo(
    () =>
      [...achievements].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [achievements],
  )

  const selectedTemplate = useMemo(
    () => ACHIEVEMENT_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? ACHIEVEMENT_TEMPLATES[0],
    [selectedTemplateId],
  )

  const moduleOptions = useMemo(
    () => modules.map((courseModule) => ({ id: courseModule.id, title: courseModule.title })),
    [modules],
  )

  const lessonOptions = useMemo(
    () =>
      modules.flatMap((courseModule) =>
        courseModule.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          moduleId: courseModule.id,
          moduleTitle: courseModule.title,
        })),
      ),
    [modules],
  )

  const quizOptions = useMemo(() => {
    const map = new Map<string, {
      id: string
      title: string
      lessonId: string
      lessonTitle: string
      moduleId: string
      moduleTitle: string
    }>()
    for (const courseModule of modules) {
      for (const lesson of courseModule.lessons) {
        for (const block of lesson.blocks) {
          const summary = block.quizSummary ?? block.gamification?.quizSummary
          if (summary && !map.has(summary.id)) {
            map.set(summary.id, {
              id: summary.id,
              title: summary.title,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              moduleId: courseModule.id,
              moduleTitle: courseModule.title,
            })
          }
        }
      }
    }
    return Array.from(map.values())
  }, [modules])

  const flashcardOptions = useMemo(() => {
    const options: {
      deckId: string
      title: string
      lessonId: string
      lessonTitle: string
      moduleId: string
      moduleTitle: string
    }[] = []
    for (const courseModule of modules) {
      for (const lesson of courseModule.lessons) {
        for (const block of lesson.blocks) {
          const deck = block.gamification?.flashcardDeck
          if (deck) {
            options.push({
              deckId: deck.id,
              title: deck.title,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              moduleId: courseModule.id,
              moduleTitle: courseModule.title,
            })
          }
        }
      }
    }
    return options
  }, [modules])

  const scenarioOptions = useMemo(() => {
    const options: {
      gamificationId: string
      title: string
      lessonId: string
      lessonTitle: string
      moduleId: string
      moduleTitle: string
    }[] = []
    for (const courseModule of modules) {
      for (const lesson of courseModule.lessons) {
        for (const block of lesson.blocks) {
          const gamification = block.gamification
          if (gamification && gamification.contentType === 'SCENARIO') {
            options.push({
              gamificationId: gamification.id,
              title: block.title || gamification.scenarioSummary?.intro || 'Decision Lab',
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              moduleId: courseModule.id,
              moduleTitle: courseModule.title,
            })
          }
        }
      }
    }
    return options
  }, [modules])

  const arenaOptions = useMemo(() => {
    const options: {
      gamificationId: string
      title: string
      lessonId: string
      lessonTitle: string
      moduleId: string
      moduleTitle: string
    }[] = []

    for (const courseModule of modules) {
      for (const lesson of courseModule.lessons) {
        for (const block of lesson.blocks) {
          const gamification = block.gamification
          if (gamification && gamification.contentType === 'ARENA') {
            options.push({
              gamificationId: gamification.id,
              title: block.title || gamification.arenaSummary?.title || 'Practice Arena',
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              moduleId: courseModule.id,
              moduleTitle: courseModule.title,
            })
          }
        }
      }
    }

    return options
  }, [modules])

  const buildDefaultState = useCallback(
    (template: AchievementTemplate): AchievementFormState => {
      let targetModuleId: string | null = null
      let targetLessonId: string | null = null
      let selectedQuizId: string | null = null
      let selectedDeckId: string | null = null
      let selectedScenarioId: string | null = null
      let selectedArenaId: string | null = null

      if (template.requiresQuiz) {
        const quiz = quizOptions[0]
        if (quiz) {
          targetModuleId = quiz.moduleId
          targetLessonId = quiz.lessonId
          selectedQuizId = quiz.id
        }
      }

      if (template.requiresDeck) {
        const deck = flashcardOptions[0]
        if (deck) {
          targetModuleId = deck.moduleId
          targetLessonId = deck.lessonId
          selectedDeckId = deck.deckId
        }
      }

      if (template.requiresScenario) {
        const scenario = scenarioOptions[0]
        if (scenario) {
          targetModuleId = scenario.moduleId
          targetLessonId = scenario.lessonId
          selectedScenarioId = scenario.gamificationId
        }
      }

      if (template.requiresArena) {
        const arena = arenaOptions[0]
        if (arena) {
          targetModuleId = arena.moduleId
          targetLessonId = arena.lessonId
          selectedArenaId = arena.gamificationId
        }
      }

      if (template.requiresLesson && !targetLessonId) {
        const lesson = lessonOptions[0]
        if (lesson) {
          targetLessonId = lesson.id
          targetModuleId = lesson.moduleId
        }
      }

      if (template.requiresModule && !targetModuleId) {
        targetModuleId = moduleOptions[0]?.id ?? null
      }

      return {
        title: template.name,
        description: template.description,
        unlockType: template.unlockType,
        pointsReward: template.defaultPoints,
        targetModuleId,
        targetLessonId,
        icon: template.icon,
        selectedQuizId,
        selectedScenarioId,
        selectedArenaId,
        selectedDeckId,
        quizRequirePass: template.defaultQuizSettings?.requirePass ?? true,
        quizMinScore: template.defaultQuizSettings?.minScore ?? null,
        scenarioMinScore: template.defaultScenarioSettings?.minScore ?? null,
        scenarioMaxRisk: template.defaultScenarioSettings?.maxRisk ?? null,
        arenaMinScore: template.defaultArenaSettings?.minScore ?? null,
        arenaMinTokens: template.defaultArenaSettings?.minTokens ?? null,
        arenaMinEndorsements: template.defaultArenaSettings?.minEndorsements ?? null,
        pointsThreshold: template.defaultPointsThreshold ?? null,
      }
    },
    [arenaOptions, flashcardOptions, lessonOptions, moduleOptions, quizOptions, scenarioOptions],
  )

  const resetDialogState = () => {
    const defaultTemplate = ACHIEVEMENT_TEMPLATES[0]
    setSelectedTemplateId(defaultTemplate.id)
    setFormState(buildDefaultState(defaultTemplate))
    setCurrentStep(0)
  }

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetDialogState()
    } else {
      setCurrentStep(0)
      const template = ACHIEVEMENT_TEMPLATES.find((item) => item.id === selectedTemplateId) ?? ACHIEVEMENT_TEMPLATES[0]
      setFormState(buildDefaultState(template))
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = ACHIEVEMENT_TEMPLATES.find((item) => item.id === templateId)
    if (!template) return

    setSelectedTemplateId(template.id)
    setFormState(buildDefaultState(template))
    setCurrentStep(0)
  }

  const stepIsValid = (step: number) => {
    switch (step) {
      case 0:
        return Boolean(selectedTemplate)
      case 1:
        return Boolean(formState.icon) && Boolean(formState.title.trim())
      case 2:
        if (selectedTemplate.requiresModule && !formState.targetModuleId) return false
        if (selectedTemplate.requiresLesson && !formState.targetLessonId) return false
        if (selectedTemplate.requiresQuiz && !formState.selectedQuizId) return false
        if (selectedTemplate.requiresDeck && !formState.selectedDeckId) return false
        if (selectedTemplate.requiresScenario && !formState.selectedScenarioId) return false
        if (selectedTemplate.requiresArena && !formState.selectedArenaId) return false
        return true
      default:
        return true
    }
  }

  const canContinue = stepIsValid(currentStep)

  const handleGoNext = () => {
    if (isLastStep || !canContinue || isSaving) return
    setCurrentStep((step) => Math.min(step + 1, totalSteps - 1))
  }

  const handleGoBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  const creationDisabled =
    isSaving ||
    (selectedTemplate.requiresModule && !formState.targetModuleId) ||
    (selectedTemplate.requiresLesson && !formState.targetLessonId) ||
    (selectedTemplate.requiresQuiz && !formState.selectedQuizId) ||
    (selectedTemplate.requiresDeck && !formState.selectedDeckId) ||
    (selectedTemplate.requiresScenario && !formState.selectedScenarioId) ||
    (selectedTemplate.requiresArena && !formState.selectedArenaId) ||
    (formState.unlockType === 'COURSE_POINTS' && (!formState.pointsThreshold || formState.pointsThreshold <= 0))

  const handleCreateAchievement = async () => {
    if (!formState.title.trim()) {
      toast.error('Aggiungi un titolo per l’obiettivo')
      return
    }

    if (selectedTemplate.requiresModule && !formState.targetModuleId) {
      toast.error('Seleziona un modulo per questo obiettivo')
      return
    }

    if (selectedTemplate.requiresLesson && !formState.targetLessonId) {
      toast.error('Seleziona una lezione per questo obiettivo')
      return
    }

    if (selectedTemplate.requiresQuiz && !formState.selectedQuizId) {
      toast.error('Collega un quiz per questo obiettivo')
      return
    }

    if (selectedTemplate.requiresDeck && !formState.selectedDeckId) {
      toast.error('Collega un deck di flashcard per questo obiettivo')
      return
    }

    if (selectedTemplate.requiresScenario && !formState.selectedScenarioId) {
      toast.error('Collega un Decision Lab per questo obiettivo')
      return
    }

    if (selectedTemplate.requiresArena && !formState.selectedArenaId) {
      toast.error('Collega una Practice Arena per questo obiettivo')
      return
    }

    if (typeof formState.quizMinScore === 'number' && formState.quizMinScore < 0) {
      toast.error('Il punteggio minimo deve essere positivo')
      return
    }

    if (typeof formState.scenarioMinScore === 'number' && formState.scenarioMinScore < 0) {
      toast.error('Il punteggio minimo del Decision Lab deve essere positivo')
      return
    }

    if (
      typeof formState.scenarioMaxRisk === 'number' &&
      (formState.scenarioMaxRisk < 0 || formState.scenarioMaxRisk > 100)
    ) {
      toast.error('Il rischio massimo deve essere compreso tra 0 e 100')
      return
    }

    if (
      typeof formState.arenaMinScore === 'number' &&
      (formState.arenaMinScore < 0 || formState.arenaMinScore > 100)
    ) {
      toast.error('Il punteggio minimo della Practice Arena deve essere tra 0 e 100')
      return
    }

    if (typeof formState.arenaMinTokens === 'number' && formState.arenaMinTokens < 0) {
      toast.error('I token minimi devono essere positivi')
      return
    }

    if (
      typeof formState.arenaMinEndorsements === 'number' &&
      formState.arenaMinEndorsements < 0
    ) {
      toast.error('Gli endorsement minimi devono essere almeno 0')
      return
    }

    if (formState.unlockType === 'COURSE_POINTS') {
      const threshold = formState.pointsThreshold ?? 0
      if (!Number.isFinite(threshold) || threshold <= 0) {
        toast.error('Imposta una soglia punti maggiore di zero')
        return
      }
    }

    try {
      setIsSaving(true)
      const payload: Record<string, unknown> = {
        title: formState.title.trim(),
        description: formState.description.trim() || null,
        unlockType: formState.unlockType,
        targetModuleId: formState.targetModuleId,
        targetLessonId: formState.targetLessonId,
        pointsReward: formState.pointsReward,
        icon: formState.icon,
      }

      switch (formState.unlockType) {
        case 'QUIZ_SCORE': {
          payload.criteria = {
            quizId: formState.selectedQuizId,
            requirePass: formState.quizRequirePass,
            ...(typeof formState.quizMinScore === 'number' ? { minScore: formState.quizMinScore } : {}),
          }
          break
        }
        case 'LESSON_COMPLETION': {
          if (selectedTemplate.requiresDeck && formState.selectedDeckId) {
            payload.criteria = {
              deckId: formState.selectedDeckId,
              lessonId: formState.targetLessonId,
            }
          } else {
            payload.criteria = formState.targetLessonId ? { lessonId: formState.targetLessonId } : null
          }
          break
        }
        case 'SCENARIO_PERFORMANCE': {
          payload.criteria = {
            gamificationBlockId: formState.selectedScenarioId,
            ...(typeof formState.scenarioMinScore === 'number' ? { minScore: formState.scenarioMinScore } : {}),
            ...(typeof formState.scenarioMaxRisk === 'number' ? { maxRisk: formState.scenarioMaxRisk } : {}),
          }
          break
        }
        case 'ARENA_PERFORMANCE': {
          payload.criteria = {
            gamificationBlockId: formState.selectedArenaId,
            ...(typeof formState.arenaMinScore === 'number' ? { minScore: formState.arenaMinScore } : {}),
            ...(typeof formState.arenaMinTokens === 'number' ? { minTokens: formState.arenaMinTokens } : {}),
            ...(typeof formState.arenaMinEndorsements === 'number'
              ? { minEndorsements: Math.max(0, Math.trunc(formState.arenaMinEndorsements)) }
              : {}),
          }
          break
        }
        case 'COURSE_POINTS': {
          payload.targetModuleId = null
          payload.targetLessonId = null
          payload.criteria = {
            pointsThreshold: Math.max(1, Math.trunc(formState.pointsThreshold ?? 0)),
          }
          break
        }
        default:
          payload.criteria = null
      }

      const response = await axios.post<ApiAchievement>(`/api/courses/${courseId}/achievements`, payload)

      const mapped = mapAchievementResponse(response.data)

      onAchievementsChange((current) => [...current, mapped])
      toast.success('Obiettivo creato')
      setIsDialogOpen(false)
      resetDialogState()
    } catch {
      toast.error('Impossibile creare l’obiettivo')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (achievement: CourseAchievement) => {
    try {
      setBusyAchievementId(achievement.id)
      const response = await axios.patch<ApiAchievement>(
        `/api/courses/${courseId}/achievements/${achievement.id}`,
        {
          isActive: !achievement.isActive,
        },
      )

      const updated = mapAchievementResponse(response.data)

      onAchievementsChange((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      toast.success(updated.isActive ? 'Obiettivo attivato' : 'Obiettivo disattivato')
    } catch {
      toast.error('Non è stato possibile aggiornare l’obiettivo')
    } finally {
      setBusyAchievementId(null)
    }
  }


  const renderStepContent = () => {
    switch (currentStep) {
      case 0: {
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Seleziona il tipo di obiettivo più adatto. Potrai rifinire la proposta nei passaggi successivi.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ACHIEVEMENT_TEMPLATES.map((template) => {
                const Icon = iconToComponent(template.icon)
                const isActive = template.id === selectedTemplateId
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template.id)}
                    className={cn(
                      'group relative flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/80 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0',
                      isActive && 'border-primary bg-primary text-primary-foreground shadow-lg hover:shadow-lg',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors',
                          isActive && 'bg-primary-foreground/20 text-primary-foreground',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="space-y-1">
                        <p
                          className={cn(
                            'break-words text-sm font-semibold leading-tight',
                            isActive ? 'text-primary-foreground' : 'text-foreground',
                          )}
                        >
                          {template.name}
                        </p>
                        <p
                          className={cn(
                            'break-words text-xs leading-snug text-muted-foreground/90',
                            isActive && 'text-primary-foreground/80',
                          )}
                        >
                          {template.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'mt-4 inline-flex items-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80',
                        isActive && 'text-primary-foreground/80',
                      )}
                    >
                      {formatUnlockTypeLabel(template.unlockType)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      }
      case 1: {
        const SelectedIcon = iconToComponent(formState.icon)
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Icona</Label>
              <div className="flex flex-wrap gap-3">
                {ICON_OPTIONS.map((iconOption) => {
                  const Icon = iconOption.icon
                  const isActive = formState.icon === iconOption.value
                  return (
                    <button
                      key={iconOption.value}
                      type="button"
                      onClick={() => setFormState((state) => ({ ...state, icon: iconOption.value }))}
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-card/80 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        isActive && 'border-primary bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={titleInputId} className="text-xs uppercase tracking-wide text-muted-foreground">
                Titolo
              </Label>
              <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4 transition-all focus-within:border-primary focus-within:shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card text-muted-foreground">
                    <SelectedIcon className="h-6 w-6" />
                  </span>
                  <Input
                    id={titleInputId}
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((state) => ({ ...state, title: event.target.value }))
                    }
                    placeholder="Es. Campione del kickoff"
                    className="h-auto border-none bg-transparent p-0 text-xl font-semibold tracking-tight text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Mantieni un nome breve: racconta subito cosa celebra questo badge.
                </p>
              </div>
            </div>
          </div>
        )
      }
      case 2:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={descriptionInputId} className="text-xs uppercase tracking-wide text-muted-foreground">
                Descrizione
              </Label>
              <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4 transition-all focus-within:border-primary focus-within:shadow-sm">
                <Textarea
                  id={descriptionInputId}
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((state) => ({ ...state, description: event.target.value }))
                  }
                  placeholder="Dai un contesto ai learner su come sbloccare il badge."
                  className="min-h-[110px] resize-none border-none bg-transparent p-0 text-sm leading-relaxed text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>
            {selectedTemplate.requiresModule ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Modulo di riferimento
                </Label>
                <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                  <Select
                    value={formState.targetModuleId ?? ''}
                    onValueChange={(value) =>
                      setFormState((state) => ({ ...state, targetModuleId: value || null }))
                    }
                    disabled={moduleOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un modulo" />
                    </SelectTrigger>
                    <SelectContent>
                      {moduleOptions.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {moduleOptions.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Crea prima almeno un modulo pubblicato per utilizzare questo template.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedTemplate.requiresLesson ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Lezione di riferimento
                </Label>
                <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                  <Select
                    value={formState.targetLessonId ?? ''}
                    onValueChange={(value) => {
                      const lesson = lessonOptions.find((item) => item.id === value)
                      setFormState((state) => ({
                        ...state,
                        targetLessonId: value || null,
                        targetModuleId: lesson ? lesson.moduleId : state.targetModuleId,
                      }))
                    }}
                    disabled={lessonOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona una lezione" />
                    </SelectTrigger>
                    <SelectContent>
                      {lessonOptions.map((lesson) => (
                        <SelectItem key={lesson.id} value={lesson.id}>
                          {lesson.title} · {lesson.moduleTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lessonOptions.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Aggiungi prima almeno una lezione per questo corso.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedTemplate.requiresQuiz ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Quiz
                </Label>
                <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                  <Select
                    value={formState.selectedQuizId ?? ''}
                    onValueChange={(value) => {
                      const quiz = quizOptions.find((item) => item.id === value)
                      setFormState((state) => ({
                        ...state,
                        selectedQuizId: value || null,
                        targetLessonId: quiz ? quiz.lessonId : state.targetLessonId,
                        targetModuleId: quiz ? quiz.moduleId : state.targetModuleId,
                      }))
                    }}
                    disabled={quizOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un quiz" />
                    </SelectTrigger>
                    <SelectContent>
                      {quizOptions.map((quiz) => (
                        <SelectItem key={quiz.id} value={quiz.id}>
                          {quiz.title} · {quiz.lessonTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {quizOptions.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Crea o pubblica un quiz per attivare questo template.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedTemplate.requiresDeck ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Deck di flashcard
                </Label>
                <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                  <Select
                    value={formState.selectedDeckId ?? ''}
                    onValueChange={(value) => {
                      const deck = flashcardOptions.find((item) => item.deckId === value)
                      setFormState((state) => ({
                        ...state,
                        selectedDeckId: value || null,
                        targetLessonId: deck ? deck.lessonId : state.targetLessonId,
                        targetModuleId: deck ? deck.moduleId : state.targetModuleId,
                      }))
                    }}
                    disabled={flashcardOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un deck" />
                    </SelectTrigger>
                    <SelectContent>
                      {flashcardOptions.map((deck) => (
                        <SelectItem key={deck.deckId} value={deck.deckId}>
                          {deck.title} · {deck.lessonTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {flashcardOptions.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Genera o pubblica un deck di flashcard per usare questo template.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedTemplate.requiresScenario ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Decision Lab
                </Label>
                <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                  <Select
                    value={formState.selectedScenarioId ?? ''}
                    onValueChange={(value) => {
                      const scenario = scenarioOptions.find((item) => item.gamificationId === value)
                      setFormState((state) => ({
                        ...state,
                        selectedScenarioId: value || null,
                        targetLessonId: scenario ? scenario.lessonId : state.targetLessonId,
                        targetModuleId: scenario ? scenario.moduleId : state.targetModuleId,
                      }))
                    }}
                    disabled={scenarioOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un Decision Lab" />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarioOptions.map((scenario) => (
                        <SelectItem key={scenario.gamificationId} value={scenario.gamificationId}>
                          {scenario.title} · {scenario.lessonTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {scenarioOptions.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Genera un Decision Lab dal builder per usare questo template.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedTemplate.requiresArena ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Practice Arena
                </Label>
                <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                  <Select
                    value={formState.selectedArenaId ?? ''}
                    onValueChange={(value) => {
                      const arena = arenaOptions.find((item) => item.gamificationId === value)
                      setFormState((state) => ({
                        ...state,
                        selectedArenaId: value || null,
                        targetLessonId: arena ? arena.lessonId : state.targetLessonId,
                        targetModuleId: arena ? arena.moduleId : state.targetModuleId,
                      }))
                    }}
                    disabled={arenaOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona una Practice Arena" />
                    </SelectTrigger>
                    <SelectContent>
                      {arenaOptions.map((arena) => (
                        <SelectItem key={arena.gamificationId} value={arena.gamificationId}>
                          {arena.title} · {arena.lessonTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {arenaOptions.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Genera o pubblica una Practice Arena per usare questo template.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )
      case 3:
      default: {
        const PreviewIcon = iconToComponent(formState.icon)
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Punti assegnati
                </Label>
                <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                  <Input
                    type="number"
                    min={0}
                    value={formState.pointsReward}
                    onChange={(event) =>
                      setFormState((state) => ({
                        ...state,
                        pointsReward: Number(event.target.value) || 0,
                      }))
                    }
                    className="h-12 rounded-2xl border border-border/60 bg-card text-lg font-semibold focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Premi generosi danno peso ai progressi davvero importanti.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Anteprima
                </Label>
                <div className="flex h-full items-center gap-3 rounded-3xl border border-border/50 bg-card/80 px-5 py-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <PreviewIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {formState.title || 'Titolo obiettivo'}
                    </p>
                    <p className="text-xs text-muted-foreground">+{formState.pointsReward} punti</p>
                  </div>
                </div>
              </div>
            </div>
            {formState.unlockType === 'COURSE_POINTS' ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Soglia punti corso
                </Label>
                <div className="rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                  <Input
                    type="number"
                    min={1}
                    value={formState.pointsThreshold ?? ''}
                    placeholder="Es. 300"
                    onChange={(event) => {
                      const raw = event.target.value
                      const numeric = Number(raw)
                      setFormState((state) => ({
                        ...state,
                        pointsThreshold:
                          raw === '' || Number.isNaN(numeric)
                            ? null
                            : Math.max(1, Math.trunc(numeric)),
                      }))
                    }}
                    className="h-12 rounded-2xl border border-border/60 bg-card text-base focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Il learner sblocca l’obiettivo quando accumula almeno questo numero di punti nel corso.
                  </p>
                </div>
              </div>
            ) : null}
            {formState.unlockType === 'QUIZ_SCORE' ? (
              <div className="space-y-4 rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3 text-sm text-foreground">
                  <Checkbox
                    id="achievement-quiz-pass"
                    checked={formState.quizRequirePass}
                    onCheckedChange={(checked) =>
                      setFormState((state) => ({
                        ...state,
                        quizRequirePass: Boolean(checked),
                      }))
                    }
                  />
                  <Label htmlFor="achievement-quiz-pass" className="leading-none">
                    Richiedi quiz superato
                  </Label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Punteggio minimo (facoltativo)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formState.quizMinScore ?? ''}
                      placeholder="Es. 80"
                      onChange={(event) => {
                        const raw = event.target.value
                        const numeric = Number(raw)
                        setFormState((state) => ({
                          ...state,
                          quizMinScore:
                            raw === '' || Number.isNaN(numeric) ? null : Math.max(0, numeric),
                        }))
                      }}
                      className="h-11 rounded-2xl border border-border/60 bg-card focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lascia vuoto per usare solo la regola di superamento del quiz.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {formState.unlockType === 'SCENARIO_PERFORMANCE' ? (
              <div className="space-y-4 rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Decision Lab · requisiti
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Punteggio minimo
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formState.scenarioMinScore ?? ''}
                      placeholder="Es. 200"
                      onChange={(event) => {
                        const raw = event.target.value
                        const numeric = Number(raw)
                        setFormState((state) => ({
                          ...state,
                          scenarioMinScore:
                            raw === '' || Number.isNaN(numeric) ? null : Math.max(0, numeric),
                        }))
                      }}
                      className="h-11 rounded-2xl border border-border/60 bg-card focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Rischio massimo (%)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={formState.scenarioMaxRisk ?? ''}
                      placeholder="Es. 40"
                      onChange={(event) => {
                        const raw = event.target.value
                        const numeric = Number(raw)
                        setFormState((state) => ({
                          ...state,
                          scenarioMaxRisk:
                            raw === '' || Number.isNaN(numeric)
                              ? null
                              : Math.max(0, Math.min(100, numeric)),
                        }))
                      }}
                      className="h-11 rounded-2xl border border-border/60 bg-card focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                    <p className="text-xs text-muted-foreground">
                      Imposta 0-100 per limitare scelte ad alto rischio.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {formState.unlockType === 'ARENA_PERFORMANCE' ? (
              <div className="space-y-4 rounded-3xl border border-border/50 bg-background/80 px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Practice Arena · requisiti
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Punteggio minimo
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={formState.arenaMinScore ?? ''}
                      placeholder="Es. 75"
                      onChange={(event) => {
                        const raw = event.target.value
                        const numeric = Number(raw)
                        setFormState((state) => ({
                          ...state,
                          arenaMinScore:
                            raw === '' || Number.isNaN(numeric)
                              ? null
                              : Math.max(0, Math.min(100, numeric)),
                        }))
                      }}
                      className="h-11 rounded-2xl border border-border/60 bg-card focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Insight Tokens minimi
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formState.arenaMinTokens ?? ''}
                      placeholder="Es. 40"
                      onChange={(event) => {
                        const raw = event.target.value
                        const numeric = Number(raw)
                        setFormState((state) => ({
                          ...state,
                          arenaMinTokens:
                            raw === '' || Number.isNaN(numeric) ? null : Math.max(0, numeric),
                        }))
                      }}
                      className="h-11 rounded-2xl border border-border/60 bg-card focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Endorsement minimi
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={formState.arenaMinEndorsements ?? ''}
                      placeholder="Es. 1"
                      onChange={(event) => {
                        const raw = event.target.value
                        const numeric = Number(raw)
                        setFormState((state) => ({
                          ...state,
                          arenaMinEndorsements:
                            raw === '' || Number.isNaN(numeric)
                              ? null
                              : Math.max(0, Math.trunc(numeric)),
                        }))
                      }}
                      className="h-11 rounded-2xl border border-border/60 bg-card focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lascia vuoto per non richiedere endorsement HR.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )
      }
    }
  }

  const handleDeleteAchievement = async (achievement: CourseAchievement) => {
    const shouldDelete = window.confirm(`Vuoi eliminare l’obiettivo “${achievement.title}”?`)
    if (!shouldDelete) return

    try {
      setBusyAchievementId(achievement.id)
      await axios.delete(`/api/courses/${courseId}/achievements/${achievement.id}`)
      onAchievementsChange((current) => current.filter((item) => item.id !== achievement.id))
      toast.success('Obiettivo eliminato')
    } catch {
      toast.error('Non è stato possibile eliminare l’obiettivo')
    } finally {
      setBusyAchievementId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Centro obiettivi</h3>
          <p className="text-sm text-muted-foreground">
            Crea ricompense rapide e tieni traccia dei punti assegnati quando i learner avanzano nel corso.
          </p>
          {/* Leaderboard toggle lives here to keep gamification settings together */}
          <EnableLeaderboardToggle courseId={courseId} />
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
            <Button onClick={() => handleOpenChange(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo obiettivo
            </Button>
            <DialogContent className="max-w-[90vw] sm:max-w-3xl lg:max-w-4xl overflow-hidden rounded-3xl border border-border/40 bg-background/95 p-0 shadow-2xl backdrop-blur">
              <div className="space-y-6 p-6">
                <DialogHeader className="space-y-1.5">
                  <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                    Configura obiettivo
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Costruisci il badge passo dopo passo per mantenerlo chiaro e memorabile.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                    {WIZARD_STEPS.map((step, index) => {
                      const isActive = index === currentStep
                      const isCompleted = index < currentStep
                      return (
                        <div key={step.key} className="flex min-w-[150px] items-center gap-3">
                          <span
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : isCompleted
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-background text-muted-foreground',
                            )}
                          >
                            {index + 1}
                          </span>
                          <div className="space-y-0.5">
                            <p
                              className={cn(
                                'text-sm font-medium',
                                isActive ? 'text-foreground' : 'text-muted-foreground',
                              )}
                            >
                              {step.title}
                            </p>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="rounded-3xl border border-border/50 bg-card/70 p-5 shadow-sm">
                    {renderStepContent()}
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Annulla
                </Button>
                <div className="flex items-center gap-2">
                  {currentStep > 0 ? (
                    <Button variant="outline" onClick={handleGoBack} disabled={isSaving}>
                      Indietro
                    </Button>
                  ) : null}
                  {!isLastStep ? (
                    <Button onClick={handleGoNext} disabled={!canContinue || isSaving}>
                      Continua
                    </Button>
                  ) : (
                    <Button onClick={handleCreateAchievement} disabled={creationDisabled}>
                      {isSaving ? 'Salvataggio…' : 'Crea obiettivo'}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedAchievements.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-muted/20">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Nessun obiettivo ancora</CardTitle>
              <CardDescription>
                Aggiungi un obiettivo per guidare il comportamento desiderato e distribuire punti gamification.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          sortedAchievements.map((achievement) => {
            const Icon = iconToComponent(achievement.icon)
            const isBusy = busyAchievementId === achievement.id
            return (
              <Card key={achievement.id} className="flex h-full flex-col border border-border/60 bg-card/80 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <CardTitle className="break-words text-base font-semibold text-foreground">
                          {achievement.title}
                        </CardTitle>
                        <CardDescription className="break-words">
                          {describeUnlock(achievement)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={achievement.isActive ? 'default' : 'secondary'} className="uppercase text-[10px]">
                      {achievement.isActive ? 'Attivo' : 'Bozza'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {achievement.description ? <p className="break-words">{achievement.description}</p> : null}
                    {achievement.targetLesson?.title ? (
                      <p className="break-words text-xs">Lezione: {achievement.targetLesson.title}</p>
                    ) : null}
                    <p className="text-xs font-medium text-foreground">
                      +{achievement.pointsReward} punti
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(achievement)}
                        disabled={isBusy}
                        className="h-7 px-2 text-xs"
                      >
                        {achievement.isActive ? (
                          <>
                            <ToggleLeft className="mr-1 h-3.5 w-3.5" />
                            Disattiva
                          </>
                        ) : (
                          <>
                            <ToggleRight className="mr-1 h-3.5 w-3.5" />
                            Attiva
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled
                        className="h-7 px-2 text-xs text-muted-foreground"
                      >
                        <Settings2 className="mr-1 h-3.5 w-3.5" />
                        Modifica
                      </Button>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteAchievement(achievement)}
                      disabled={isBusy}
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Elimina
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

export default CourseAchievementsPanel
