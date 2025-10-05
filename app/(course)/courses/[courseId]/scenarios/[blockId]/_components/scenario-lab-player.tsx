"use client"

import { useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import type { ScenarioAttempt } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Loader2, ArrowRight, RefreshCw } from 'lucide-react'
import type { GeneratedScenarioPayload, GeneratedScenarioNode, GeneratedScenarioChoice } from '@/lib/gamification/types'

const getNextNodeId = (nodes: GeneratedScenarioNode[], currentId: string, override?: string | null) => {
  if (override) {
    const nextExists = nodes.some((node) => node.id === override)
    if (nextExists) return override
  }
  const index = nodes.findIndex((node) => node.id === currentId)
  if (index === -1) return null
  return nodes[index + 1]?.id ?? null
}

const formatRiskLabel = (value: number | null) => {
  if (value === null) return '—'
  if (value <= 30) return 'Low risk'
  if (value <= 70) return 'Moderate risk'
  return 'High risk'
}

type DecisionStep = {
  type: 'decision'
  nodeId: string
  choiceId: string
  label: string
  feedback: string
  impact: {
    score: number
    risk: number
    competencyTags: string[]
  }
}

type ReflectionStep = {
  type: 'reflection'
  nodeId: string
  response: string
  prompt: string | null
}

type ScenarioStep = DecisionStep | ReflectionStep

type ScenarioLabPlayerProps = {
  blockId: string
  scenario: GeneratedScenarioPayload
  latestAttempt: ScenarioAttempt | null
}

