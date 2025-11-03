import {
  ChapterCoachMessageRole,
  CourseEnrollmentStatus,
  GamificationContentType,
  PlayerEventType,
  ScenarioAttemptType,
} from '@prisma/client'
import { format, startOfWeek, subDays } from 'date-fns'

import { db } from '@/lib/db'

type CourseLearnerRow = {
  userProfileId: string
  userId: string
  jobTitle: string | null
  status: CourseEnrollmentStatus
  completionRate: number
  coachInteractions: number
  notes: number
  tokensEarned: number
}

type LessonSignal = {
  lessonId: string
  lessonTitle: string
  courseTitle: string
  notes: number
  rewind: number
  coachMessages: number
}

type CourseTimelinePoint = {
  label: string
  completions: number
  coachConversations: number
}

type CourseAnalytics = {
  courseId: string
  courseTitle: string
  totalLearners: number
  completed: number
  inProgress: number
  notStarted: number
  completionRate: number
  averageTimeToComplete: number | null
  learners: CourseLearnerRow[]
  timeline: CourseTimelinePoint[]
  lessonSignals: LessonSignal[]
  practiceArena: {
    tokens: number
    attempts: number
    averageScore: number | null
    endorsements: number
  }
}

const WEEK_OPTIONS = { weekStartsOn: 1 } as const

const weekKey = (date: Date) => startOfWeek(date, WEEK_OPTIONS).toISOString()
const weekLabel = (key: string) => format(new Date(key), 'dd LLL')

const formatCompletionRate = (value: number, totalChapters: number) => {
  if (totalChapters === 0) return 0
  return Math.min(100, Math.max(0, (value / totalChapters) * 100))
}

