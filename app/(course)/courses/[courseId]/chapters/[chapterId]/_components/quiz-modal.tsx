'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import type { Quiz, QuizQuestion, QuizOption, QuizAttempt } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ChevronLeft, ChevronRight, X, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuizModalProps {
  blockId: string
  courseId: string
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

type QuizWithRelations = Quiz & {
  questions: (QuizQuestion & { options: QuizOption[] })[]
}

export function QuizModal({ blockId, courseId, isOpen, onClose, onComplete }: QuizModalProps) {
  const [quiz, setQuiz] = useState<QuizWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, { selectedOptionIds?: string[]; freeText?: string }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Check if component is mounted (client-side only)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Fetch quiz data when modal opens
  useEffect(() => {
    if (!isOpen || !blockId) return

    let cancelled = false
    const fetchQuiz = async () => {
      try {
        setLoading(true)
        const { data } = await axios.get(`/api/blocks/${blockId}/quiz`)
        if (!cancelled) {
          setQuiz(data)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error('Errore nel caricamento del quiz')
          onClose()
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchQuiz()

    return () => {
      cancelled = true
    }
  }, [isOpen, blockId, onClose])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuiz(null)
      setAttempt(null)
      setAnswers({})
      setCurrentIndex(0)
      setShowSuccess(false)
    }
  }, [isOpen])

  const onStartAttempt = useCallback(async () => {
    if (!quiz) return
    try {
      const res = await axios.post<QuizAttempt>(`/api/quizzes/${quiz.id}/attempts`)
      setAttempt(res.data)
    } catch (error: any) {
      if (error.response?.status === 400) {
        toast.error('Hai raggiunto il numero massimo di tentativi per questo quiz')
      } else {
        toast.error('Impossibile iniziare il tentativo')
      }
      // Close modal after showing error
      setTimeout(() => {
        onClose()
      }, 2000)
    }
  }, [quiz, onClose])

  const toggleOption = useCallback((questionId: string, optionId: string, multi: boolean) => {
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
  }, [])

  const onChangeFreeText = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], freeText: value } }))
  }, [])

  const onSubmit = useCallback(async () => {
    if (!attempt || !quiz) return
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

      if (res.data.passed) {
        setShowSuccess(true)
        toast.success('Quiz superato!')
        setTimeout(() => {
          onComplete?.()
          onClose()
        }, 2000)
      } else {
        toast.error(`Non hai superato il quiz. Punteggio: ${res.data.score}%`)
        setTimeout(() => {
          onClose()
        }, 1500)
      }
    } catch {
      toast.error('Errore durante l\'invio del quiz')
    } finally {
      setSubmitting(false)
    }
  }, [attempt, quiz, answers, onComplete, onClose])

  const totalQuestions = quiz?.questions.length ?? 0
  const currentQuestion = quiz?.questions[currentIndex]
  const progressValue = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0
  const canSubmit = useMemo(() => !!attempt, [attempt])

  const goPrev = useCallback(() => setCurrentIndex((i) => Math.max(0, i - 1)), [])
  const goNext = useCallback(() => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1)), [totalQuestions])

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-[10000] w-full max-w-2xl max-h-[85vh] mx-4 bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {loading ? 'Caricamento...' : quiz?.title ?? 'Quiz'}
            </h2>
            {quiz && !loading && (
              <p className="text-xs text-gray-500 mt-0.5">
                Domanda {currentIndex + 1} di {totalQuestions} • Punteggio minimo: {quiz.passScore}%
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        {quiz && !loading && (
          <div className="px-6 py-3 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <Progress value={progressValue} className="h-1.5 flex-1" />
              <span className="text-xs font-medium text-gray-600 min-w-[3ch]">{progressValue}%</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#5D62E1]" />
              <p className="text-sm text-gray-500">Caricamento del quiz...</p>
            </div>
          ) : showSuccess ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 animate-in zoom-in duration-500">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Quiz completato!</h3>
              <p className="text-sm text-gray-600">Torno al video...</p>
            </div>
          ) : !attempt ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-[#5D62E1]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#5D62E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Pronto per iniziare?</h3>
                <p className="text-sm text-gray-600 max-w-sm">
                  Completa questo quiz per continuare con il video. Avrai {quiz?.maxAttempts ?? '∞'} {quiz?.maxAttempts === 1 ? 'tentativo' : 'tentativi'}.
                </p>
              </div>
              <Button
                onClick={onStartAttempt}
                className="h-11 px-8 bg-[#5D62E1] hover:bg-[#5D62E1]/90 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all"
              >
                Inizia quiz
              </Button>
            </div>
          ) : currentQuestion ? (
            <div className="space-y-6">
              {/* Question */}
              <div className="space-y-3">
                <h3 className="text-base font-medium text-gray-900 leading-relaxed">
                  {currentQuestion.text}
                </h3>
                <p className="text-xs text-gray-500">
                  {currentQuestion.type === 'MULTIPLE_CHOICE'
                    ? 'Seleziona una o più risposte'
                    : currentQuestion.type === 'TRUE_FALSE'
                    ? 'Seleziona vero o falso'
                    : 'Inserisci la tua risposta'}
                </p>
              </div>

              {/* Options */}
              {currentQuestion.type === 'SHORT_ANSWER' ? (
                <Input
                  value={answers[currentQuestion.id]?.freeText ?? ''}
                  onChange={(e) => onChangeFreeText(currentQuestion.id, e.target.value)}
                  placeholder="Scrivi la tua risposta qui..."
                  className="h-12 px-4 border-gray-200 focus-visible:ring-[#5D62E1] rounded-xl"
                />
              ) : (
                <div className="space-y-3">
                  {currentQuestion.options.map((option) => {
                    const selected = new Set(answers[currentQuestion.id]?.selectedOptionIds ?? [])
                    const isMulti = currentQuestion.type === 'MULTIPLE_CHOICE'
                    const isChecked = selected.has(option.id)
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'group flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-all duration-200',
                          isChecked
                            ? 'border-[#5D62E1] bg-[#5D62E1]/5 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        )}
                      >
                        <input
                          className="sr-only"
                          type={isMulti ? 'checkbox' : 'radio'}
                          name={`q_${currentQuestion.id}`}
                          checked={isChecked}
                          onChange={() => toggleOption(currentQuestion.id, option.id, isMulti)}
                        />
                        <span
                          className={cn(
                            'flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all',
                            isChecked
                              ? 'border-[#5D62E1] bg-[#5D62E1]'
                              : 'border-gray-300 bg-white group-hover:border-gray-400'
                          )}
                        >
                          {isChecked && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span className={cn(
                          'flex-1 text-sm leading-relaxed transition-colors',
                          isChecked ? 'text-gray-900 font-medium' : 'text-gray-700'
                        )}>
                          {option.text}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {attempt && !showSuccess && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
              Precedente
            </Button>

            {currentIndex < totalQuestions - 1 ? (
              <Button
                size="sm"
                onClick={goNext}
                className="gap-2 bg-[#5D62E1] hover:bg-[#5D62E1]/90 text-white rounded-lg px-6"
              >
                Prossima
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!canSubmit || submitting}
                onClick={onSubmit}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-6 font-medium"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Invio...
                  </>
                ) : (
                  'Invia quiz'
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
