import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { UserRole } from '@prisma/client'
import { extractArenaPayload } from '@/lib/gamification/arena'
import { ArenaEndorseButton } from './_components/arena-endorse-button'
import { GamificationClient } from './_components/gamification-client'

const DEFAULT_ENDORSEMENT_BONUS = 5

type ArenaReflectionSummary = {
  summary: string
  improvementAdvice: string
  scoreDelta: number | null
  tokensAwarded: number | null
  endorsements: Array<{ profileId?: string; name?: string; createdAt?: string }>
}

const parseArenaReflections = (value: unknown): ArenaReflectionSummary => {
  if (!value || typeof value !== 'object') {
    return { summary: '', improvementAdvice: '', scoreDelta: null, tokensAwarded: null, endorsements: [] }
  }
  const record = value as Record<string, unknown>
  const evaluation = record.evaluation && typeof record.evaluation === 'object' ? (record.evaluation as Record<string, unknown>) : null
  return {
    summary: typeof evaluation?.summary === 'string' ? evaluation.summary : '',
    improvementAdvice: typeof evaluation?.improvementAdvice === 'string' ? evaluation.improvementAdvice : '',
    scoreDelta: typeof record.scoreDelta === 'number' ? record.scoreDelta : null,
    tokensAwarded: typeof record.tokensAwarded === 'number' ? record.tokensAwarded : null,
    endorsements: Array.isArray(record.endorsements)
      ? (record.endorsements as Array<Record<string, unknown>>).map((entry) => ({
          profileId: typeof entry.profileId === 'string' ? entry.profileId : undefined,
          name: typeof entry.name === 'string' ? entry.name : undefined,
          createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : undefined,
        }))
      : [],
  }
}

