import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { UserRole } from '@prisma/client'

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
                <span className="text-xs font-semibold text-[#5D62E1]">+{entry.delta}</span>
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
                <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded-l-md bg-[#5D62E1]/80" />
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

  const [badgeAwards, quizList, topProfiles] = await Promise.all([
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
  ])

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
