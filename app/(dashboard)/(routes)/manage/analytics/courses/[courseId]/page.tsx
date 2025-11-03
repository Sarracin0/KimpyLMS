import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getCourseAnalytics } from '@/actions/get-course-analytics'
import { requireAuthContext } from '@/lib/current-profile'

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, ...options }).format(value)

const formatPercent = (value: number) => `${formatNumber(value, { maximumFractionDigits: 1 })}%`

export default async function CourseAnalyticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { company } = await requireAuthContext()
  const { courseId } = await params
  const analytics = await getCourseAnalytics(courseId, company.id)

  const enrolmentKPI = [
    {
      label: 'Learner totali',
      value: analytics.totalLearners,
      helper: 'Iscritti al corso',
    },
    {
      label: 'Completati',
      value: analytics.completed,
      helper: 'Iscrizioni concluse',
    },
    {
      label: 'In corso',
      value: analytics.inProgress,
      helper: 'Learner attivi',
    },
    {
      label: 'Non avviati',
      value: analytics.notStarted,
      helper: 'In attesa di partenza',
    },
  ]

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/manage/analytics"
          className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Torna alla panoramica
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{analytics.courseTitle}</h1>
            <p className="text-sm text-muted-foreground">
              Stato del corso, segnali di attenzione e progressi dei learner.
            </p>
          </div>
          <div className="rounded-full border border-white/30 bg-white/70 px-3 py-1 text-xs text-muted-foreground">
            Tasso di completamento: <span className="font-medium text-foreground">{formatPercent(analytics.completionRate)}</span>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {enrolmentKPI.map((item) => (
          <div key={item.label} className="rounded-3xl border border-white/30 bg-white/70 p-5 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{formatNumber(item.value)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{item.helper}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/30 bg-white/80 p-6 shadow-sm backdrop-blur lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Andamento nel tempo</h2>
          <p className="text-xs text-muted-foreground">Completamenti e conversazioni con Coach AI per settimana.</p>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            {analytics.timeline.length === 0 ? (
              <p>Nessun dato storico disponibile.</p>
            ) : (
              analytics.timeline.map((point) => (
                <div key={point.label} className="flex items-center justify-between rounded-xl border border-white/40 bg-white/90 px-3 py-2">
                  <span className="text-xs font-medium text-foreground">{point.label}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">Completamenti: {formatNumber(point.completions)}</span>
                    <span className="text-muted-foreground">Coach AI: {formatNumber(point.coachConversations)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-white/30 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-base font-semibold text-foreground">Practice Arena</h2>
          <p className="text-xs text-muted-foreground">
            Dati della simulazione iterativa: Insight Tokens, piani inviati, punteggi medi ed endorsement HR.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Insight Tokens assegnati</dt>
              <dd className="font-semibold text-foreground">{formatNumber(analytics.practiceArena.tokens)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Piani inviati</dt>
              <dd className="font-semibold text-foreground">{formatNumber(analytics.practiceArena.attempts)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Punteggio medio (0-100)</dt>
              <dd className="font-semibold text-foreground">
                {analytics.practiceArena.averageScore == null
                  ? '—'
                  : formatNumber(analytics.practiceArena.averageScore, { maximumFractionDigits: 1 })}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Endorsement concessi (HR)</dt>
              <dd className="font-semibold text-foreground">{formatNumber(analytics.practiceArena.endorsements)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-3xl border border-white/30 bg-white/80 p-6 shadow-sm backdrop-blur">
        <h2 className="text-base font-semibold text-foreground">Learner</h2>
        <p className="text-xs text-muted-foreground">Stato di avanzamento e interazioni.</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Learner</th>
                <th className="px-4 py-3 text-left font-medium">Titolo</th>
                <th className="px-4 py-3 text-left font-medium">Stato</th>
                <th className="px-4 py-3 text-left font-medium">Completamento</th>
                <th className="px-4 py-3 text-left font-medium">Coach AI (messaggi)</th>
                <th className="px-4 py-3 text-left font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {analytics.learners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Nessuna iscrizione al corso.
                  </td>
                </tr>
              ) : (
                analytics.learners.map((learner) => (
                  <tr key={learner.userProfileId} className="border-t border-white/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{learner.displayName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{learner.jobTitle ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{learner.status}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatPercent(learner.completionRate)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatNumber(learner.coachInteractions)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatNumber(learner.notes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-white/30 bg-white/80 p-6 shadow-sm backdrop-blur">
        <h2 className="text-base font-semibold text-foreground">Lezioni da monitorare</h2>
        <p className="text-xs text-muted-foreground">Dove i learner chiedono più supporto o tornano indietro.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {analytics.lessonSignals.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun segnale particolare.</p>
          ) : (
            analytics.lessonSignals.map((signal) => (
              <div key={signal.lessonId} className="space-y-2 rounded-2xl border border-white/40 bg-white/90 p-4">
                <p className="text-sm font-semibold text-foreground">{signal.lessonTitle}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                    Coach AI (messaggi)
                    <div className="text-xs font-semibold text-foreground">{formatNumber(signal.coachMessages)}</div>
                  </div>
                  <div className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                    Note inserite
                    <div className="text-xs font-semibold text-foreground">{formatNumber(signal.notes)}</div>
                  </div>
                  <div className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
                    Rewatch video
                    <div className="text-xs font-semibold text-foreground">{formatNumber(signal.rewind)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
