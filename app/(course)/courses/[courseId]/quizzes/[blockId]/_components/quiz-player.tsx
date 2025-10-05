"use client"

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import toast from 'react-hot-toast'
import type { Quiz, QuizQuestion, QuizOption, QuizAttempt } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type QuizPlayerProps = {
  quiz: Quiz & { questions: (QuizQuestion & { options: QuizOption[] })[] }
  courseId: string
}

export default function QuizPlayer({ quiz, courseId }: QuizPlayerProps) {
  const router = useRouter()
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, { selectedOptionIds?: string[]; freeText?: string }>>({})
  const [submitting, setSubmitting] = useState(false)

  const [currentIndex, setCurrentIndex] = useState(0)
  const totalQuestions = quiz.questions.length

  const onStartAttempt = async () => {
    try {
      const res = await axios.post<QuizAttempt>(`/api/quizzes/${quiz.id}/attempts`)
      setAttempt(res.data)
      toast.success('Tentativo iniziato')
    } catch {
      toast.error('Impossibile iniziare il tentativo')
    }
  }

  const toggleOption = (questionId: string, optionId: string, multi: boolean) => {
    setAnswers((prev) => {
      const prevSel = new Set(prev[questionId]?.selectedOptionIds ?? [])
      if (multi) {
        prevSel.has(optionId) ? prevSel.delete(optionId) : prevSel.add(optionId)
      } else {
        if (prevSel.has(optionId) && prevSel.size === 1) {
          prevSel.clear()
        } else {
          return { ...prev, [questionId]: { selectedOptionIds: [optionId] } }
        }
      }
      return { ...prev, [questionId]: { selectedOptionIds: Array.from(prevSel) } }
    })
  }

  const onChangeFreeText = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], freeText: value } }))
  }

  const onSubmit = async () => {
    if (!attempt) return
    setSubmitting(true)
    try {
      const payload = {
        answers: quiz.questions.map((q) => ({
          questionId: q.id,
          selectedOptionIds: answers[q.id]?.selectedOptionIds ?? [],
          freeText: answers[q.id]?.freeText ?? undefined,
        })),
      }
      const res = await axios.post(`/api/quizzes/${quiz.id}/attempts/${attempt.id}/submit`, payload)
      toast.success(res.data.passed ? 'Quiz superato!' : 'Quiz inviato')
      router.push(`/courses/${courseId}/quizzes/${quiz.id}/results/${attempt.id}`)
    } catch {
      toast.error('Errore durante l\'invio del quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = useMemo(() => !!attempt, [attempt])

  const currentQuestion = quiz.questions[currentIndex]
  const progressValue = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1))
  const goNext = () => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{quiz.title}</h1>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span>Pass score: {quiz.passScore}%</span>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progressValue} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">{progressValue}%</span>
        </div>
      </div>

      {!attempt ? (
        <Button onClick={onStartAttempt} variant="default">Inizia tentativo</Button>
      ) : null}

      {currentQuestion && (
        <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">{currentIndex + 1}. {currentQuestion.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {currentQuestion.type === 'SHORT_ANSWER' ? (
              <Input
                value={answers[currentQuestion.id]?.freeText ?? ''}
                onChange={(e) => onChangeFreeText(currentQuestion.id, e.target.value)}
                placeholder="Risposta breve"
              />
            ) : (
              <div className="space-y-2">
                {currentQuestion.options.map((o) => {
                  const selected = new Set(answers[currentQuestion.id]?.selectedOptionIds ?? [])
                  const isMulti = currentQuestion.type === 'MULTIPLE_CHOICE'
                  const isChecked = selected.has(o.id)
                  return (
                    <label
                      key={o.id}
                      data-selected={isChecked}
                      className="group flex cursor-pointer items-center gap-3 rounded-md border border-border/50 bg-card/60 p-3 ring-1 ring-transparent transition hover:bg-muted/40 data-[selected=true]:bg-[#5D62E1]/5 data-[selected=true]:ring-[#5D62E1]/40"
                    >
                      <input
                        className="sr-only"
                        type={isMulti ? 'checkbox' : 'radio'}
                        name={`q_${currentQuestion.id}`}
                        checked={isChecked}
                        onChange={() => toggleOption(currentQuestion.id, o.id, isMulti)}
                      />
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${isChecked ? 'border-[#5D62E1] bg-[#5D62E1]' : 'border-border bg-background'}`}></span>
                      <span className="text-sm text-foreground">{o.text}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Precedente
        </Button>
        {currentIndex < totalQuestions - 1 ? (
          <Button variant="default" size="sm" onClick={goNext}>
            Prossima <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" disabled={!canSubmit || submitting} onClick={onSubmit}>
            Invia
          </Button>
        )}
      </div>
    </div>
  )
}
