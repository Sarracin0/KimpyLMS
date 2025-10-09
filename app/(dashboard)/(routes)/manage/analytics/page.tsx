import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { getAnalytics } from '@/actions/get-analytics'
import { requireAuthContext } from '@/lib/current-profile'

import { EngagementTrendChart } from './_components/engagement-trend-chart'

type Metric = {
  value: number
  delta: number | null
}

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, ...options }).format(value)

const formatPercent = (value: number) => `${formatNumber(value, { maximumFractionDigits: 1 })}%`

const describeDelta = (delta: number | null) => {
  if (delta === null) {
    return {
      label: 'nuovo',
      tone: 'text-emerald-600',
      icon: <ArrowUpRight className="h-3 w-3" />,
    }
  }
  if (delta === 0) {
    return {
      label: 'in linea',
      tone: 'text-muted-foreground',
      icon: <Minus className="h-3 w-3" />,
    }
  }
  if (delta > 0) {
    return {
      label: `+${formatNumber(delta, { maximumFractionDigits: 1 })}%`,
      tone: 'text-emerald-600',
      icon: <ArrowUpRight className="h-3 w-3" />,
    }
  }
  return {
    label: `${formatNumber(delta, { maximumFractionDigits: 1 })}%`,
    tone: 'text-rose-600',
    icon: <ArrowDownRight className="h-3 w-3" />,
  }
}

const PulseCard = ({ title, helper, metric }: { title: string; helper: string; metric: Metric }) => {
  const delta = describeDelta(metric.delta)

  return (
    <div className="rounded-3xl border border-white/30 bg-white/70 p-5 shadow-sm backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-3xl font-semibold text-foreground">{formatNumber(metric.value)}</span>
        <span className={`flex items-center gap-1 text-xs font-medium ${delta.tone}`}>
          {delta.icon}
          {delta.label}
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

const SpotlightColumn = ({ title, items }: { title: string; items: { courseTitle: string; itemTitle: string; count: number }[] }) => (
  <div className="rounded-3xl border border-white/30 bg-white/70 p-5 shadow-sm backdrop-blur">
    <p className="text-sm font-semibold text-foreground">{title}</p>
    <div className="mt-4 space-y-3 text-sm">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessun segnale nelle ultime due settimane.</p>
      ) : (
        items.map((item) => (
          <div key={`${item.courseTitle}-${item.itemTitle}`} className="space-y-1 rounded-xl border border-white/40 bg-white/80 px-3 py-2">
            <p className="text-xs font-semibold text-foreground">{item.itemTitle}</p>
            <p className="text-[11px] text-muted-foreground">{item.courseTitle}</p>
            <p className="text-xs text-foreground">{formatNumber(item.count)} eventi</p>
          </div>
        ))
      )}
    </div>
  </div>
)