export default async function GamificationPage() {
  const { profile, company } = await requireAuthContext()

  if (profile.role !== UserRole.HR_ADMIN) {
    const [badges, pointsLog] = await Promise.all([
      db.userBadge.findMany({
        where: { userProfileId: profile.id },
        include: { badge: true },
        orderBy: { awardedAt: 'desc' },
      }),
      db.userPoints.findMany({
        where: { userProfileId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Achievements</h1>
          <p className="text-sm text-muted-foreground">
            Keep track of the badges collected and the points you&apos;ve earned through learning.
          </p>
        </div>

        <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Points history</CardTitle>
            <p className="text-xs text-muted-foreground">Total points: {profile.points}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {pointsLog.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/70 px-3 py-2 text-sm">
                <span>{entry.reason ?? entry.type}</span>
                <span className="text-xs font-semibold text-primary">+{entry.delta}</span>
              </div>
            ))}
            {pointsLog.length === 0 ? <p className="text-sm text-muted-foreground">No points awarded yet.</p> : null}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Badges earned</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {badges.map((userBadge) => (
              <div key={userBadge.id} className="relative rounded-lg border border-border/50 bg-card/70 px-4 py-3">
                <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded-l-md bg-primary/80" />
                <p className="text-sm font-semibold text-foreground">{userBadge.badge.name}</p>
                <p className="text-xs text-muted-foreground">{userBadge.badge.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Awarded on {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(userBadge.awardedAt)}
                </p>
              </div>
            ))}
            {badges.length === 0 ? (
              <p className="text-sm text-muted-foreground md:col-span-3">
                Complete courses and live sessions to unlock badges.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  const scenarioAttemptPromise = db.scenarioAttempt?.findMany
    ? db.scenarioAttempt.findMany({
        where: {
          gamificationBlock: {
            lessonBlock: {
              lesson: {
                module: {
                  course: { companyId: company.id },
                },
              },
            },
          },
        },
        include: {
          gamificationBlock: {
            include: {
              lessonBlock: {
                include: {
                  lesson: {
                    include: {
                      module: {
                        include: {
                          course: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
      })
    : Promise.resolve([])

  const [badgeAwards, quizList, topProfiles, scenarioAttempts] = await Promise.all([
    db.userBadge.findMany({
      where: {
        badge: {
          OR: [{ companyId: company.id }, { companyId: null }],
        },
      },
      include: {
        badge: true,
        userProfile: {
          select: { id: true, userId: true, jobTitle: true, department: true, role: true },
        },
      },
      orderBy: { awardedAt: 'desc' },
      take: 25,
    }),
    db.quiz.findMany({
      where: { companyId: company.id },
      include: {
        lessonBlock: {
          include: {
            lesson: {
              include: {
                module: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        },
        attempts: true,
      },
    }),
    db.userProfile.findMany({
      where: { companyId: company.id },
      select: { id: true, userId: true, points: true, role: true, jobTitle: true, department: true },
      orderBy: { points: 'desc' },
      take: 10,
    }),
    scenarioAttemptPromise,
  ])

  const scenarioLabAttempts = scenarioAttempts.filter((attempt) => attempt.attemptType === 'SCENARIO')
  const practiceArenaAttempts = scenarioAttempts.filter((attempt) => attempt.attemptType === 'ARENA')

  const badgeSummary = Array.from(
    badgeAwards.reduce((map, entry) => {
      const current = map.get(entry.badgeId) ?? {
        badge: entry.badge,
        count: 0,
        lastAwardedAt: entry.awardedAt,
      }

      current.count += 1
      if (current.lastAwardedAt < entry.awardedAt) {
        current.lastAwardedAt = entry.awardedAt
      }

      map.set(entry.badgeId, current)
      return map
    }, new Map<string, { badge: (typeof badgeAwards)[number]['badge']; count: number; lastAwardedAt: Date }>())
      .values(),
  ).sort((a, b) => b.count - a.count)

  const courseStats = Array.from(
    quizList.reduce((map, quiz) => {
      const course = quiz.lessonBlock?.lesson?.module?.course
      if (!course) {
        return map
      }

      const attempts = quiz.attempts
      const totalAttempts = attempts.length
      const totalScore = attempts.reduce((acc, attempt) => acc + (attempt.score ?? 0), 0)
      const passCount = attempts.filter((attempt) => attempt.passed).length
      const uniqueLearners = new Set(attempts.map((attempt) => attempt.userProfileId)).size

      const entry = map.get(course.id) ?? {
        courseId: course.id,
        courseTitle: course.title,
        quizCount: 0,
        totalAttempts: 0,
        totalScore: 0,
        passCount: 0,
        learners: 0,
      }

      entry.quizCount += 1
      entry.totalAttempts += totalAttempts
      entry.totalScore += totalScore
      entry.passCount += passCount
      entry.learners += uniqueLearners

      map.set(course.id, entry)
      return map
    }, new Map<string, { courseId: string; courseTitle: string; quizCount: number; totalAttempts: number; totalScore: number; passCount: number; learners: number }>())
      .values(),
  )
    .map((entry) => ({
      ...entry,
      averageScore: entry.totalAttempts > 0 ? Math.round(entry.totalScore / entry.totalAttempts) : 0,
      passRate: entry.totalAttempts > 0 ? Math.round((entry.passCount * 100) / entry.totalAttempts) : 0,
    }))
    .sort((a, b) => b.totalAttempts - a.totalAttempts)

  type ScenarioAccumulator = {
    courseId: string
    courseTitle: string
    attemptCount: number
    totalScore: number
    totalRisk: number
    riskSamples: number
    highRiskDecisions: number
    totalDecisions: number
    competencyCounts: Map<string, number>
  }

  const scenarioByCourse = scenarioLabAttempts.reduce((map, attempt) => {
    const course = attempt.gamificationBlock?.lessonBlock?.lesson?.module?.course
    if (!course) return map

    const entry: ScenarioAccumulator = map.get(course.id) ?? {
      courseId: course.id,
      courseTitle: course.title,
      attemptCount: 0,
      totalScore: 0,
      totalRisk: 0,
      riskSamples: 0,
      highRiskDecisions: 0,
      totalDecisions: 0,
      competencyCounts: new Map<string, number>(),
    }

    entry.attemptCount += 1
    entry.totalScore += attempt.score ?? 0
    if (typeof attempt.riskLevel === 'number') {
      entry.totalRisk += attempt.riskLevel
      entry.riskSamples += 1
    }

    const path = Array.isArray(attempt.path) ? (attempt.path as unknown[]) : []
    for (const step of path) {
      if (!step || typeof step !== 'object') continue
      const record = step as { type?: unknown; impact?: { risk?: unknown; competencyTags?: unknown } }
      if (record.type === 'decision') {
        const risk = typeof record.impact?.risk === 'number' ? record.impact.risk : 0
        entry.totalDecisions += 1
        if (risk >= 70) {
          entry.highRiskDecisions += 1
        }
        const tags = Array.isArray(record.impact?.competencyTags) ? record.impact?.competencyTags : []
        for (const tag of tags) {
          if (typeof tag === 'string' && tag.trim().length > 0) {
            const normalized = tag.trim()
            entry.competencyCounts.set(normalized, (entry.competencyCounts.get(normalized) ?? 0) + 1)
          }
        }
      }
    }

    map.set(course.id, entry)
    return map
  }, new Map<string, ScenarioAccumulator>())

  let overallScenarioAttempts = 0
  let overallScenarioScore = 0
  let overallScenarioRisk = 0
  let overallScenarioRiskSamples = 0
  let overallHighRiskDecisions = 0
  let overallDecisionCount = 0
  const overallCompetencyCounts = new Map<string, number>()

  const scenarioStats = Array.from(scenarioByCourse.values())
    .map((entry) => {
      overallScenarioAttempts += entry.attemptCount
      overallScenarioScore += entry.totalScore
      overallScenarioRisk += entry.totalRisk
      overallScenarioRiskSamples += entry.riskSamples
      overallHighRiskDecisions += entry.highRiskDecisions
      overallDecisionCount += entry.totalDecisions
      for (const [tag, count] of entry.competencyCounts.entries()) {
        overallCompetencyCounts.set(tag, (overallCompetencyCounts.get(tag) ?? 0) + count)
      }

      const topCompetencies = Array.from(entry.competencyCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag, count }))

      return {
        courseId: entry.courseId,
        courseTitle: entry.courseTitle,
        attemptCount: entry.attemptCount,
        avgScore: entry.attemptCount ? Math.round(entry.totalScore / entry.attemptCount) : 0,
        avgRisk: entry.riskSamples ? Math.round(entry.totalRisk / entry.riskSamples) : null,
        highRiskRate: entry.totalDecisions ? Math.round((entry.highRiskDecisions * 100) / entry.totalDecisions) : 0,
        topCompetencies,
      }
    })
    .sort((a, b) => b.attemptCount - a.attemptCount)

  const overallScenarioMetrics = {
    attempts: overallScenarioAttempts,
    avgScore: overallScenarioAttempts ? Math.round(overallScenarioScore / overallScenarioAttempts) : 0,
    avgRisk: overallScenarioRiskSamples ? Math.round(overallScenarioRisk / overallScenarioRiskSamples) : null,
    highRiskRate: overallDecisionCount ? Math.round((overallHighRiskDecisions * 100) / overallDecisionCount) : 0,
    topCompetencies: Array.from(overallCompetencyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count })),
  }

  type ArenaAccumulator = {
    courseId: string
    courseTitle: string
    attemptCount: number
    totalScore: number
    totalTokens: number
    totalDelta: number
    deltaSamples: number
    improvedAttempts: number
    userAttempts: Map<string, number>
  }

  const arenaByCourse = practiceArenaAttempts.reduce((map, attempt) => {
    const course = attempt.gamificationBlock?.lessonBlock?.lesson?.module?.course
    if (!course) return map

    const entry: ArenaAccumulator = map.get(course.id) ?? {
      courseId: course.id,
      courseTitle: course.title,
      attemptCount: 0,
      totalScore: 0,
      totalTokens: 0,
      totalDelta: 0,
      deltaSamples: 0,
      improvedAttempts: 0,
      userAttempts: new Map<string, number>(),
    }

    entry.attemptCount += 1
    entry.totalScore += attempt.score ?? 0
    entry.totalTokens += attempt.insightTokens ?? 0

    const reflections = parseArenaReflections(attempt.reflections)
    if (typeof reflections.scoreDelta === 'number') {
      entry.totalDelta += reflections.scoreDelta
      entry.deltaSamples += 1
      if (reflections.scoreDelta > 0) {
        entry.improvedAttempts += 1
      }
    }

    entry.userAttempts.set(
      attempt.userProfileId,
      (entry.userAttempts.get(attempt.userProfileId) ?? 0) + 1,
    )

    map.set(course.id, entry)
    return map
  }, new Map<string, ArenaAccumulator>())

  let overallArenaAttempts = 0
  let overallArenaScore = 0
  let overallArenaTokens = 0
  let overallArenaDelta = 0
  let overallArenaDeltaSamples = 0
  let overallArenaImproved = 0
  const overallArenaUserAttempts = new Map<string, number>()

  const arenaStats = Array.from(arenaByCourse.values())
    .map((entry) => {
      overallArenaAttempts += entry.attemptCount
      overallArenaScore += entry.totalScore
      overallArenaTokens += entry.totalTokens
      overallArenaDelta += entry.totalDelta
      overallArenaDeltaSamples += entry.deltaSamples
      overallArenaImproved += entry.improvedAttempts
      for (const [userId, count] of entry.userAttempts.entries()) {
        overallArenaUserAttempts.set(userId, (overallArenaUserAttempts.get(userId) ?? 0) + count)
      }

      const userCount = entry.userAttempts.size
      const repeatUsers = Array.from(entry.userAttempts.values()).filter((count) => count > 1).length
      return {
        courseId: entry.courseId,
        courseTitle: entry.courseTitle,
        attempts: entry.attemptCount,
        avgScore: entry.attemptCount ? Math.round(entry.totalScore / entry.attemptCount) : 0,
        avgImprovement: entry.deltaSamples ? Math.round(entry.totalDelta / entry.deltaSamples) : 0,
        improvementRate: entry.deltaSamples ? Math.round((entry.improvedAttempts * 100) / entry.deltaSamples) : 0,
        iterationRate: userCount ? Math.round((repeatUsers * 100) / userCount) : 0,
        avgTokens: entry.attemptCount ? Math.round(entry.totalTokens / entry.attemptCount) : 0,
        totalTokens: entry.totalTokens,
      }
    })
    .sort((a, b) => b.attempts - a.attempts)

  const totalArenaUsers = overallArenaUserAttempts.size
  const totalRepeatArenaUsers = Array.from(overallArenaUserAttempts.values()).filter((count) => count > 1).length

  const overallArenaMetrics = {
    attempts: overallArenaAttempts,
    avgScore: overallArenaAttempts ? Math.round(overallArenaScore / overallArenaAttempts) : 0,
    avgImprovement: overallArenaDeltaSamples ? Math.round(overallArenaDelta / overallArenaDeltaSamples) : 0,
    improvementRate: overallArenaDeltaSamples ? Math.round((overallArenaImproved * 100) / overallArenaDeltaSamples) : 0,
    iterationRate: totalArenaUsers ? Math.round((totalRepeatArenaUsers * 100) / totalArenaUsers) : 0,
    totalTokens: overallArenaTokens,
  }

  const recentArenaSummaries = practiceArenaAttempts
    .slice(0, 6)
    .map((attempt) => {
      const reflections = parseArenaReflections(attempt.reflections)
      const course = attempt.gamificationBlock?.lessonBlock?.lesson?.module?.course
      const blockTitle = attempt.gamificationBlock?.lessonBlock?.title ?? 'Practice Arena'
      const arenaPayload = extractArenaPayload(attempt.gamificationBlock?.result ?? null)
      return {
        id: attempt.id,
        blockId: attempt.gamificationBlock?.lessonBlockId ?? '',
        courseTitle: course?.title ?? 'Course',
        blockTitle,
        createdAt: attempt.createdAt,
        summary: reflections.summary,
        improvementAdvice: reflections.improvementAdvice,
        scoreDelta: reflections.scoreDelta,
        tokens: reflections.tokensAwarded ?? attempt.insightTokens,
        endorsements: reflections.endorsements,
        endorsementBonus: arenaPayload?.tokens?.endorsementBonus ?? DEFAULT_ENDORSEMENT_BONUS,
        attemptOwnerId: attempt.userProfileId,
      }
    })

  const recentReflections = scenarioLabAttempts
    .flatMap((attempt) => {
      const course = attempt.gamificationBlock?.lessonBlock?.lesson?.module?.course
      const blockTitle = attempt.gamificationBlock?.lessonBlock?.title ?? 'Decision Lab'
      const reflections = Array.isArray(attempt.reflections) ? (attempt.reflections as unknown[]) : []
      return reflections
        .filter((item): item is { nodeId?: unknown; response?: unknown } => !!item && typeof item === 'object')
        .map((item) => {
          const record = item as { nodeId?: unknown; response?: unknown }
          const responseText = typeof record.response === 'string' ? record.response : ''
          return {
            id: `${attempt.id}-${record.nodeId ?? 'reflection'}`,
            courseTitle: course?.title ?? 'Course',
            blockTitle,
            createdAt: attempt.createdAt,
            response: responseText,
          }
        })
        .filter((entry) => entry.response.trim().length > 0)
    })
    .slice(0, 6)

  const badgesData = badgeSummary.map(({ badge, count, lastAwardedAt }) => ({
    id: badge.id,
    name: badge.name,
    description: badge.description ?? '',
    count,
    lastAwardedAt,
  }))

  return (
    <GamificationClient
      badges={badgesData}
      courseStats={courseStats}
      topProfiles={topProfiles}
      scenarioStats={scenarioStats}
      scenarioMetrics={overallScenarioMetrics}
      arenaStats={arenaStats}
      arenaMetrics={overallArenaMetrics}
      recentArenaSummaries={recentArenaSummaries}
      recentReflections={recentReflections}
      badgeAwards={badgeAwards}
      currentProfileId={profile.id}
    />
  )

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Gamification analytics</h1>
        <p className="text-sm text-muted-foreground">
          Monitor badge engagement, quiz performance and points to understand how employees are progressing.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {badgeSummary.map(({ badge, count, lastAwardedAt }) => (
          <Card key={badge.id} className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{badge.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{badge.description}</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Totale assegnazioni</span>
                <Badge variant="secondary" className="text-xs">{count}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Ultimo rilascio: {new Intl.DateTimeFormat('it', { dateStyle: 'medium' }).format(lastAwardedAt)}
              </p>
            </CardContent>
          </Card>
        ))}
        {badgeSummary.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3 rounded-xl border border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nessun badge assegnato finora.
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Punteggi quiz per corso</CardTitle>
            <p className="text-xs text-muted-foreground">Aggregato di tutti i quiz pubblicati per corso.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="hidden text-xs text-muted-foreground lg:grid lg:grid-cols-5 lg:gap-4">
              <span>Corso</span>
              <span>Quiz</span>
              <span>Attempt</span>
              <span>Media punti</span>
              <span>Pass rate</span>
            </div>
            <Separator className="bg-border" />
            <div className="space-y-2">
              {courseStats.map((course) => (
                <div key={course.courseId} className="grid gap-2 rounded-md border border-border/50 bg-card/70 p-4 text-sm lg:grid-cols-5 lg:items-center lg:gap-4">
                  <div>
                    <p className="font-medium text-foreground">{course.courseTitle}</p>
                    <p className="text-xs text-muted-foreground">{course.learners} learner</p>
                  </div>
                  <p>{course.quizCount}</p>
                  <p>{course.totalAttempts}</p>
                  <p>{course.averageScore}</p>
                  <p>{course.passRate}%</p>
                </div>
              ))}
            </div>
            {courseStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun dato sui quiz disponibile.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top performer per punti</CardTitle>
            <p className="text-xs text-muted-foreground">Aggiornato in tempo reale dal registro punti.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topProfiles.map((user) => (
              <div key={user.id} className="rounded-lg border border-border/40 bg-card/70 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{user.userId}</p>
                <p className="text-xs text-muted-foreground">
                  {user.jobTitle ?? '—'} · {user.department ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">Points: {user.points}</p>
              </div>
            ))}
            {topProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun partecipante con punti registrati.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">Decision Labs overview</CardTitle>
            <p className="text-xs text-muted-foreground">
              Monitor performance and risk appetite across interactive scenarios.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Attempts logged</p>
              <p className="text-lg font-semibold text-foreground">{overallScenarioMetrics.attempts}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Average score</p>
              <p className="text-lg font-semibold text-foreground">{overallScenarioMetrics.avgScore}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Average risk</p>
              <p className="text-lg font-semibold text-foreground">
                {overallScenarioMetrics.avgRisk !== null ? `${overallScenarioMetrics.avgRisk}` : '—'}
              </p>
            </div>
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">High-risk decisions</p>
              <p className="text-lg font-semibold text-foreground">{overallScenarioMetrics.highRiskRate}%</p>
            </div>
            <div className="md:col-span-4">
              <p className="text-xs font-semibold text-muted-foreground">Trending competencies</p>
              {overallScenarioMetrics.topCompetencies.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {overallScenarioMetrics.topCompetencies.map(({ tag, count }) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag} · {count}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Run Decision Labs to surface competency insights.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {scenarioStats.length ? (
          <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Scenario performance by course</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-2 font-semibold">Course</th>
                    <th className="py-2 font-semibold">Attempts</th>
                    <th className="py-2 font-semibold">Avg score</th>
                    <th className="py-2 font-semibold">Avg risk</th>
                    <th className="py-2 font-semibold">High-risk choices</th>
                    <th className="py-2 font-semibold">Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {scenarioStats.map((entry) => (
                    <tr key={entry.courseId}>
                      <td className="py-2 text-sm font-medium text-foreground">{entry.courseTitle}</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.attemptCount}</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.avgScore}</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.avgRisk !== null ? entry.avgRisk : '—'}</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.highRiskRate}%</td>
                      <td className="py-2 text-sm text-muted-foreground">
                        {entry.topCompetencies.length
                          ? entry.topCompetencies.map(({ tag }) => tag).join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nessun Decision Lab completato finora. Genera uno scenario dal builder per raccogliere insight comportamentali.
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">Practice Arena overview</CardTitle>
            <p className="text-xs text-muted-foreground">Analizza iterazioni, coaching e Insight Tokens generati.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Tentativi registrati</p>
              <p className="text-lg font-semibold text-foreground">{overallArenaMetrics.attempts}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Punteggio medio</p>
              <p className="text-lg font-semibold text-foreground">{overallArenaMetrics.avgScore}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Miglioramento medio</p>
              <p className="text-lg font-semibold text-foreground">{overallArenaMetrics.avgImprovement}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Iterazioni multi-tentativo</p>
              <p className="text-lg font-semibold text-foreground">{overallArenaMetrics.iterationRate}%</p>
            </div>
            <div className="rounded-md border border-border/40 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Insight Tokens emessi</p>
              <p className="text-lg font-semibold text-foreground">{overallArenaMetrics.totalTokens}</p>
            </div>
          </CardContent>
        </Card>

        {arenaStats.length ? (
          <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Practice Arena per corso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-2 font-semibold">Course</th>
                    <th className="py-2 font-semibold">Attempts</th>
                    <th className="py-2 font-semibold">Avg score</th>
                    <th className="py-2 font-semibold">Avg improvement</th>
                    <th className="py-2 font-semibold">Iteration rate</th>
                    <th className="py-2 font-semibold">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {arenaStats.map((entry) => (
                    <tr key={entry.courseId}>
                      <td className="py-2 text-sm font-medium text-foreground">{entry.courseTitle}</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.attempts}</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.avgScore}</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.avgImprovement}</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.iterationRate}%</td>
                      <td className="py-2 text-sm text-muted-foreground">{entry.totalTokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nessuna Practice Arena ancora attiva. Aggiungi il blocco dal course builder per avviare le iterazioni guidate.
            </CardContent>
          </Card>
        )}

        {recentArenaSummaries.length ? (
          <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Ultime iterazioni Practice Arena</CardTitle>
              <p className="text-xs text-muted-foreground">Insight Tokens e miglioramenti più recenti.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentArenaSummaries.map((item) => {
                const alreadyEndorsed = item.endorsements.some((endorser) => endorser.profileId === profile.id)
                const endorsementCount = item.endorsements.length
                // TODO: reintroduce author check when real users are in place
                const canEndorse = Boolean(item.blockId)
                return (
                  <div key={item.id} className="rounded-md border border-border/40 bg-background/70 p-3 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-foreground">
                        {item.courseTitle} · {item.blockTitle}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Δ {item.scoreDelta !== null ? item.scoreDelta : 0} · Tokens {item.tokens ?? 0}
                        </Badge>
                        {endorsementCount > 0 ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Endorsement {endorsementCount}
                          </Badge>
                        ) : null}
                        {canEndorse ? (
                          <ArenaEndorseButton
                            blockId={item.blockId}
                            attemptId={item.id}
                            alreadyEndorsed={alreadyEndorsed}
                            endorsementBonus={item.endorsementBonus}
                          />
                        ) : null}
                      </div>
                    </div>
                    {item.summary ? <p className="mt-2 text-sm text-foreground">{item.summary}</p> : null}
                    {item.improvementAdvice ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">Coach tip: {item.improvementAdvice}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Intl.DateTimeFormat('it', { dateStyle: 'medium' }).format(item.createdAt)}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : null}

        {recentReflections.length ? (
          <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Recent reflections</CardTitle>
              <p className="text-xs text-muted-foreground">Le risposte aperte aiutano a indirizzare il coaching individuale.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentReflections.map((item) => (
                <div key={item.id} className="rounded-md border border-border/40 bg-background/70 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 text-[11px] font-semibold text-foreground">{item.courseTitle} · {item.blockTitle}</p>
                  <p className="text-sm text-foreground">“{item.response.length > 220 ? `${item.response.slice(0, 220)}…` : item.response}”</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(item.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section>
        <Card className="rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ultimi badge assegnati</CardTitle>
            <p className="text-xs text-muted-foreground">Gli ultimi 25 rilasci del tuo team.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {badgeAwards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ancora nessun badge assegnato nel tuo team.</p>
            ) : (
              badgeAwards.map((award) => (
                <div key={award.id} className="flex flex-col gap-1 rounded-lg border border-border/40 bg-card/70 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{award.userProfile.userId}</p>
                    <p className="text-xs text-muted-foreground">{award.badge.name}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat('it', { dateStyle: 'medium', timeStyle: 'short' }).format(award.awardedAt)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
