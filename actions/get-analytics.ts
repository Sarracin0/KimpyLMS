import {
  ChapterCoachMessageRole,
  CourseEnrollmentStatus,
  GamificationContentType,
  PlayerEventType,
  ScenarioAttemptType,
  UserRole,
} from '@prisma/client'
import { format, startOfWeek, subDays } from 'date-fns'

import { db } from '@/lib/db'

type Metric = {
  value: number
  delta: number | null
}

type TimelinePoint = {
  label: string
  completions: number
  aiInteractions: number
}

type CourseLeaderboardRow = {
  courseId: string
  title: string
  completionRate: number
  learners: number
  completions: number
  inProgress: number
  aiCoachInteractions: number
  comments: number
  practiceArenaTokens: number
  practiceArenaScore: number | null
}

type PracticeArenaSummary = {
  totalTokens: number
  totalAttempts: number
  averageScore: number | null
  endorsements: number
  topArenas: Array<{
    courseTitle: string
    lessonTitle: string
    avgScore: number | null
    avgTokens: number
    attempts: number
  }>
}

type SpotlightItem = {
  courseTitle: string
  itemTitle: string
  count: number
}

type EngagementSpotlight = {
  aiCoach: SpotlightItem[]
  rewinds: SpotlightItem[]
  notes: SpotlightItem[]
}

type AnalyticsResponse = {
  totals: {
    totalLearners: number
    averageCompletionRate: number
  }
  pulse: {
    activeLearners: Metric
    completions: Metric
    aiCoach: Metric
    arenaTokens: Metric
  }
  timeline: TimelinePoint[]
  courseLeaderboard: CourseLeaderboardRow[]
  practiceArena: PracticeArenaSummary
  spotlight: EngagementSpotlight
}

const WEEK_OPTIONS = { weekStartsOn: 1 } as const

const toWeekKey = (date: Date) => startOfWeek(date, WEEK_OPTIONS).toISOString()

const computeDelta = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return current === 0 ? 0 : null
  }
  return ((current - previous) / previous) * 100
}

const formatWeekLabel = (key: string) => {
  const weekDate = new Date(key)
  return format(weekDate, 'dd LLL')
}

const getEndorsementCount = (value: unknown): number => {
  if (!value || typeof value !== 'object') return 0
  const record = value as Record<string, unknown>
  const endorsements = record.endorsements
  if (Array.isArray(endorsements)) {
    return endorsements.length
  }
  return 0
}

