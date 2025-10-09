"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Loader2, Sparkles, Repeat, Target, TrendingUp, PenSquare } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import type { GeneratedArenaPayload } from '@/lib/gamification/types'

const MIN_PLAN_WORDS = 40

type ArenaAttempt = {
  id: string
  score: number
  insightTokens: number
  reflections: unknown
  path: unknown
  createdAt: string
}

type ArenaEvaluationReflections = {
  evaluation?: {
    overallScore: number
    axes: Array<{ axisId: string; label: string; score: number; evidence: string; suggestion: string }>
    summary: string
    improvementAdvice: string
  }
  previousScore?: number
  scoreDelta?: number
  tokensAwarded?: number
  endorsements?: Array<{ profileId?: string; name?: string; createdAt?: string }>
}

type PracticeArenaPlayerProps = {
  blockId: string
  arena: GeneratedArenaPayload
  attempts: ArenaAttempt[]
  contextConfig?: {
    contextLabel?: string
    audience?: string
    mustInclude?: string
  }
}

const extractPlanFromPath = (path: unknown): string => {
  if (!Array.isArray(path)) return ''
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const entry = path[index]
    if (entry && typeof entry === 'object' && 'plan' in entry && typeof (entry as { plan?: unknown }).plan === 'string') {
      return ((entry as { plan?: string }).plan ?? '').trim()
    }
  }
  return ''
}

const parseReflections = (value: unknown): ArenaEvaluationReflections | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const evaluation = record.evaluation && typeof record.evaluation === 'object' ? (record.evaluation as ArenaEvaluationReflections['evaluation']) : undefined
  const previousScore = typeof record.previousScore === 'number' ? record.previousScore : undefined
  const scoreDelta = typeof record.scoreDelta === 'number' ? record.scoreDelta : undefined
  const tokensAwarded = typeof record.tokensAwarded === 'number' ? record.tokensAwarded : undefined
  const endorsements = Array.isArray(record.endorsements)
    ? (record.endorsements as Array<Record<string, unknown>>).map((entry) => ({
        profileId: typeof entry.profileId === 'string' ? entry.profileId : undefined,
        name: typeof entry.name === 'string' ? entry.name : undefined,
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : undefined,
      }))
    : undefined
  return {
    evaluation,
    previousScore,
    scoreDelta,
    tokensAwarded,
    endorsements,
  }
}

