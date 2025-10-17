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
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ListChecks, CheckCircle2, Type, Plus, Clock, Target, Trophy } from 'lucide-react'
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
    <div className="space-y-8">
      <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Impostazioni quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Titolo</label>
            <Input
              value={state.title}
              onChange={(e) => updateQuiz({ title: e.target.value })}
              className="h-11 border-muted-foreground/20 focus-visible:ring-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#5D62E1]/10">
                  <Target className="h-5 w-5 text-[#5D62E1]" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">Punteggio per superare</label>
                  <p className="text-xs text-muted-foreground">Percentuale minima richiesta</p>
                </div>
                <span className="text-lg font-semibold text-[#5D62E1] min-w-[3rem] text-right">{state.passScore}%</span>
              </div>
              <Slider
                value={[state.passScore]}
                onValueChange={([value]) => updateQuiz({ passScore: value })}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#5D62E1]/10">
                  <Trophy className="h-5 w-5 text-[#5D62E1]" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">Ricompensa punti</label>
                  <p className="text-xs text-muted-foreground">Punti ottenuti al completamento</p>
                </div>
                <Input
                  type="number"
                  value={state.pointsReward}
                  onChange={(e) => updateQuiz({ pointsReward: Number(e.target.value) })}
                  className="w-24 h-9 border-muted-foreground/20 focus-visible:ring-1 text-right"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#5D62E1]/10">
                  <Clock className="h-5 w-5 text-[#5D62E1]" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">Tempo limite</label>
                  <p className="text-xs text-muted-foreground">Durata in minuti (0 = illimitato)</p>
                </div>
                <Input
                  type="number"
                  value={Math.floor((state.timeLimitSeconds ?? 0) / 60)}
                  onChange={(e) => updateQuiz({ timeLimitSeconds: Number(e.target.value) * 60 || null as any })}
                  className="w-20 h-9 border-muted-foreground/20 focus-visible:ring-1 text-right"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#5D62E1]/10">
                  <ListChecks className="h-5 w-5 text-[#5D62E1]" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">Tentativi massimi</label>
                  <p className="text-xs text-muted-foreground">Tentativi consentiti (0 = illimitati)</p>
                </div>
                <Input
                  type="number"
                  value={state.maxAttempts ?? 0}
                  onChange={(e) => updateQuiz({ maxAttempts: Number(e.target.value) || null as any })}
                  className="w-20 h-9 border-muted-foreground/20 focus-visible:ring-1 text-right"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 pt-4 border-t border-muted-foreground/10">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <label className="text-sm font-medium text-foreground">Mescola domande</label>
              <Switch
                checked={state.shuffleQuestions}
                onCheckedChange={(checked) => updateQuiz({ shuffleQuestions: checked })}
              />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <label className="text-sm font-medium text-foreground">Mescola opzioni</label>
              <Switch
                checked={state.shuffleOptions}
                onCheckedChange={(checked) => updateQuiz({ shuffleOptions: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-4">
        <h2 className="text-xl font-semibold">Domande</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="gap-2 h-10 px-4 bg-[#5D62E1] text-white hover:bg-[#5D62E1]/90"
              aria-label="Aggiungi domanda"
              disabled={!!creating.question}
            >
              <Plus className="h-4 w-4" />
              Aggiungi domanda
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => addQuestion('MULTIPLE_CHOICE')} disabled={!!creating.question}>
              <ListChecks className="mr-3 h-4 w-4 text-[#5D62E1]" />
              <span>Scelta multipla</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addQuestion('TRUE_FALSE')} disabled={!!creating.question}>
              <CheckCircle2 className="mr-3 h-4 w-4 text-[#5D62E1]" />
              <span>Vero / Falso</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addQuestion('SHORT_ANSWER')} disabled={!!creating.question}>
              <Type className="mr-3 h-4 w-4 text-[#5D62E1]" />
              <span>Risposta breve</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {state.questions.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-4">
              <ListChecks className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-base font-medium mb-1">Nessuna domanda ancora</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Inizia aggiungendo la tua prima domanda usando il pulsante qui sopra
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {state.questions.map((q, idx) => (
            <Card key={q.id} className="border-0 shadow-sm bg-card/50 backdrop-blur overflow-hidden">
              <CardHeader className="pb-4 bg-muted/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground/5 text-sm font-semibold">
                      {idx + 1}
                    </div>
                    <Select value={q.type} onValueChange={(val) => updateQuestion(q.id, { type: val as QuizQuestionType })}>
                      <SelectTrigger className="h-9 w-[180px] border-muted-foreground/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MULTIPLE_CHOICE">Scelta multipla</SelectItem>
                        <SelectItem value="TRUE_FALSE">Vero/Falso</SelectItem>
                        <SelectItem value="SHORT_ANSWER">Risposta breve</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeQuestion(q.id)}
                  >
                    Elimina
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/80">Testo domanda</label>
                    <Textarea
                      value={q.text}
                      onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                      className="min-h-[100px] border-muted-foreground/20 focus-visible:ring-1 resize-none"
                      placeholder="Inserisci qui la tua domanda..."
                    />
                  </div>
                  <div className="space-y-2 md:w-32">
                    <label className="text-sm font-medium text-foreground/80">Punti</label>
                    <Input
                      type="number"
                      value={q.points}
                      onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })}
                      className="h-11 border-muted-foreground/20 focus-visible:ring-1"
                    />
                  </div>
                </div>

                {q.type !== 'SHORT_ANSWER' && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Opzioni di risposta</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 h-9"
                        disabled={creating.optionFor === q.id}
                        onClick={() => addOption(q.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Aggiungi opzione
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {q.options.map((o) => (
                        <div key={o.id} className="flex items-center gap-3 p-4 rounded-lg border border-muted-foreground/10 bg-background/50">
                          <Input
                            value={o.text}
                            onChange={(e) => updateOption(q.id, o.id, { text: e.target.value })}
                            className="flex-1 h-10 border-muted-foreground/20 focus-visible:ring-1"
                            placeholder="Testo opzione"
                          />
                          <label className="flex items-center gap-2 text-sm font-medium min-w-fit cursor-pointer">
                            <input
                              type="checkbox"
                              checked={o.isCorrect}
                              onChange={(e) => updateOption(q.id, o.id, { isCorrect: e.target.checked })}
                              className="w-4 h-4 rounded border-muted-foreground/30 text-foreground focus:ring-1 focus:ring-foreground cursor-pointer"
                            />
                            Corretta
                          </label>
                          <Input
                            type="number"
                            value={o.points}
                            onChange={(e) => updateOption(q.id, o.id, { points: Number(e.target.value) })}
                            className="w-24 h-10 border-muted-foreground/20 focus-visible:ring-1"
                            placeholder="Punti"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeOption(q.id, o.id)}
                          >
                            Rimuovi
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-6">
        <Button
          disabled={saving}
          onClick={() => toast.success('Tutte le modifiche sono già salvate automaticamente')}
          className="h-11 px-6 bg-[#5D62E1] text-white hover:bg-[#5D62E1]/90"
        >
          {saving ? 'Salvataggio...' : 'Salva'}
        </Button>
      </div>
    </div>
  )
}