export function ScenarioLabPlayer({ blockId, scenario, latestAttempt }: ScenarioLabPlayerProps) {
  const [currentNodeId, setCurrentNodeId] = useState<string>(scenario.nodes[0]?.id ?? '')
  const [steps, setSteps] = useState<ScenarioStep[]>([])
  const [pendingChoice, setPendingChoice] = useState<GeneratedScenarioChoice | null>(null)
  const [reflectionDraft, setReflectionDraft] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const initialAttemptMeta = latestAttempt
    ? { id: latestAttempt.id, createdAt: new Date(latestAttempt.createdAt).toISOString() }
    : null
  const [attemptMeta, setAttemptMeta] = useState<{ id: string; createdAt: string } | null>(initialAttemptMeta)
  const [attemptMetrics, setAttemptMetrics] = useState<{ score: number; riskLevel: number | null; competencyTags: string[]; pointsAwarded: number } | null>(null)

  const nodeMap = useMemo(() => new Map(scenario.nodes.map((node) => [node.id, node])), [scenario.nodes])
  const currentNode = currentNodeId ? nodeMap.get(currentNodeId) ?? null : null
  const totalSteps = scenario.nodes.length
  const completedCount = steps.length
  const progressValue = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0

  const decisionSteps = steps.filter((step): step is DecisionStep => step.type === 'decision')
  const totalScore = decisionSteps.reduce((acc, step) => acc + step.impact.score, 0)
  const averageRisk = decisionSteps.length > 0
    ? Math.round(decisionSteps.reduce((acc, step) => acc + step.impact.risk, 0) / decisionSteps.length)
    : null
  const competencyTags = Array.from(new Set(decisionSteps.flatMap((step) => step.impact.competencyTags)))

  const resetLab = () => {
    setSteps([])
    setPendingChoice(null)
    setReflectionDraft('')
    setCurrentNodeId(scenario.nodes[0]?.id ?? '')
    setIsComplete(false)
    setAttemptMetrics(null)
  }

  const handleSelectChoice = (choice: GeneratedScenarioChoice) => {
    setPendingChoice(choice)
  }

  const handleConfirmChoice = () => {
    if (!currentNode || !pendingChoice) return

    const newStep: DecisionStep = {
      type: 'decision',
      nodeId: currentNode.id,
      choiceId: pendingChoice.id,
      label: pendingChoice.label,
      feedback: pendingChoice.feedback,
      impact: {
        score: typeof pendingChoice.impact?.score === 'number' ? pendingChoice.impact.score : 0,
        risk: typeof pendingChoice.impact?.risk === 'number' ? pendingChoice.impact.risk : 0,
        competencyTags: pendingChoice.impact?.competencyTags ?? [],
      },
    }

    const nextNodeId = getNextNodeId(scenario.nodes, currentNode.id, pendingChoice.nextNodeId)

    setSteps((prev) => [...prev, newStep])
    setPendingChoice(null)

    if (nextNodeId) {
      setCurrentNodeId(nextNodeId)
    } else {
      setCurrentNodeId('')
      setIsComplete(true)
    }
  }

  const handleConfirmReflection = () => {
    if (!currentNode) return
    const responseText = reflectionDraft.trim()

    const newStep: ReflectionStep = {
      type: 'reflection',
      nodeId: currentNode.id,
      response: responseText,
      prompt: currentNode.prompt ?? currentNode.situation,
    }

    const nextNodeId = getNextNodeId(scenario.nodes, currentNode.id)

    setSteps((prev) => [...prev, newStep])
    setReflectionDraft('')

    if (nextNodeId) {
      setCurrentNodeId(nextNodeId)
    } else {
      setCurrentNodeId('')
      setIsComplete(true)
    }
  }

  const handleSubmit = async () => {
    if (!isComplete || submitting) return

    setSubmitting(true)
    try {
      const payload = {
        path: steps.map((step) =>
          step.type === 'decision'
            ? { nodeId: step.nodeId, choiceId: step.choiceId }
            : { nodeId: step.nodeId, reflection: step.response },
        ),
      }
      const response = await axios.post(`/api/scenarios/${blockId}/attempts`, payload)
      const { attempt, metrics } = response.data as {
        attempt: ScenarioAttempt
        metrics: { score: number; riskLevel: number | null; competencyTags: string[]; pointsAwarded: number }
      }
      setAttemptMeta({ id: attempt.id, createdAt: new Date(attempt.createdAt).toISOString() })
      setAttemptMetrics(metrics)
      toast.success('Decision Lab submitted')
    } catch (error) {
      toast.error('Unable to submit attempt')
    } finally {
      setSubmitting(false)
    }
  }

  const lastAttemptBadge = attemptMeta ? (
    <Badge variant="secondary" className="text-xs">
      Last attempt: {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(attemptMeta.createdAt))}
    </Badge>
  ) : null

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Decision Lab</h1>
        <p className="text-sm text-muted-foreground">{scenario.intro}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{totalSteps} steps</Badge>
          {scenario.estimatedDurationMinutes ? (
            <Badge variant="outline">~{scenario.estimatedDurationMinutes} min</Badge>
          ) : null}
          {lastAttemptBadge}
        </div>
      </div>

      <Card className="border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base font-semibold">Learning objectives</CardTitle>
          <p className="text-xs text-muted-foreground">
            Focus on the behaviours highlighted below while you navigate each decision.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {scenario.objectives.map((objective) => (
            <div key={objective} className="flex items-start gap-2 text-sm text-foreground">
              <ArrowRight className="mt-1 h-3 w-3 text-[#5D62E1]" /> {objective}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{completedCount} of {totalSteps}</span>
        </div>
        <Progress value={progressValue} className="h-2" />
      </div>

      {!isComplete && currentNode ? (
        <Card className="border border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Step {completedCount + 1} of {totalSteps}</span>
              <span>{currentNode.type === 'decision' ? 'Decision point' : 'Reflection'}</span>
            </div>
            <CardTitle className="text-lg font-semibold text-foreground">
              {currentNode.headline ?? currentNode.situation}
            </CardTitle>
            {currentNode.narrative ? (
              <p className="text-sm text-muted-foreground">{currentNode.narrative}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {currentNode.type === 'decision' && currentNode.choices ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  {currentNode.choices.map((choice) => {
                    const isSelected = pendingChoice?.id === choice.id
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => handleSelectChoice(choice)}
                        className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-[#5D62E1] bg-[#5D62E1]/5 text-foreground shadow-sm'
                            : 'border-border/50 bg-background/60 hover:border-[#5D62E1]/40 hover:bg-[#5D62E1]/5'
                        }`}
                      >
                        <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                        {choice.impact?.summary ? (
                          <span className="mt-1 block text-xs text-muted-foreground">{choice.impact.summary}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
                {pendingChoice ? (
                  <div className="rounded-md border border-[#5D62E1]/40 bg-[#5D62E1]/5 p-3 text-xs text-foreground">
                    {pendingChoice.feedback}
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmChoice}
                    disabled={!pendingChoice}
                  >
                    Continue
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingChoice(null)}
                    disabled={!pendingChoice}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{currentNode.prompt ?? 'Take a moment to reflect and capture your reasoning.'}</p>
                <Textarea
                  value={reflectionDraft}
                  onChange={(event) => setReflectionDraft(event.target.value)}
                  placeholder="Write your reflection here"
                  rows={4}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmReflection}
                  disabled={reflectionDraft.trim().length < 3}
                >
                  Continue
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base font-semibold text-foreground">Your trajectory</CardTitle>
          <p className="text-xs text-muted-foreground">Score updates after each decision. Risk reflects the average criticality of your choices.</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/50 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Decision score</p>
              <p className="text-lg font-semibold text-foreground">{totalScore}</p>
            </div>
            <div className="rounded-md border border-border/50 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Risk level</p>
              <p className="text-lg font-semibold text-foreground">{formatRiskLabel(averageRisk)}</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Competency signals</p>
            {competencyTags.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {competencyTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No competency tags surfaced yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {isComplete ? (
        <Card className="border border-emerald-200 bg-emerald-50/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold text-emerald-900">Debrief</CardTitle>
            <p className="text-xs text-emerald-700">Review the coaching prompts before submitting.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-emerald-900">
            <p>{scenario.debrief.summary}</p>
            {scenario.debrief.coachingPoints?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Coaching points</p>
                <ul className="ml-4 list-disc space-y-1">
                  {scenario.debrief.coachingPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {scenario.debrief.followUpQuestions?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Reflection prompts</p>
                <ul className="ml-4 list-disc space-y-1">
                  {scenario.debrief.followUpQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit attempt
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetLab} disabled={submitting}>
                <RefreshCw className="mr-2 h-4 w-4" /> Restart
              </Button>
            </div>
            {attemptMetrics ? (
              <div className="rounded-md border border-emerald-200 bg-white/80 p-3 text-xs text-emerald-900">
                <p className="font-semibold">Attempt recorded</p>
                <p>Score: {attemptMetrics.score} · Risk: {formatRiskLabel(attemptMetrics.riskLevel)}</p>
                <p>Points awarded: {attemptMetrics.pointsAwarded}</p>
                {attemptMetrics.competencyTags.length ? (
                  <p>Focus areas: {attemptMetrics.competencyTags.join(', ')}</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