export function PracticeArenaPlayer({ blockId, arena, attempts, contextConfig }: PracticeArenaPlayerProps) {
  const router = useRouter()
  const latestAttempt = attempts[0] ?? null
  const latestEvaluation = parseReflections(latestAttempt?.reflections ?? null)?.evaluation ?? null
  const latestPlan = latestAttempt ? extractPlanFromPath(latestAttempt.path) : ''

  const [planDraft, setPlanDraft] = useState(latestPlan)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastEvaluation, setLastEvaluation] = useState(latestEvaluation)
  const [tokensAwarded, setTokensAwarded] = useState(parseReflections(latestAttempt?.reflections ?? null)?.tokensAwarded ?? latestAttempt?.insightTokens ?? 0)
  const [scoreDelta, setScoreDelta] = useState(parseReflections(latestAttempt?.reflections ?? null)?.scoreDelta ?? 0)
  const [overallScore, setOverallScore] = useState(latestAttempt?.score ?? lastEvaluation?.overallScore ?? 0)

  const attemptCount = attempts.length
  const planWordCount = planDraft.trim().split(/\s+/).filter(Boolean).length
  const contextLabel = typeof contextConfig?.contextLabel === 'string' ? contextConfig.contextLabel.trim() : ''
  const contextAudience = typeof contextConfig?.audience === 'string' ? contextConfig.audience.trim() : ''
  const contextMustInclude = typeof contextConfig?.mustInclude === 'string' ? contextConfig.mustInclude.trim() : ''

  const handleSubmit = async () => {
    if (planWordCount < MIN_PLAN_WORDS) {
      toast.error(`Scrivi almeno ${MIN_PLAN_WORDS} parole per ottenere un coaching utile.`)
      return
    }
    setIsSubmitting(true)
    try {
      const response = await axios.post(`/api/arenas/${blockId}/attempts`, {
        plan: planDraft,
      })
      const { evaluation, tokensAwarded: awarded, scoreDelta: delta, attempt } = response.data as {
        evaluation: ArenaEvaluationReflections['evaluation']
        tokensAwarded: number
        scoreDelta: number
        attempt: { score: number; reflections: unknown; insightTokens: number }
      }
      setLastEvaluation(evaluation ?? null)
      setOverallScore(attempt.score ?? 0)
      setTokensAwarded(awarded)
      setScoreDelta(delta)
      router.refresh()
      toast.success(awarded > 0 ? `Hai guadagnato ${awarded} Insight Tokens!` : 'Piano aggiornato. Continua a iterare!')
    } catch {
      toast.error('Non è stato possibile valutare il piano. Riprova più tardi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetDraft = () => {
    setPlanDraft('')
  }

  const reUseLastPlan = () => {
    setPlanDraft(latestPlan)
  }

  const evaluationAxes = lastEvaluation?.axes ?? arena.axes.map((axis) => ({ axisId: axis.id, label: axis.label, score: 0, evidence: '', suggestion: '' }))

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Practice Arena</h1>
        <p className="text-sm text-muted-foreground">{arena.scenarioBrief}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {contextLabel ? <Badge variant="outline">{contextLabel}</Badge> : null}
          {contextAudience ? <Badge variant="outline">Per {contextAudience}</Badge> : null}
          <Badge variant="outline">{arena.axes.length} assi di valutazione</Badge>
          {arena.estimatedDurationMinutes ? <Badge variant="outline">~{arena.estimatedDurationMinutes} min</Badge> : null}
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> Tokens base {arena.tokens.baseAward}
          </Badge>
          {attemptCount > 0 ? <Badge variant="outline">{attemptCount} tentativi</Badge> : null}
        </div>
      </div>

      <Card className="border border-border/60 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Brief operativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="text-xs font-semibold uppercase text-foreground/70">Focus principale</p>
            <p className="mt-1 text-sm text-foreground">{arena.challenge}</p>
          </div>
          <Separator />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-foreground/70">Obiettivi da centrare</p>
              <ul className="mt-2 space-y-1 text-sm">
                {arena.objectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-2">
                    <Target className="mt-0.5 h-3 w-3 text-primary" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-foreground/70">Sezioni attese nel piano</p>
              <p className="mt-2 text-sm text-foreground">{arena.expectedSections.join(' · ')}</p>
              {arena.aiCoachTips.length > 0 ? (
                <p className="mt-3 text-xs">Suggerimenti HR: {arena.aiCoachTips.join(' · ')}</p>
              ) : null}
              {contextMustInclude ? (
                <p className="mt-3 text-xs">
                  Elementi obbligatori: <span className="font-semibold text-foreground/90">{contextMustInclude}</span>
                </p>
              ) : null}
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-foreground/70">Rubrica di valutazione</p>
            <div className="space-y-3">
              {arena.axes.map((axis) => (
                <div key={axis.id} className="rounded-md border border-border/50 bg-background/70 p-3 text-xs">
                  <div className="flex items-center justify-between text-foreground">
                    <span className="font-semibold">{axis.label}</span>
                    {typeof axis.weight === 'number' ? <span className="text-muted-foreground">Peso {axis.weight}</span> : null}
                  </div>
                  {axis.description ? <p className="mt-1 text-muted-foreground">{axis.description}</p> : null}
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {axis.levels.excels ? <li><strong>Eccellenza:</strong> {axis.levels.excels}</li> : null}
                    {axis.levels.solid ? <li><strong>Solido:</strong> {axis.levels.solid}</li> : null}
                    {axis.levels.needsSupport ? <li><strong>Da migliorare:</strong> {axis.levels.needsSupport}</li> : null}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Il tuo piano d&apos;azione</CardTitle>
            <p className="text-xs text-muted-foreground">Scrivi un piano concreto (max 300 parole) e poi miglioralo con il feedback AI.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{planWordCount} parole</Badge>
            <Button type="button" variant="ghost" size="xs" onClick={reUseLastPlan} disabled={!latestPlan}>
              <Repeat className="mr-1 h-3 w-3" /> Riprendi ultimo piano
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={resetDraft}>
              <PenSquare className="mr-1 h-3 w-3" /> Nuovo foglio
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={planDraft}
            onChange={(event) => setPlanDraft(event.target.value)}
            placeholder={arena.submissionPrompt}
            rows={10}
            className="text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />} Valuta piano
            </Button>
            <span className="text-xs text-muted-foreground">
              Migliora il punteggio rispetto al tentativo precedente per guadagnare Insight Tokens extra.
            </span>
          </div>
        </CardContent>
      </Card>

      {lastEvaluation ? (
        <Card className="border border-emerald-600/40 bg-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-900">
              <Sparkles className="h-4 w-4" /> Coaching personalizzato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-emerald-900/80">Punteggio complessivo</p>
              <div className="flex items-center gap-3">
                <div className="w-full max-w-[220px]">
                  <Progress value={overallScore} className="h-2" />
                  <p className="mt-1 text-xs text-emerald-900/80">{overallScore}/100</p>
                </div>
                <Badge variant="secondary" className="bg-white text-emerald-900">
                  {scoreDelta >= 0 ? '+' : ''}{scoreDelta} vs ultimo tentativo
                </Badge>
                <Badge variant="secondary" className="bg-white text-emerald-900">
                  Tokens guadagnati: {tokensAwarded}
                </Badge>
              </div>
            </div>
            <Separator className="bg-emerald-200" />
            <div className="grid gap-3 md:grid-cols-2">
              {evaluationAxes.map((axis) => (
                <div key={axis.axisId} className="rounded-md border border-emerald-200 bg-white/60 p-3 text-xs text-emerald-900">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{axis.label}</span>
                    <span>{axis.score}/100</span>
                  </div>
                  <Progress value={axis.score} className="mt-2 h-2" />
                  {axis.evidence ? <p className="mt-2 text-[11px]">{axis.evidence}</p> : null}
                  {axis.suggestion ? <p className="mt-1 text-[11px] text-emerald-700">Suggerimento: {axis.suggestion}</p> : null}
                </div>
              ))}
            </div>
            <Separator className="bg-emerald-200" />
            {lastEvaluation.summary ? (
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-900/80">Sintesi coach</p>
                <p className="mt-1 text-sm text-emerald-900">{lastEvaluation.summary}</p>
              </div>
            ) : null}
            {lastEvaluation.improvementAdvice ? (
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-900/80">Prossimo step suggerito</p>
                <p className="mt-1 text-sm text-emerald-900">{lastEvaluation.improvementAdvice}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border border-border/60 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Cronologia tentativi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          {attempts.length === 0 ? (
            <p>Ancora nessun tentativo salvato. Invia il tuo primo piano per vedere il progresso.</p>
          ) : (
            attempts.map((attempt) => {
              const reflections = parseReflections(attempt.reflections)
              const date = new Date(attempt.createdAt)
              const endorsementCount = reflections?.endorsements?.length ?? 0
              return (
                <div key={attempt.id} className="rounded-md border border-border/40 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-foreground">
                    <span className="font-semibold">Tentativo del {new Intl.DateTimeFormat('it', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">Score {attempt.score}/100</Badge>
                      <Badge variant="outline">Tokens {attempt.insightTokens}</Badge>
                      {endorsementCount > 0 ? (
                        <Badge variant="secondary">Endorsement {endorsementCount}</Badge>
                      ) : null}
                    </div>
                  </div>
                  {reflections?.evaluation?.summary ? (
                    <p className="mt-2 text-xs">
                      {reflections.evaluation.summary}
                    </p>
                  ) : null}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
