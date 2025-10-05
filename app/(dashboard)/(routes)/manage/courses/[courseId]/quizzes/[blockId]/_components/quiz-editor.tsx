"use client"

import axios from 'axios'
import { useState } from 'react'
import { Quiz, QuizQuestion, QuizOption, QuizQuestionType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListChecks, CheckCircle2, Type, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function QuizEditor({
  courseId,
  blockId,
  quiz,
}: {
  courseId: string
  blockId: string
  quiz: Quiz & { questions: (QuizQuestion & { options: QuizOption[] })[] }
}) {
  const [state, setState] = useState(quiz)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState<{ question?: boolean; optionFor?: string }>({})

  const updateQuiz = async (patch: Partial<Quiz>) => {
    setState((s) => ({ ...s, ...patch }))
    try {
      setSaving(true)
      await axios.patch(`/api/quizzes/${quiz.id}`, patch)
      toast.success('Quiz salvato')
    } catch {
      toast.error('Errore nel salvataggio quiz')
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = async (template: QuizQuestionType = 'MULTIPLE_CHOICE') => {
    try {
      setCreating((c) => ({ ...c, question: true }))
      const res = await axios.post<QuizQuestion & { options: QuizOption[] }>(`/api/quizzes/${quiz.id}/questions`, {
        type: template,
      })
      setState((s) => ({ ...s, questions: [...s.questions, res.data] }))
    } catch {
      toast.error('Impossibile creare la domanda')
    } finally {
      setCreating((c) => ({ ...c, question: false }))
    }
  }

  const updateQuestion = async (questionId: string, patch: Partial<QuizQuestion>) => {
    setState((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    }))
    try {
      await axios.patch(`/api/quizzes/${quiz.id}/questions/${questionId}`, patch)
    } catch {
      toast.error('Errore nel salvataggio della domanda')
    }
  }

  const removeQuestion = async (questionId: string) => {
    const prev = state.questions
    setState((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== questionId) }))
    try {
      await axios.delete(`/api/quizzes/${quiz.id}/questions/${questionId}`)
      toast.success('Domanda eliminata')
    } catch {
      setState((s) => ({ ...s, questions: prev }))
      toast.error('Errore nell\'eliminazione')
    }
  }

  const addOption = async (questionId: string) => {
    try {
      setCreating((c) => ({ ...c, optionFor: questionId }))
      const res = await axios.post<QuizOption>(`/api/quizzes/${quiz.id}/questions/${questionId}/options`, {
        text: 'Nuova opzione',
      })
      setState((s) => ({
        ...s,
        questions: s.questions.map((q) => (q.id === questionId ? { ...q, options: [...q.options, res.data] } : q)),
      }))
    } catch {
      toast.error('Impossibile aggiungere opzione')
    } finally {
      setCreating((c) => ({ ...c, optionFor: undefined }))
    }
  }

  const updateOption = async (questionId: string, optionId: string, patch: Partial<QuizOption>) => {
    setState((s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
          : q,
      ),
    }))
    try {
      await axios.patch(`/api/quizzes/${quiz.id}/questions/${questionId}/options/${optionId}`, patch)
    } catch {
      toast.error('Errore nel salvataggio opzione')
    }
  }

  const removeOption = async (questionId: string, optionId: string) => {
    const prev = state.questions
      .map((q) => ({ ...q, options: [...q.options] }))
    setState((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.id === questionId ? { ...q, options: q.options.filter((o) => o.id !== optionId) } : q)),
    }))
    try {
      await axios.delete(`/api/quizzes/${quiz.id}/questions/${questionId}/options/${optionId}`)
    } catch {
      setState((s) => ({ ...s, questions: prev }))
      toast.error('Errore nell\'eliminazione opzione')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Impostazioni quiz</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Titolo</label>
            <Input value={state.title} onChange={(e) => updateQuiz({ title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Punteggio per superare (%)</label>
            <Input type="number" value={state.passScore} onChange={(e) => updateQuiz({ passScore: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Max tentativi</label>
            <Input type="number" value={state.maxAttempts ?? 0} onChange={(e) => updateQuiz({ maxAttempts: Number(e.target.value) || null as any })} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Tempo limite (secondi)</label>
            <Input type="number" value={state.timeLimitSeconds ?? 0} onChange={(e) => updateQuiz({ timeLimitSeconds: Number(e.target.value) || null as any })} />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Ricompensa punti</label>
            <Input type="number" value={state.pointsReward} onChange={(e) => updateQuiz({ pointsReward: Number(e.target.value) })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Domande</h2>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="Aggiungi domanda" title="Aggiungi domanda" disabled={!!creating.question}>
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => addQuestion('MULTIPLE_CHOICE')} disabled={!!creating.question}>
                <ListChecks className="mr-2 h-4 w-4 text-[#5D62E1]" />
                <span>Multiple choice</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addQuestion('TRUE_FALSE')} disabled={!!creating.question}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-[#5D62E1]" />
                <span>Vero / Falso</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addQuestion('SHORT_ANSWER')} disabled={!!creating.question}>
                <Type className="mr-2 h-4 w-4 text-[#5D62E1]" />
                <span>Short answer</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4">
        {state.questions.map((q) => (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle className="text-sm">Domanda #{q.position + 1}</CardTitle>
                <Select value={q.type} onValueChange={(val) => updateQuestion(q.id, { type: val as QuizQuestionType })}>
                  <SelectTrigger className="h-8 w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MULTIPLE_CHOICE">Multiple choice</SelectItem>
                    <SelectItem value="TRUE_FALSE">Vero/Falso</SelectItem>
                    <SelectItem value="SHORT_ANSWER">Short answer</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="destructive" onClick={() => removeQuestion(q.id)}>Elimina</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Testo</label>
                  <Textarea value={q.text} onChange={(e) => updateQuestion(q.id, { text: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Punti</label>
                  <Input type="number" value={q.points} onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })} />
                </div>
              </div>

              {q.type !== 'SHORT_ANSWER' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Opzioni</h4>
                    <Button size="sm" variant="secondary" disabled={creating.optionFor === q.id} onClick={() => addOption(q.id)}>+ Opzione</Button>
                  </div>
                  <div className="space-y-2">
                    {q.options.map((o) => (
                      <div key={o.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                        <Input value={o.text} onChange={(e) => updateOption(q.id, o.id, { text: e.target.value })} />
                        <label className="text-xs flex items-center gap-2">
                          <input type="checkbox" checked={o.isCorrect} onChange={(e) => updateOption(q.id, o.id, { isCorrect: e.target.checked })} />
                          Corretta
                        </label>
                        <div className="flex items-center gap-2">
                          <Input type="number" value={o.points} onChange={(e) => updateOption(q.id, o.id, { points: Number(e.target.value) })} />
                          <Button size="sm" variant="destructive" onClick={() => removeOption(q.id, o.id)}>Rimuovi</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-right">
        <Button disabled={saving} onClick={() => toast.success('Tutte le modifiche sono già salvate automaticamente')}>Salva</Button>
      </div>
    </div>
  )
}
