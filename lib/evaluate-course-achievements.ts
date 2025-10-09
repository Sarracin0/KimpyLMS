import { AchievementUnlockType, PointsType, ScenarioAttemptType } from '@prisma/client'

import { db } from './db'
import { getProgress } from '@/actions/get-progress'

type EvaluateCourseAchievementsOptions = {
  courseId: string
  userProfileId: string
  progressPercentage?: number
}

type ModuleChaptersMap = Record<string, string[]>

type AchievementEligibilityContext = {
  completedChapterIds: Set<string>
  moduleChapters: ModuleChaptersMap
  progressPercentage: number
  completedLessonIds: Set<string>
  quizAttempts: Map<string, { score: number; passed: boolean }>
  scenarioAttempts: Map<string, { score: number; riskLevel: number | null }>
  arenaAttempts: Map<string, { score: number; tokens: number; endorsements: number }>
  coursePoints: number
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

const getString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const getNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return null
}

const getBoolean = (record: Record<string, unknown>, key: string): boolean | null => {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

const getEndorsementCount = (value: unknown): number => {
  const record = asRecord(value)
  if (!record) return 0
  const endorsements = record.endorsements
  if (Array.isArray(endorsements)) {
    return endorsements.length
  }
  return 0
}

const parseQuizCriteria = (criteria: unknown) => {
  const record = asRecord(criteria)
  if (!record) return null
  const quizId = getString(record, 'quizId')
  if (!quizId) return null
  const requirePass = getBoolean(record, 'requirePass') ?? true
  const minScore = getNumber(record, 'minScore')
  return {
    quizId,
    requirePass,
    minScore: typeof minScore === 'number' ? Math.max(0, Math.trunc(minScore)) : null,
  }
}

const parseScenarioCriteria = (criteria: unknown) => {
  const record = asRecord(criteria)
  if (!record) return null
  const gamificationBlockId = getString(record, 'gamificationBlockId')
  if (!gamificationBlockId) return null
  const minScore = getNumber(record, 'minScore')
  const maxRisk = getNumber(record, 'maxRisk')
  return {
    gamificationBlockId,
    minScore: typeof minScore === 'number' ? Math.max(0, Math.trunc(minScore)) : null,
    maxRisk:
      typeof maxRisk === 'number' ? Math.max(0, Math.min(100, Math.trunc(maxRisk))) : null,
  }
}

const parseArenaCriteria = (criteria: unknown) => {
  const record = asRecord(criteria)
  if (!record) return null
  const gamificationBlockId = getString(record, 'gamificationBlockId')
  if (!gamificationBlockId) return null
  const minScore = getNumber(record, 'minScore')
  const minTokens = getNumber(record, 'minTokens')
  const minEndorsements = getNumber(record, 'minEndorsements')
  return {
    gamificationBlockId,
    minScore: typeof minScore === 'number' ? Math.max(0, Math.trunc(minScore)) : null,
    minTokens: typeof minTokens === 'number' ? Math.max(0, Math.trunc(minTokens)) : null,
    minEndorsements:
      typeof minEndorsements === 'number' ? Math.max(0, Math.trunc(minEndorsements)) : null,
  }
}

const parseCoursePointsCriteria = (criteria: unknown) => {
  const record = asRecord(criteria)
  if (!record) return null
  const pointsThreshold = getNumber(record, 'pointsThreshold')
  if (pointsThreshold == null) return null
  return {
    pointsThreshold: Math.max(1, Math.trunc(pointsThreshold)),
  }
}

const parseLessonCriteria = (criteria: unknown) => {
  const record = asRecord(criteria)
  if (!record) return null
  const lessonId = getString(record, 'lessonId')
  const deckId = getString(record, 'deckId')
  return { lessonId, deckId }
}

const buildModuleChapterMap = async (moduleIds: string[]): Promise<ModuleChaptersMap> => {
  if (moduleIds.length === 0) {
    return {}
  }

  const blocks = await db.lessonBlock.findMany({
    where: {
      lesson: {
        moduleId: { in: moduleIds },
      },
      legacyChapterId: { not: null },
    },
    select: {
      legacyChapterId: true,
      lesson: {
        select: {
          moduleId: true,
        },
      },
    },
  })

  return blocks.reduce<ModuleChaptersMap>((accumulator, block) => {
    const moduleId = block.lesson.moduleId
    if (!block.legacyChapterId) {
      return accumulator
    }

    if (!accumulator[moduleId]) {
      accumulator[moduleId] = []
    }

    if (!accumulator[moduleId].includes(block.legacyChapterId)) {
      accumulator[moduleId].push(block.legacyChapterId)
    }
    return accumulator
  }, {})
}

const isAchievementEligible = (
  achievement: {
    unlockType: AchievementUnlockType
    targetModuleId?: string | null
    targetLessonId?: string | null
    criteria?: unknown
  },
  context: AchievementEligibilityContext,
): boolean => {
  switch (achievement.unlockType) {
    case AchievementUnlockType.FIRST_CHAPTER:
      return context.completedChapterIds.size > 0
    case AchievementUnlockType.MODULE_COMPLETION: {
      const moduleId = achievement.targetModuleId
      if (!moduleId) {
        return false
      }
      const chapters = context.moduleChapters[moduleId] ?? []
      if (chapters.length === 0) {
        return false
      }
      return chapters.every((chapterId) => context.completedChapterIds.has(chapterId))
    }
    case AchievementUnlockType.COURSE_COMPLETION:
      return context.progressPercentage >= 100
    case AchievementUnlockType.LESSON_COMPLETION: {
      const parsed = parseLessonCriteria(achievement.criteria)
      const lessonId = achievement.targetLessonId ?? parsed?.lessonId
      if (!lessonId) {
        return false
      }
      return context.completedLessonIds.has(lessonId)
    }
    case AchievementUnlockType.QUIZ_SCORE: {
      const parsed = parseQuizCriteria(achievement.criteria)
      if (!parsed) {
        return false
      }
      const attempt = context.quizAttempts.get(parsed.quizId)
      if (!attempt) {
        return false
      }
      if (parsed.requirePass && !attempt.passed) {
        return false
      }
      if (parsed.minScore != null && attempt.score < parsed.minScore) {
        return false
      }
      return true
    }
    case AchievementUnlockType.SCENARIO_PERFORMANCE: {
      const parsed = parseScenarioCriteria(achievement.criteria)
      if (!parsed) {
        return false
      }
      const attempt = context.scenarioAttempts.get(parsed.gamificationBlockId)
      if (!attempt) {
        return false
      }
      if (parsed.minScore != null && attempt.score < parsed.minScore) {
        return false
      }
      if (
        parsed.maxRisk != null &&
        typeof attempt.riskLevel === 'number' &&
        attempt.riskLevel > parsed.maxRisk
      ) {
        return false
      }
      return true
    }
    case AchievementUnlockType.ARENA_PERFORMANCE: {
      const parsed = parseArenaCriteria(achievement.criteria)
      if (!parsed) {
        return false
      }
      const attempt = context.arenaAttempts.get(parsed.gamificationBlockId)
      if (!attempt) {
        return false
      }
      if (parsed.minScore != null && attempt.score < parsed.minScore) {
        return false
      }
      if (parsed.minTokens != null && attempt.tokens < parsed.minTokens) {
        return false
      }
      if (parsed.minEndorsements != null && attempt.endorsements < parsed.minEndorsements) {
        return false
      }
      return true
    }
    case AchievementUnlockType.COURSE_POINTS: {
      const parsed = parseCoursePointsCriteria(achievement.criteria)
      if (!parsed) {
        return false
      }
      return context.coursePoints >= parsed.pointsThreshold
    }
    default:
      return false
  }
}

export const evaluateCourseAchievements = async ({
  courseId,
  userProfileId,
  progressPercentage,
}: EvaluateCourseAchievementsOptions) => {
  const achievements = await db.courseAchievement.findMany({
    where: {
      courseId,
      isActive: true,
    },
  })

  if (achievements.length === 0) {
    return
  }

  const awarded = await db.userCourseAchievement.findMany({
    where: {
      userProfileId,
      achievement: {
        courseId,
      },
    },
    select: { achievementId: true },
  })

  const alreadyAwardedIds = new Set(awarded.map((item) => item.achievementId))

  const chapterProgress = await db.userProgress.findMany({
    where: {
      userProfileId,
      isCompleted: true,
      chapter: {
        courseId,
      },
    },
    select: { chapterId: true },
  })

  const completedChapterIds = new Set(chapterProgress.map((item) => item.chapterId))

  const moduleIds = achievements
    .filter((item) => item.unlockType === AchievementUnlockType.MODULE_COMPLETION && item.targetModuleId)
    .map((item) => item.targetModuleId as string)

  const moduleChapters = await buildModuleChapterMap(Array.from(new Set(moduleIds)))

  const requiresLessonProgress = achievements.some((achievement) =>
    [
      AchievementUnlockType.LESSON_COMPLETION,
      AchievementUnlockType.SCENARIO_PERFORMANCE,
      AchievementUnlockType.ARENA_PERFORMANCE,
      AchievementUnlockType.QUIZ_SCORE,
    ].includes(
      achievement.unlockType,
    ),
  )

  const lessonProgress = requiresLessonProgress
    ? await db.userLessonProgress.findMany({
        where: {
          userProfileId,
          isCompleted: true,
          lesson: {
            module: {
              courseId,
            },
          },
        },
        select: { lessonId: true },
      })
    : []

  const completedLessonIds = new Set(lessonProgress.map((item) => item.lessonId))

  const quizIds = achievements
    .map((achievement) => parseQuizCriteria(achievement.criteria)?.quizId)
    .filter((value): value is string => Boolean(value))

  const uniqueQuizIds = Array.from(new Set(quizIds))

  const quizAttempts = uniqueQuizIds.length
    ? await db.quizAttempt.findMany({
        where: {
          userProfileId,
          quizId: { in: uniqueQuizIds },
          submittedAt: { not: null },
        },
        orderBy: [{ score: 'desc' }, { submittedAt: 'desc' }],
      })
    : []

  const quizAttemptMap = quizAttempts.reduce<Map<string, { score: number; passed: boolean }>>(
    (accumulator, attempt) => {
      const existing = accumulator.get(attempt.quizId)
      if (!existing || attempt.score > existing.score) {
        accumulator.set(attempt.quizId, { score: attempt.score, passed: attempt.passed })
      }
      return accumulator
    },
    new Map(),
  )

  const scenarioIds = achievements
    .map((achievement) => parseScenarioCriteria(achievement.criteria)?.gamificationBlockId)
    .filter((value): value is string => Boolean(value))

  const arenaIds = achievements
    .map((achievement) => parseArenaCriteria(achievement.criteria)?.gamificationBlockId)
    .filter((value): value is string => Boolean(value))

  const uniqueScenarioIds = Array.from(new Set(scenarioIds))
  const uniqueArenaIds = Array.from(new Set(arenaIds))
  const gamificationIds = Array.from(new Set([...uniqueScenarioIds, ...uniqueArenaIds]))

  const scenarioAttempts = gamificationIds.length
    ? await db.scenarioAttempt.findMany({
        where: {
          userProfileId,
          gamificationBlockId: { in: gamificationIds },
        },
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      })
    : []

  const scenarioAttemptMap = new Map<string, { score: number; riskLevel: number | null }>()
  const arenaAttemptMap = new Map<string, { score: number; tokens: number; endorsements: number }>()

  for (const attempt of scenarioAttempts) {
    if (attempt.attemptType === ScenarioAttemptType.ARENA) {
      const existing = arenaAttemptMap.get(attempt.gamificationBlockId)
      const endorsements = getEndorsementCount(attempt.reflections)
      const candidate = {
        score: attempt.score,
        tokens: Math.max(0, attempt.insightTokens ?? 0),
        endorsements,
      }

      if (
        !existing ||
        candidate.score > existing.score ||
        (candidate.score === existing.score && candidate.tokens > existing.tokens)
      ) {
        arenaAttemptMap.set(attempt.gamificationBlockId, candidate)
      }
    } else {
      const existing = scenarioAttemptMap.get(attempt.gamificationBlockId)
      if (!existing || attempt.score > existing.score) {
        scenarioAttemptMap.set(attempt.gamificationBlockId, {
          score: attempt.score,
          riskLevel: typeof attempt.riskLevel === 'number' ? attempt.riskLevel : null,
        })
      }
    }
  }

  const [chapterPointsAgg, lessonPointsAgg, achievementPointsAgg] = await Promise.all([
    db.userProgress.aggregate({
      where: {
        userProfileId,
        chapter: {
          courseId,
        },
      },
      _sum: { pointsAwarded: true },
    }),
    db.userLessonProgress.aggregate({
      where: {
        userProfileId,
        lesson: {
          module: {
            courseId,
          },
        },
      },
      _sum: { pointsAwarded: true },
    }),
    db.userCourseAchievement.aggregate({
      where: {
        userProfileId,
        achievement: {
          courseId,
        },
      },
      _sum: { pointsAwarded: true },
    }),
  ])

  const coursePoints =
    (chapterPointsAgg._sum.pointsAwarded ?? 0) +
    (lessonPointsAgg._sum.pointsAwarded ?? 0) +
    (achievementPointsAgg._sum.pointsAwarded ?? 0)

  const computedProgress =
    typeof progressPercentage === 'number' ? progressPercentage : await getProgress(userProfileId, courseId)

  const context: AchievementEligibilityContext = {
    completedChapterIds,
    moduleChapters,
    progressPercentage: computedProgress,
    completedLessonIds,
    quizAttempts: quizAttemptMap,
    scenarioAttempts: scenarioAttemptMap,
    arenaAttempts: arenaAttemptMap,
    coursePoints,
  }

  for (const achievement of achievements) {
    if (alreadyAwardedIds.has(achievement.id)) {
      continue
    }

    if (!isAchievementEligible(achievement, context)) {
      continue
    }

    const pointsReward = Math.max(0, achievement.pointsReward || 0)

    await db.$transaction(async (transaction) => {
      await transaction.userCourseAchievement.create({
        data: {
          achievementId: achievement.id,
          userProfileId,
          pointsAwarded: pointsReward,
        },
      })

      if (pointsReward > 0) {
        await transaction.userProfile.update({
          where: { id: userProfileId },
          data: { points: { increment: pointsReward } },
        })

        await transaction.userPoints.create({
          data: {
            userProfileId,
            delta: pointsReward,
            type: PointsType.BONUS,
            referenceId: achievement.id,
            reason: `Achievement unlocked: ${achievement.title}`,
          },
        })
      }
    })
  }
}