export async function getCourseAnalytics(courseId: string, companyId: string): Promise<CourseAnalytics> {
  const course = await db.course.findFirst({
    where: { id: courseId, companyId },
    select: { id: true, title: true },
  })

  if (!course) {
    throw new Error('Course not found')
  }

  const now = new Date()
  const timelineStart = subDays(now, 84)

  const [
    totalChapters,
    enrollments,
    completedEnrollments,
    inProgressEnrollments,
    lessonProgress,
    coachMessages,
    comments,
    rewinds,
    arenaAttempts,
    timelineCompletions,
    timelineCoach,
  ] = await Promise.all([
    db.chapter.count({ where: { courseId } }),
    db.courseEnrollment.findMany({
      where: { courseId },
      select: {
        userProfileId: true,
        status: true,
        createdAt: true,
        completedAt: true,
        userProfile: {
          select: {
            id: true,
            userId: true,
            jobTitle: true,
          },
        },
      },
    }),
    db.courseEnrollment.count({ where: { courseId, status: CourseEnrollmentStatus.COMPLETED } }),
    db.courseEnrollment.count({ where: { courseId, status: CourseEnrollmentStatus.IN_PROGRESS } }),
    db.userProgress.findMany({
      where: {
        chapter: { courseId },
        isCompleted: true,
      },
      select: {
        userProfileId: true,
      },
    }),
    db.chapterCoachMessage.findMany({
      where: {
        chapter: { courseId },
        role: ChapterCoachMessageRole.USER,
      },
      select: {
        createdAt: true,
        chapterId: true,
        userProfileId: true,
        chapter: { select: { title: true } },
      },
    }),
    db.chapterComment.findMany({
      where: {
        chapter: { courseId },
      },
      select: {
        createdAt: true,
        chapterId: true,
        userProfileId: true,
        chapter: { select: { title: true } },
      },
    }),
    db.playerEvent.findMany({
      where: {
        chapter: { courseId },
        type: PlayerEventType.REWATCH,
      },
      select: {
        createdAt: true,
        chapterId: true,
        chapter: { select: { title: true } },
      },
    }),
    db.scenarioAttempt.findMany({
      where: {
        attemptType: ScenarioAttemptType.ARENA,
        gamificationBlock: {
          contentType: GamificationContentType.ARENA,
          lessonBlock: {
            lesson: { module: { courseId } },
          },
        },
      },
      select: {
        score: true,
        insightTokens: true,
        reflections: true,
        createdAt: true,
      },
    }),
    db.courseEnrollment.findMany({
      where: {
        courseId,
        status: CourseEnrollmentStatus.COMPLETED,
        completedAt: { gte: timelineStart },
      },
      select: { completedAt: true },
    }),
    db.chapterCoachMessage.findMany({
      where: {
        chapter: { courseId },
        role: ChapterCoachMessageRole.USER,
        createdAt: { gte: timelineStart },
      },
      select: { createdAt: true },
    }),
  ])

  const completedByUser = new Map<string, number>()
  lessonProgress.forEach((record) => {
    completedByUser.set(record.userProfileId, (completedByUser.get(record.userProfileId) ?? 0) + 1)
  })

  const coachPerUser = new Map<string, number>()
  coachMessages.forEach((message) => {
    if (!message.userProfileId) return
    coachPerUser.set(message.userProfileId, (coachPerUser.get(message.userProfileId) ?? 0) + 1)
  })

  const commentsPerUser = new Map<string, number>()
  comments.forEach((comment) => {
    if (!comment.userProfileId) return
    commentsPerUser.set(comment.userProfileId, (commentsPerUser.get(comment.userProfileId) ?? 0) + 1)
  })

  const learners: CourseLearnerRow[] = enrollments.map((enrollment) => {
    const profile = enrollment.userProfile
    const completedChapters = completedByUser.get(enrollment.userProfileId) ?? 0
    const completionRate = formatCompletionRate(completedChapters, totalChapters)

    return {
      userProfileId: profile?.id ?? enrollment.userProfileId,
      userId: profile?.userId ?? 'Utente',
      jobTitle: profile?.jobTitle ?? null,
      status: enrollment.status,
      completionRate,
      coachInteractions: coachPerUser.get(enrollment.userProfileId) ?? 0,
      notes: commentsPerUser.get(enrollment.userProfileId) ?? 0,
      tokensEarned: 0,
    }
  })

  const timelineMap = new Map<string, CourseTimelinePoint>()
  timelineCompletions.forEach((item) => {
    if (!item.completedAt) return
    const key = weekKey(item.completedAt)
    const current = timelineMap.get(key) ?? { label: weekLabel(key), completions: 0, coachConversations: 0 }
    current.completions += 1
    timelineMap.set(key, current)
  })

  timelineCoach.forEach((item) => {
    const key = weekKey(item.createdAt)
    const current = timelineMap.get(key) ?? { label: weekLabel(key), completions: 0, coachConversations: 0 }
    current.coachConversations += 1
    timelineMap.set(key, current)
  })

  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([, value]) => value)

  const lessonMap = new Map<string, LessonSignal>()

  const ensureLesson = (chapterId: string | null | undefined, lessonTitle: string | undefined) => {
    if (!chapterId) return
    const entry = lessonMap.get(chapterId)
    if (!entry) {
      lessonMap.set(chapterId, {
        lessonId: chapterId,
        lessonTitle: lessonTitle ?? 'Lezione',
        courseTitle: course.title,
        notes: 0,
        rewind: 0,
        coachMessages: 0,
      })
    }
  }

  comments.forEach((comment) => {
    ensureLesson(comment.chapterId, comment.chapter?.title)
    const entry = lessonMap.get(comment.chapterId ?? '')
    if (entry) entry.notes += 1
  })

  rewinds.forEach((event) => {
    ensureLesson(event.chapterId, event.chapter?.title)
    const entry = lessonMap.get(event.chapterId ?? '')
    if (entry) entry.rewind += 1
  })

  coachMessages.forEach((message) => {
    ensureLesson(message.chapterId, message.chapter?.title)
    const entry = lessonMap.get(message.chapterId ?? '')
    if (entry) entry.coachMessages += 1
  })

  const practiceTokens = arenaAttempts.reduce((acc, attempt) => acc + (attempt.insightTokens ?? 0), 0)
  const practiceScoreSum = arenaAttempts.reduce((acc, attempt) => acc + (attempt.score ?? 0), 0)
  const endorsements = arenaAttempts.reduce((acc, attempt) => {
    if (!attempt.reflections || typeof attempt.reflections !== 'object') return acc
    const reflections = attempt.reflections as Record<string, unknown>
    const endorsementsValue = reflections.endorsements
    if (Array.isArray(endorsementsValue)) {
      return acc + endorsementsValue.length
    }
    return acc
  }, 0)

  return {
    courseId: course.id,
    courseTitle: course.title,
    totalLearners: enrollments.length,
    completed: completedEnrollments,
    inProgress: inProgressEnrollments,
    notStarted: enrollments.length - completedEnrollments - inProgressEnrollments,
    completionRate: enrollments.length === 0 ? 0 : (completedEnrollments / enrollments.length) * 100,
    averageTimeToComplete: null,
    learners,
    timeline,
    lessonSignals: Array.from(lessonMap.values()).sort((a, b) => b.notes + b.rewind + b.coachMessages - (a.notes + a.rewind + a.coachMessages)).slice(0, 10),
    practiceArena: {
      tokens: practiceTokens,
      attempts: arenaAttempts.length,
      averageScore: arenaAttempts.length === 0 ? null : practiceScoreSum / arenaAttempts.length,
      endorsements,
    },
  }
}