export default async function AnalyticsPage() {
  const { company } = await requireAuthContext()
  const analytics = await getAnalytics(company.id)

  const pulse = [
    {
      title: 'Learner attivi',
      helper: 'Ultimi 30 giorni',
      metric: analytics.pulse.activeLearners,
    },
    {
      title: 'Corsi completati',
      helper: 'Ultimi 30 giorni',
      metric: analytics.pulse.completions,
    },
    {
      title: 'Conversazioni Coach AI',
      helper: 'Richieste dei learner',
      metric: analytics.pulse.aiCoach,
    },
    {
      title: 'Insight Tokens',
      helper: 'Practice Arena assegnati',
      metric: analytics.pulse.arenaTokens,
    },
  ]

  const averageCompletionRate = analytics.totals.averageCompletionRate
  const courseLeaderboard = analytics.courseLeaderboard
  const practiceArena = analytics.practiceArena
  const spotlight = analytics.spotlight

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Analitiche di coinvolgimento</h1>
            <p className="text-sm text-muted-foreground">Uno sguardo chiaro su come persone e contenuti si incontrano nella tua academy.</p>
          </div>
          <p className="rounded-full border border-white/30 bg-white/70 px-3 py-1 text-xs text-muted-foreground">
            Media completamento: <span className="font-medium text-foreground">{formatPercent(averageCompletionRate)}</span>
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {pulse.map((item) => (
          <PulseCard key={item.title} title={item.title} helper={item.helper} metric={item.metric} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/30 bg-white/80 p-6 shadow-sm backdrop-blur lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Trend delle ultime settimane</h2>
              <p className="text-xs text-muted-foreground">Completamenti vs conversazioni con Coach AI</p>
            </div>
          </div>
          <div className="mt-4">
            <EngagementTrendChart data={analytics.timeline} />
          </div>
        </div>
        <div className="rounded-3xl border border-white/30 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-base font-semibold text-foreground">Practice Arena</h2>
          <p className="mt-1 text-xs text-muted-foreground">Performance dei piani iterativi.</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Insight tokens</dt>
              <dd className="font-semibold text-foreground">{formatNumber(practiceArena.totalTokens)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Tentativi valutati</dt>
              <dd className="font-semibold text-foreground">{formatNumber(practiceArena.totalAttempts)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Score medio</dt>
              <dd className="font-semibold text-foreground">
                {practiceArena.averageScore == null ? '—' : formatNumber(practiceArena.averageScore, { maximumFractionDigits: 1 })}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Endorsement HR</dt>
              <dd className="font-semibold text-foreground">{formatNumber(practiceArena.endorsements)}</dd>
            </div>
          </dl>
          <div className="mt-6 space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Top arena</p>
            {practiceArena.topArenas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ancora nessun tentativo rilevante.</p>
            ) : (
              practiceArena.topArenas.map((arena) => (
                <div key={`${arena.courseTitle}-${arena.lessonTitle}`} className="rounded-xl border border-white/40 bg-white/90 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{arena.lessonTitle}</p>
                  <p className="text-[11px] text-muted-foreground">{arena.courseTitle}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Score medio</span>
                    <span className="font-medium text-foreground">
                      {arena.avgScore == null ? '—' : formatNumber(arena.avgScore, { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tokens medi</span>
                    <span className="font-medium text-foreground">{formatNumber(arena.avgTokens, { maximumFractionDigits: 1 })}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatNumber(arena.attempts)} tentativi</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/30 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Course leaderboard</h2>
            <p className="text-xs text-muted-foreground">I corsi più seguiti e le interazioni associate.</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Corso</th>
                <th className="px-4 py-3 text-left font-medium">Completion rate</th>
                <th className="px-4 py-3 text-left font-medium">Learner</th>
                <th className="px-4 py-3 text-left font-medium">Coach AI</th>
                <th className="px-4 py-3 text-left font-medium">Note</th>
                <th className="px-4 py-3 text-left font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {courseLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Ancora nessuna iscrizione.
                  </td>
                </tr>
              ) : (
                courseLeaderboard.map((course) => {
                  const aiPerLearner = course.learners === 0 ? 0 : course.aiCoachInteractions / course.learners
                  return (
                    <tr key={course.courseId} className="border-t border-white/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        <Link
                          href={`/manage/analytics/courses/${course.courseId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {course.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground/80"
                              style={{ width: `${Math.min(100, Math.max(0, course.completionRate))}%` }}
                            />
                          </div>
                          <span className="text-xs text-foreground">
                            {formatNumber(course.completionRate, { maximumFractionDigits: 1 })}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatNumber(course.learners)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatNumber(aiPerLearner, { maximumFractionDigits: 1 })} / learner
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatNumber(course.comments)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatNumber(course.practiceArenaTokens)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SpotlightColumn title="Coach AI: cosa chiede attenzione" items={spotlight.aiCoach} />
        <SpotlightColumn title="Replay hotspot" items={spotlight.rewinds} />
        <SpotlightColumn title="Note dei learner" items={spotlight.notes} />
      </section>
    </div>
  )
}
