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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
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

  const displayScore = attemptCount > 0 ? overallScore : arena.tokens.baseAward

  return (
    <div className="space-y-6">
      <Card className="relative overflow-visible border border-border/60 bg-card/80 shadow-sm">
        <CardContent className="pt-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold leading-tight text-foreground">
                {arena.title}
              </h1>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{arena.scenarioBrief}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {contextLabel ? <Badge variant="outline">{contextLabel}</Badge> : null}
                {contextAudience ? <Badge variant="outline">Per {contextAudience}</Badge> : null}
                <Badge variant="outline">{arena.axes.length} assi</Badge>
                {arena.estimatedDurationMinutes ? <Badge variant="outline">~{arena.estimatedDurationMinutes} min</Badge> : null}
                {attemptCount > 0 ? <Badge variant="outline">{attemptCount} tentativi</Badge> : null}
              </div>
            </div>
            <button
              type="button"
              disabled
              aria-label="Score badge"
              className="pointer-events-none absolute -top-4 -right-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border"
            >
              <span className="text-lg font-semibold">{displayScore}</span>
            </button>
          </div>
        </CardContent>
      </Card>


      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,380px)]">
        <div className="space-y-6">
      <Card className="border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Il tuo piano d&apos;azione</CardTitle>
            <p className="text-xs text-muted-foreground">Scrivi il piano (max 300 parole), poi miglioralo con il feedback.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{planWordCount} parole</Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={reUseLastPlan}
              disabled={!latestPlan}
              aria-label="Riprendi ultimo piano"
              title="Riprendi ultimo piano"
              className="transition-colors"
            >
              <Repeat className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={resetDraft}
              aria-label="Nuovo foglio"
              title="Nuovo foglio"
              className="transition-colors"
            >
              <PenSquare className="h-4 w-4" />
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
        <Card className="border border-border/60 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Coaching personalizzato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Punteggio complessivo</p>
              <div className="flex items-center gap-3">
                <div className="w-full max-w-[220px]">
                  <Progress value={overallScore} className="h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">{overallScore}/100</p>
                </div>
                <Badge variant="secondary">
                  {scoreDelta >= 0 ? '+' : ''}{scoreDelta} vs ultimo tentativo
                </Badge>
                <Badge variant="secondary">Tokens: {tokensAwarded}</Badge>
              </div>
            </div>
            <Separator />
            <div className="grid gap-3 md:grid-cols-2">
              {evaluationAxes.map((axis) => (
                <div key={axis.axisId} className="rounded-md border border-border/50 bg-background/70 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{axis.label}</span>
                    <span className="text-muted-foreground">{axis.score}/100</span>
                  </div>
                  <Progress value={axis.score} className="mt-2 h-2" />
                  {axis.evidence ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">{axis.evidence}</p>
                  ) : null}
                  {axis.suggestion ? (
                    <p className="mt-1 text-[11px]">Suggerimento: {axis.suggestion}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <Separator />
            {lastEvaluation.summary ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Sintesi coach</p>
                <p className="mt-1 text-sm">{lastEvaluation.summary}</p>
              </div>
            ) : null}
            {lastEvaluation.improvementAdvice ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Prossimo step suggerito</p>
                <p className="mt-1 text-sm">{lastEvaluation.improvementAdvice}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border border-border/60 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Cronologia</CardTitle>
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
                <div key={attempt.id} className="relative border-l border-border/50 pl-4">
                  <span className="absolute -left-1 top-3 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                  <div className="rounded-md border border-border/40 bg-background/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-foreground">
                      <span className="font-medium">{new Intl.DateTimeFormat('it', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">Score {attempt.score}/100</Badge>
                        <Badge variant="outline">Tokens {attempt.insightTokens}</Badge>
                        {endorsementCount > 0 ? (
                          <Badge variant="secondary">Endorsement {endorsementCount}</Badge>
                        ) : null}
                      </div>
                    </div>
                    {reflections?.evaluation?.summary ? (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {reflections.evaluation.summary}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
        </div>
        <div className="space-y-6">
          <Card className="border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Dettagli</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={['brief']}
              >
                <AccordionItem value="brief">
                  <AccordionTrigger>Brief operativo</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 text-sm text-muted-foreground">
                      <div>
                        <p className="text-xs font-medium text-foreground/70">Focus principale</p>
                        <p className="mt-1 text-foreground">{arena.challenge}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground/70">Obiettivi</p>
                        <ul className="mt-2 space-y-1">
                          {arena.objectives.map((objective) => (
                            <li key={objective} className="flex items-start gap-2">
                              <Target className="mt-0.5 h-3 w-3 text-primary" />
                              <span>{objective}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground/70">Sezioni attese</p>
                        <p className="mt-1 text-foreground">{arena.expectedSections.join(' · ')}</p>
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
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="rubric">
                  <AccordionTrigger>Rubrica di valutazione</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-xs">
                      {arena.axes.map((axis) => (
                        <div key={axis.id} className="rounded-md border border-border/50 bg-background/70 p-3">
                          <div className="flex items-center justify-between text-foreground">
                            <span className="font-medium">{axis.label}</span>
                            {typeof axis.weight === 'number' ? (
                              <span className="text-muted-foreground">Peso {axis.weight}</span>
                            ) : null}
                          </div>
                          {axis.description ? (
                            <p className="mt-1 text-muted-foreground">{axis.description}</p>
                          ) : null}
                          <ul className="mt-2 space-y-1 text-muted-foreground">
                            {axis.levels.excels ? (
                              <li>
                                <strong>Eccellenza:</strong> {axis.levels.excels}
                              </li>
                            ) : null}
                            {axis.levels.solid ? (
                              <li>
                                <strong>Solido:</strong> {axis.levels.solid}
                              </li>
                            ) : null}
                            {axis.levels.needsSupport ? (
                              <li>
                                <strong>Da migliorare:</strong> {axis.levels.needsSupport}
                              </li>
                            ) : null}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