export async function getAnalytics(companyId: string): Promise<AnalyticsResponse> {
  const now = new Date()
  const periodStart = subDays(now, 30)
  const previousPeriodStart = subDays(periodStart, 30)
  const attentionStart = subDays(now, 14)
  const timelineStart = subDays(now, 84)

  const [
    totalLearners,
    activeLearnersCurrent,
    activeLearnersPrevious,
    completionsCurrent,
    completionsPrevious,
    coachMessagesDetailed,
    coachMessagesPrevious,
    commentsDetailed,
    replayEvents,
    arenaAttemptsCurrent,
    arenaAttemptsPrevious,
    courseEnrollmentGroups,
    courses,
    timelineCompletions,
    timelineCoachMessages,
  ] = await Promise.all([
    db.userProfile.count({ where: { companyId, role: UserRole.LEARNER } }),
    db.userLessonProgress.count({
      where: {
        lesson: { module: { course: { companyId } } },
        updatedAt: { gte: periodStart },
      },
      distinct: ['userProfileId'],
    }),
    db.userLessonProgress.count({
      where: {
        lesson: { module: { course: { companyId } } },
        updatedAt: { gte: previousPeriodStart, lt: periodStart },
      },
      distinct: ['userProfileId'],
    }),
    db.courseEnrollment.count({
      where: {
        course: { companyId },
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt: { gte: periodStart },
      },
    }),
    db.courseEnrollment.count({
      where: {
        course: { companyId },
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt: { gte: previousPeriodStart, lt: periodStart },
      },
    }),
    db.chapterCoachMessage.findMany({
      where: {
        chapter: { course: { companyId } },
        role: ChapterCoachMessageRole.USER,
        createdAt: { gte: periodStart },
      },
      select: {
        createdAt: true,
        chapterId: true,
        chapter: {
          select: {
            title: true,
            courseId: true,
            course: { select: { title: true } },
          },
        },
      },
    }),
    db.chapterCoachMessage.count({
      where: {
        chapter: { course: { companyId } },
        role: ChapterCoachMessageRole.USER,
        createdAt: { gte: previousPeriodStart, lt: periodStart },
      },
    }),
    db.chapterComment.findMany({
      where: {
        chapter: { course: { companyId } },
        createdAt: { gte: periodStart },
      },
      select: {
        createdAt: true,
        chapterId: true,
        chapter: {
          select: {
            title: true,
            courseId: true,
            course: { select: { title: true } },
          },
        },
      },
    }),
    db.playerEvent.findMany({
      where: {
        chapter: { course: { companyId } },
        type: PlayerEventType.REWATCH,
        createdAt: { gte: periodStart },
      },
      select: {
        createdAt: true,
        chapterId: true,
        chapter: {
          select: {
            title: true,
            courseId: true,
            course: { select: { title: true } },
          },
        },
      },
    }),
    db.scenarioAttempt.findMany({
      where: {
        attemptType: ScenarioAttemptType.ARENA,
        createdAt: { gte: periodStart },
        gamificationBlock: {
          contentType: GamificationContentType.ARENA,
          lessonBlock: {
            lesson: {
              module: {
                course: { companyId },
                courseId: true,
              },
            },
          },
        },
      },
      select: {
        score: true,
        insightTokens: true,
        reflections: true,
        gamificationBlock: {
          select: {
            id: true,
            lessonBlock: {
              select: {
                lesson: {
                  select: {
                    title: true,
                    module: {
                      select: {
                        courseId: true,
                        course: { select: { title: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.scenarioAttempt.findMany({
      where: {
        attemptType: ScenarioAttemptType.ARENA,
        createdAt: { gte: previousPeriodStart, lt: periodStart },
        gamificationBlock: {
          contentType: GamificationContentType.ARENA,
          lessonBlock: {
            lesson: {
              module: {
                course: { companyId },
              },
            },
          },
        },
      },
      select: {
        insightTokens: true,
      },
    }),
    db.courseEnrollment.groupBy({
      by: ['courseId', 'status'],
      where: { course: { companyId } },
      _count: { _all: true },
    }),
    db.course.findMany({
      where: { companyId },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
    db.courseEnrollment.findMany({
      where: {
        course: { companyId },
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt: { gte: timelineStart },
      },
      select: { completedAt: true },
    }),
    db.chapterCoachMessage.findMany({
      where: {
        chapter: { course: { companyId } },
        role: ChapterCoachMessageRole.USER,
        createdAt: { gte: timelineStart },
      },
      select: { createdAt: true },
    }),
  ])

  const deltaActiveLearners = computeDelta(activeLearnersCurrent, activeLearnersPrevious)
  const deltaCompletions = computeDelta(completionsCurrent, completionsPrevious)
  const aiCoachCurrent = coachMessagesDetailed.length
  const deltaAiCoach = computeDelta(aiCoachCurrent, coachMessagesPrevious)

  const arenaTokensCurrent = arenaAttemptsCurrent.reduce((total, attempt) => total + (attempt.insightTokens ?? 0), 0)
  const arenaTokensPrevious = arenaAttemptsPrevious.reduce(
    (total, attempt) => total + (attempt.insightTokens ?? 0),
    0,
  )
  const deltaArenaTokens = computeDelta(arenaTokensCurrent, arenaTokensPrevious)

  const timelineMap = new Map<string, TimelinePoint>()

  for (const item of timelineCompletions) {
    if (!item.completedAt) continue
    const key = toWeekKey(item.completedAt)
    const existing = timelineMap.get(key) ?? { label: formatWeekLabel(key), completions: 0, aiInteractions: 0 }
    existing.completions += 1
    timelineMap.set(key, existing)
  }

  for (const message of timelineCoachMessages) {
    const key = toWeekKey(message.createdAt)
    const existing = timelineMap.get(key) ?? { label: formatWeekLabel(key), completions: 0, aiInteractions: 0 }
    existing.aiInteractions += 1
    timelineMap.set(key, existing)
  }

  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([, value]) => value)

  const courseMap = new Map<string, CourseLeaderboardRow>()

  courses.forEach((course) => {
    courseMap.set(course.id, {
      courseId: course.id,
      title: course.title,
      completionRate: 0,
      learners: 0,
      completions: 0,
      inProgress: 0,
      aiCoachInteractions: 0,
      comments: 0,
      practiceArenaTokens: 0,
      practiceArenaScore: null,
    })
  })

  let totalEnrollments = 0
  let totalCompletedEnrollments = 0

  for (const group of courseEnrollmentGroups) {
    const row = courseMap.get(group.courseId)
    if (!row) continue
    const count = group._count._all
    totalEnrollments += count
    if (group.status === CourseEnrollmentStatus.COMPLETED) {
      row.completions += count
      totalCompletedEnrollments += count
    }
    if (group.status === CourseEnrollmentStatus.IN_PROGRESS) {
      row.inProgress += count
    }
    row.learners += count
  }

  for (const row of courseMap.values()) {
    const denominator = Math.max(1, row.learners)
    row.completionRate = (row.completions / denominator) * 100
  }

  const aiByCourse = new Map<string, { total: number; recent: number }>()
  const aiByChapter = new Map<string, SpotlightItem>()

  for (const message of coachMessagesDetailed) {
    const courseId = message.chapter?.courseId ?? null
    const courseTitle = message.chapter?.course?.title ?? 'Unnamed course'
    if (!courseId) continue

    const aiCourse = aiByCourse.get(courseId) ?? { total: 0, recent: 0 }
    aiCourse.total += 1
    if (message.createdAt >= attentionStart) {
      aiCourse.recent += 1
      const chapterKey = message.chapterId ?? ''
      const chapterTitle = message.chapter?.title ?? 'Chapter'
      const chapterEntry = aiByChapter.get(chapterKey) ?? {
        courseTitle,
        itemTitle: chapterTitle,
        count: 0,
      }
      chapterEntry.count += 1
      aiByChapter.set(chapterKey, chapterEntry)
    }
    aiByCourse.set(courseId, aiCourse)
  }

  const commentsByCourse = new Map<string, { total: number; recent: number }>()
  const commentsByChapter = new Map<string, SpotlightItem>()

  for (const comment of commentsDetailed) {
    const courseId = comment.chapter?.courseId ?? null
    const courseTitle = comment.chapter?.course?.title ?? 'Unnamed course'
    if (!courseId) continue

    const commentEntry = commentsByCourse.get(courseId) ?? { total: 0, recent: 0 }
    commentEntry.total += 1
    if (comment.createdAt >= attentionStart) {
      commentEntry.recent += 1
      const chapterKey = comment.chapterId ?? ''
      const chapterTitle = comment.chapter?.title ?? 'Chapter'
      const chapterSpotlight = commentsByChapter.get(chapterKey) ?? {
        courseTitle,
        itemTitle: chapterTitle,
        count: 0,
      }
      chapterSpotlight.count += 1
      commentsByChapter.set(chapterKey, chapterSpotlight)
    }
    commentsByCourse.set(courseId, commentEntry)
  }

  const replayByChapter = new Map<string, SpotlightItem>()
  const replayByCourse = new Map<string, number>()

  for (const event of replayEvents) {
    const courseId = event.chapter?.courseId ?? null
    const courseTitle = event.chapter?.course?.title ?? 'Unnamed course'
    if (!courseId) continue

    if (event.createdAt >= attentionStart) {
      const chapterKey = event.chapterId ?? ''
      const chapterTitle = event.chapter?.title ?? 'Chapter'
      const replayEntry = replayByChapter.get(chapterKey) ?? {
        courseTitle,
        itemTitle: chapterTitle,
        count: 0,
      }
      replayEntry.count += 1
      replayByChapter.set(chapterKey, replayEntry)
    }
    replayByCourse.set(courseId, (replayByCourse.get(courseId) ?? 0) + 1)
  }

  const arenaByCourse = new Map<string, { tokens: number; attempts: number; scoreSum: number }>()
  const arenaByBlock = new Map<
    string,
    {
      courseTitle: string
      lessonTitle: string
      tokens: number
      attempts: number
      scoreSum: number
    }
  >()
  let arenaScoreSum = 0
  let arenaEndorsements = 0

  for (const attempt of arenaAttemptsCurrent) {
    const block = attempt.gamificationBlock
    const lesson = block?.lessonBlock?.lesson
    const courseId = lesson?.module?.courseId
    const courseTitle = lesson?.module?.course?.title ?? 'Course'
    const lessonTitle = lesson?.title ?? 'Lesson'
    const tokens = attempt.insightTokens ?? 0
    const score = attempt.score ?? 0

    arenaScoreSum += score
    arenaEndorsements += getEndorsementCount(attempt.reflections)

    if (courseId) {
      const arenaCourse = arenaByCourse.get(courseId) ?? { tokens: 0, attempts: 0, scoreSum: 0 }
      arenaCourse.tokens += tokens
      arenaCourse.attempts += 1
      arenaCourse.scoreSum += score
      arenaByCourse.set(courseId, arenaCourse)
    }

    if (block?.id) {
      const blockStats = arenaByBlock.get(block.id) ?? {
        courseTitle,
        lessonTitle,
        tokens: 0,
        attempts: 0,
        scoreSum: 0,
      }
      blockStats.tokens += tokens
      blockStats.attempts += 1
      blockStats.scoreSum += score
      arenaByBlock.set(block.id, blockStats)
    }
  }

  for (const [courseId, stats] of arenaByCourse.entries()) {
    const courseRow = courseMap.get(courseId)
    if (!courseRow) continue
    courseRow.practiceArenaTokens = stats.tokens
    courseRow.practiceArenaScore = stats.attempts === 0 ? null : stats.scoreSum / stats.attempts
  }

  for (const [courseId, stats] of aiByCourse.entries()) {
    const row = courseMap.get(courseId)
    if (!row) continue
    row.aiCoachInteractions = stats.total
  }

  for (const [courseId, stats] of commentsByCourse.entries()) {
    const row = courseMap.get(courseId)
    if (!row) continue
    row.comments = stats.total
  }

  const courseLeaderboard = Array.from(courseMap.values())
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 8)

  const totalArenaAttempts = arenaAttemptsCurrent.length
  const practiceArena: PracticeArenaSummary = {
    totalTokens: arenaTokensCurrent,
    totalAttempts: totalArenaAttempts,
    averageScore:
      totalArenaAttempts === 0 ? null : arenaScoreSum / totalArenaAttempts,
    endorsements: arenaEndorsements,
    topArenas: Array.from(arenaByBlock.values())
      .map((item) => ({
        courseTitle: item.courseTitle,
        lessonTitle: item.lessonTitle,
        avgScore: item.attempts === 0 ? null : item.scoreSum / item.attempts,
        avgTokens: item.attempts === 0 ? 0 : item.tokens / item.attempts,
        attempts: item.attempts,
      }))
      .sort((a, b) => b.avgTokens - a.avgTokens)
      .slice(0, 3),
  }

  const spotlight: EngagementSpotlight = {
    aiCoach: Array.from(aiByChapter.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    rewinds: Array.from(replayByChapter.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    notes: Array.from(commentsByChapter.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
  }

  const averageCompletionRate = totalEnrollments === 0 ? 0 : (totalCompletedEnrollments / totalEnrollments) * 100

  return {
    totals: {
      totalLearners,
      averageCompletionRate,
    },
    pulse: {
      activeLearners: {
        value: activeLearnersCurrent,
        delta: deltaActiveLearners,
      },
      completions: {
        value: completionsCurrent,
        delta: deltaCompletions,
      },
      aiCoach: {
        value: aiCoachCurrent,
        delta: deltaAiCoach,
      },
      arenaTokens: {
        value: arenaTokensCurrent,
        delta: deltaArenaTokens,
      },
    },
    timeline,
    courseLeaderboard,
    practiceArena,
    spotlight,
  }
}
