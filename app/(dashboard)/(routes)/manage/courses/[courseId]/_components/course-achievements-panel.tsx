'use client'

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ACHIEVEMENT_TEMPLATES = [
  {
    id: 'kickoff-hero',
    name: "L'inizio",
    description: 'Premia chi completa per primo una lezione del corso.',
    unlockType: 'FIRST_CHAPTER' as const,
    defaultPoints: 50,
    icon: 'sparkles',
  },
  {
    id: 'module-master',
    name: 'Modulo maestro',
    description: 'Sblocca quando un modulo viene completato al 100%.',
    unlockType: 'MODULE_COMPLETION' as const,
    defaultPoints: 100,
    icon: 'flag',
    requiresModule: true,
  },
  {
    id: 'course-champion',
    name: 'Course champion',
    description: 'Celebra chi conclude l’intero corso.',
    unlockType: 'COURSE_COMPLETION' as const,
    defaultPoints: 150,
    icon: 'trophy',
  },
]

const ICON_OPTIONS = [
  { value: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { value: 'flag', label: 'Flag', icon: Flag },
  { value: 'trophy', label: 'Trophy', icon: Trophy },
  { value: 'star', label: 'Star', icon: Star },
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
  icon: string | null
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
    default:
      return ''
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
      <span className="text-xs text-muted-foreground">Leaderboard del corso</span>
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(ACHIEVEMENT_TEMPLATES[0].id)
  const [formState, setFormState] = useState<AchievementFormState>(() => ({
    title: ACHIEVEMENT_TEMPLATES[0].name,
    description: ACHIEVEMENT_TEMPLATES[0].description,
    unlockType: ACHIEVEMENT_TEMPLATES[0].unlockType,
    pointsReward: ACHIEVEMENT_TEMPLATES[0].defaultPoints,
    targetModuleId: null,
    icon: ACHIEVEMENT_TEMPLATES[0].icon,
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [busyAchievementId, setBusyAchievementId] = useState<string | null>(null)

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

  const resetDialogState = () => {
    setSelectedTemplateId(ACHIEVEMENT_TEMPLATES[0].id)
    setFormState({
      title: ACHIEVEMENT_TEMPLATES[0].name,
      description: ACHIEVEMENT_TEMPLATES[0].description,
      unlockType: ACHIEVEMENT_TEMPLATES[0].unlockType,
      pointsReward: ACHIEVEMENT_TEMPLATES[0].defaultPoints,
      targetModuleId: null,
      icon: ACHIEVEMENT_TEMPLATES[0].icon,
    })
  }

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetDialogState()
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = ACHIEVEMENT_TEMPLATES.find((item) => item.id === templateId)
    if (!template) return

    setSelectedTemplateId(template.id)
    setFormState((state) => ({
      ...state,
      title: template.name,
      description: template.description,
      unlockType: template.unlockType,
      pointsReward: template.defaultPoints,
      targetModuleId: template.requiresModule
        ? state.targetModuleId ?? modules[0]?.id ?? null
        : null,
      icon: template.icon,
    }))
  }

  const handleCreateAchievement = async () => {
    if (!formState.title.trim()) {
      toast.error('Aggiungi un titolo per l’achievement')
      return
    }

    if (selectedTemplate.requiresModule && !formState.targetModuleId) {
      toast.error('Seleziona un modulo per questo achievement')
      return
    }

    try {
      setIsSaving(true)
      const response = await axios.post<ApiAchievement>(
        `/api/courses/${courseId}/achievements`,
        {
          title: formState.title.trim(),
          description: formState.description.trim() || null,
          unlockType: formState.unlockType,
          targetModuleId: formState.targetModuleId,
          pointsReward: formState.pointsReward,
          icon: formState.icon,
        },
      )

      const mapped = mapAchievementResponse(response.data)

      onAchievementsChange((current) => [...current, mapped])
      toast.success('Achievement creato')
      setIsDialogOpen(false)
      resetDialogState()
    } catch (error) {
      console.error(error)
      toast.error('Impossibile creare l’achievement')
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
      toast.success(updated.isActive ? 'Achievement attivato' : 'Achievement disattivato')
    } catch (error) {
      console.error(error)
      toast.error('Non è stato possibile aggiornare l’achievement')
    } finally {
      setBusyAchievementId(null)
    }
  }

  const handleDeleteAchievement = async (achievement: CourseAchievement) => {
    const shouldDelete = window.confirm(`Vuoi eliminare “${achievement.title}”?`)
    if (!shouldDelete) return

    try {
      setBusyAchievementId(achievement.id)
      await axios.delete(`/api/courses/${courseId}/achievements/${achievement.id}`)
      onAchievementsChange((current) => current.filter((item) => item.id !== achievement.id))
      toast.success('Achievement eliminato')
    } catch (error) {
      console.error(error)
      toast.error('Non è stato possibile eliminare l’achievement')
    } finally {
      setBusyAchievementId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Achievement hub</h3>
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
              Nuovo achievement
            </Button>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Configura achievement</DialogTitle>
                <DialogDescription>Scegli un template e personalizza titolo, moduli e punti assegnati.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-2">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Template</Label>
                  <div className="grid gap-2 md:grid-cols-3">
                    {ACHIEVEMENT_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant={selectedTemplateId === template.id ? 'default' : 'outline'}
                        className="h-auto flex-col items-start gap-1 px-3 py-3 text-left"
                        onClick={() => handleTemplateSelect(template.id)}
                      >
                        <span className="text-sm font-semibold">{template.name}</span>
                        <span className="text-xs text-muted-foreground">{template.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Titolo</Label>
                    <Input
                      value={formState.title}
                      onChange={(event) =>
                        setFormState((state) => ({ ...state, title: event.target.value }))
                      }
                      placeholder="Es. Campione del kickoff"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrizione</Label>
                    <Textarea
                      value={formState.description}
                      onChange={(event) =>
                        setFormState((state) => ({ ...state, description: event.target.value }))
                      }
                      rows={3}
                      placeholder="Dai un contesto ai learner su come sbloccare il badge."
                    />
                  </div>

                  {selectedTemplate.requiresModule ? (
                    <div className="space-y-2">
                      <Label>Modulo di riferimento</Label>
                      <Select
                        value={formState.targetModuleId ?? ''}
                        onValueChange={(value) =>
                          setFormState((state) => ({ ...state, targetModuleId: value || null }))
                        }
                        disabled={modules.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un modulo" />
                        </SelectTrigger>
                        <SelectContent>
                          {modules.map((module) => (
                            <SelectItem key={module.id} value={module.id}>
                              {module.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {modules.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Crea prima almeno un modulo pubblicato per utilizzare questo template.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Punti assegnati</Label>
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Icona</Label>
                      <div className="flex flex-wrap gap-2">
                        {ICON_OPTIONS.map((iconOption) => {
                          const Icon = iconOption.icon
                          const isActive = formState.icon === iconOption.value
                          return (
                            <Button
                              key={iconOption.value}
                              type="button"
                              variant={isActive ? 'default' : 'outline'}
                              className="h-9 w-16 justify-center"
                              onClick={() => setFormState((state) => ({ ...state, icon: iconOption.value }))}
                            >
                              <Icon className="h-4 w-4" />
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Annulla
                </Button>
                <Button onClick={handleCreateAchievement} disabled={isSaving || (selectedTemplate.requiresModule && !formState.targetModuleId)}>
                  {isSaving ? 'Salvataggio…' : 'Crea achievement'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedAchievements.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-muted/20">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Nessun achievement ancora</CardTitle>
              <CardDescription>
                Aggiungi un achievement per guidare il comportamento desiderato e distribuire punti gamification.
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
                        <CardTitle className="text-base font-semibold text-foreground">
                          {achievement.title}
                        </CardTitle>
                        <CardDescription>{describeUnlock(achievement)}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={achievement.isActive ? 'default' : 'secondary'} className="uppercase text-[10px]">
                      {achievement.isActive ? 'Attivo' : 'Bozza'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {achievement.description ? <p>{achievement.description}</p> : null}
                    <p className="text-xs font-medium text-foreground">
                      +{achievement.pointsReward} pts
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
