import { NextRequest, NextResponse } from 'next/server'
import { AchievementUnlockType, GamificationContentType, UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{
  courseId: string
}>

const includeRelations = {
  targetModule: {
    select: {
      id: true,
      title: true,
    },
  },
  targetLesson: {
    select: {
      id: true,
      title: true,
    },
  },
}

export async function GET(_request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId } = await params

    const course = await db.course.findFirst({
      where:
        profile.role === UserRole.HR_ADMIN
          ? { id: courseId, companyId: company.id }
          : { id: courseId, companyId: company.id, createdByProfileId: profile.id },
      select: { id: true },
    })

    if (!course) {
      return new NextResponse('Course not found', { status: 404 })
    }

    const achievements = await db.courseAchievement.findMany({
      where: { courseId: course.id },
      include: includeRelations,
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(achievements)
  } catch (error) {
    logError('COURSE_ACHIEVEMENTS_GET', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId } = await params
    const payload = await request.json()

    const course = await db.course.findFirst({
      where:
        profile.role === UserRole.HR_ADMIN
          ? { id: courseId, companyId: company.id }
          : { id: courseId, companyId: company.id, createdByProfileId: profile.id },
      select: { id: true },
    })

    if (!course) {
      return new NextResponse('Course not found', { status: 404 })
    }

    const unlockTypeValue = String(payload.unlockType ?? '')
    const unlockType = Object.values(AchievementUnlockType).includes(unlockTypeValue as AchievementUnlockType)
      ? (unlockTypeValue as AchievementUnlockType)
      : null

    if (!unlockType) {
      return new NextResponse('Invalid unlock type', { status: 400 })
    }

    const title = typeof payload.title === 'string' ? payload.title.trim() : ''
    if (!title) {
      return new NextResponse('Title is required', { status: 400 })
    }

    const description = typeof payload.description === 'string' ? payload.description.trim() : undefined

    const pointsReward = Number.isFinite(payload.pointsReward) ? Math.max(0, Math.trunc(payload.pointsReward)) : 0

    let targetModuleId: string | null =
      typeof payload.targetModuleId === 'string' && payload.targetModuleId.trim().length > 0
        ? payload.targetModuleId
        : null

    let targetLessonId: string | null =
      typeof payload.targetLessonId === 'string' && payload.targetLessonId.trim().length > 0
        ? payload.targetLessonId
        : null

    const criteriaInput =
      payload.criteria && typeof payload.criteria === 'object' && !Array.isArray(payload.criteria)
        ? (payload.criteria as Record<string, unknown>)
        : null

    let sanitizedCriteria: Record<string, unknown> | null = null

    if (unlockType === AchievementUnlockType.MODULE_COMPLETION) {
      if (!targetModuleId) {
        return new NextResponse('Module is required for module completion achievements', { status: 400 })
      }

      const courseModuleRecord = await db.courseModule.findFirst({
        where: { id: targetModuleId, courseId: course.id },
        select: { id: true },
      })

      if (!courseModuleRecord) {
        return new NextResponse('Module not found for this course', { status: 400 })
      }
    }

    if (unlockType === AchievementUnlockType.LESSON_COMPLETION) {
      if (criteriaInput && typeof (criteriaInput as { deckId?: unknown }).deckId === 'string') {
        const deckId = (criteriaInput as { deckId: string }).deckId
        const deck = await db.flashcardDeck.findFirst({
          where: {
            id: deckId,
            gamificationBlock: {
              lessonBlock: {
                lesson: {
                  module: {
                    courseId: course.id,
                  },
                },
              },
            },
          },
          select: {
            id: true,
            gamificationBlock: {
              select: {
                lessonBlock: {
                  select: {
                    lessonId: true,
                    lesson: { select: { moduleId: true } },
                  },
                },
              },
            },
          },
        })

        if (!deck || !deck.gamificationBlock?.lessonBlock) {
          return new NextResponse('Flashcard deck not found for this course', { status: 400 })
        }

        targetLessonId = deck.gamificationBlock.lessonBlock.lessonId
        targetModuleId = deck.gamificationBlock.lessonBlock.lesson.moduleId
        sanitizedCriteria = { deckId: deck.id, lessonId: targetLessonId }
      } else if (targetLessonId) {
        const lesson = await db.lesson.findFirst({
          where: { id: targetLessonId, module: { courseId: course.id } },
          select: { id: true, moduleId: true },
        })

        if (!lesson) {
          return new NextResponse('Lesson not found for this course', { status: 400 })
        }

        targetModuleId = targetModuleId ?? lesson.moduleId
        sanitizedCriteria = { lessonId: lesson.id }
      } else {
        return new NextResponse('Lesson is required for lesson completion achievements', { status: 400 })
      }
    }

    if (unlockType === AchievementUnlockType.QUIZ_SCORE) {
      const quizId =
        criteriaInput && typeof (criteriaInput as { quizId?: unknown }).quizId === 'string'
          ? (criteriaInput as { quizId: string }).quizId
          : null

      if (!quizId) {
        return new NextResponse('Quiz is required for quiz score achievements', { status: 400 })
      }

      const quiz = await db.quiz.findFirst({
        where: {
          id: quizId,
          lessonBlock: {
            lesson: {
              module: {
                courseId: course.id,
              },
            },
          },
        },
        select: {
          id: true,
          lessonBlock: {
            select: {
              lessonId: true,
              lesson: { select: { moduleId: true } },
            },
          },
        },
      })

      if (!quiz || !quiz.lessonBlock) {
        return new NextResponse('Quiz not found for this course', { status: 400 })
      }

      targetLessonId = quiz.lessonBlock.lessonId
      targetModuleId = targetModuleId ?? quiz.lessonBlock.lesson.moduleId

      const requirePass =
        criteriaInput && typeof (criteriaInput as { requirePass?: unknown }).requirePass === 'boolean'
          ? Boolean((criteriaInput as { requirePass?: boolean }).requirePass)
          : true
      const minScoreRaw =
        criteriaInput && typeof (criteriaInput as { minScore?: unknown }).minScore === 'number'
          ? (criteriaInput as { minScore?: number }).minScore
          : null
      const minScore = minScoreRaw != null ? Math.max(0, Math.trunc(minScoreRaw)) : null

      sanitizedCriteria = {
        quizId: quiz.id,
        requirePass,
        ...(minScore != null ? { minScore } : {}),
      }
    }

    if (unlockType === AchievementUnlockType.SCENARIO_PERFORMANCE) {
      const gamificationBlockId =
        criteriaInput && typeof (criteriaInput as { gamificationBlockId?: unknown }).gamificationBlockId === 'string'
          ? (criteriaInput as { gamificationBlockId: string }).gamificationBlockId
          : null

      if (!gamificationBlockId) {
        return new NextResponse('Decision Lab id is required for scenario achievements', { status: 400 })
      }

      const block = await db.gamificationBlock.findFirst({
        where: {
          id: gamificationBlockId,
          contentType: GamificationContentType.SCENARIO,
          lessonBlock: {
            lesson: {
              module: {
                courseId: course.id,
              },
            },
          },
        },
        select: {
          id: true,
          lessonBlock: {
            select: {
              lessonId: true,
              lesson: { select: { moduleId: true } },
            },
          },
        },
      })

      if (!block || !block.lessonBlock) {
        return new NextResponse('Decision Lab not found for this course', { status: 400 })
      }

      targetLessonId = block.lessonBlock.lessonId
      targetModuleId = targetModuleId ?? block.lessonBlock.lesson.moduleId

      const minScoreRaw =
        criteriaInput && typeof (criteriaInput as { minScore?: unknown }).minScore === 'number'
          ? (criteriaInput as { minScore?: number }).minScore
          : null
      const minScore = minScoreRaw != null ? Math.max(0, Math.trunc(minScoreRaw)) : null

      const maxRiskRaw =
        criteriaInput && typeof (criteriaInput as { maxRisk?: unknown }).maxRisk === 'number'
          ? (criteriaInput as { maxRisk?: number }).maxRisk
          : null
      const maxRisk = maxRiskRaw != null ? Math.min(100, Math.max(0, Math.trunc(maxRiskRaw))) : null

      sanitizedCriteria = {
        gamificationBlockId: block.id,
        ...(minScore != null ? { minScore } : {}),
        ...(maxRisk != null ? { maxRisk } : {}),
      }
    }

    if (unlockType === AchievementUnlockType.ARENA_PERFORMANCE) {
      const gamificationBlockId =
        criteriaInput && typeof (criteriaInput as { gamificationBlockId?: unknown }).gamificationBlockId === 'string'
          ? (criteriaInput as { gamificationBlockId: string }).gamificationBlockId
          : null

      if (!gamificationBlockId) {
        return new NextResponse('Practice Arena id is required for arena achievements', { status: 400 })
      }

      const block = await db.gamificationBlock.findFirst({
        where: {
          id: gamificationBlockId,
          contentType: GamificationContentType.ARENA,
          lessonBlock: {
            lesson: {
              module: {
                courseId: course.id,
              },
            },
          },
        },
        select: {
          id: true,
          lessonBlock: {
            select: {
              lessonId: true,
              lesson: { select: { moduleId: true } },
            },
          },
        },
      })

      if (!block || !block.lessonBlock) {
        return new NextResponse('Practice Arena non trovata per questo corso', { status: 400 })
      }

      targetLessonId = block.lessonBlock.lessonId
      targetModuleId = targetModuleId ?? block.lessonBlock.lesson.moduleId

      const minScoreRaw =
        criteriaInput && typeof (criteriaInput as { minScore?: unknown }).minScore === 'number'
          ? (criteriaInput as { minScore?: number }).minScore
          : null
      const minTokensRaw =
        criteriaInput && typeof (criteriaInput as { minTokens?: unknown }).minTokens === 'number'
          ? (criteriaInput as { minTokens?: number }).minTokens
          : null
      const minEndorsementsRaw =
        criteriaInput && typeof (criteriaInput as { minEndorsements?: unknown }).minEndorsements === 'number'
          ? (criteriaInput as { minEndorsements?: number }).minEndorsements
          : null

      const minScore = minScoreRaw != null ? Math.max(0, Math.min(100, Math.trunc(minScoreRaw))) : null
      const minTokens = minTokensRaw != null ? Math.max(0, Math.trunc(minTokensRaw)) : null
      const minEndorsements =
        minEndorsementsRaw != null ? Math.max(0, Math.trunc(minEndorsementsRaw)) : null

      sanitizedCriteria = {
        gamificationBlockId: block.id,
        ...(minScore != null ? { minScore } : {}),
        ...(minTokens != null ? { minTokens } : {}),
        ...(minEndorsements != null ? { minEndorsements } : {}),
      }
    }

    if (unlockType === AchievementUnlockType.COURSE_POINTS) {
      const thresholdRaw =
        criteriaInput && typeof (criteriaInput as { pointsThreshold?: unknown }).pointsThreshold === 'number'
          ? (criteriaInput as { pointsThreshold?: number }).pointsThreshold
          : null

      if (!thresholdRaw || thresholdRaw <= 0) {
        return new NextResponse('Per gli obiettivi sui punti è richiesta una soglia positiva', { status: 400 })
      }

      const pointsThreshold = Math.max(1, Math.trunc(thresholdRaw))
      targetModuleId = null
      targetLessonId = null
      sanitizedCriteria = { pointsThreshold }
    }

    if (
      unlockType === AchievementUnlockType.FIRST_CHAPTER ||
      unlockType === AchievementUnlockType.COURSE_COMPLETION
    ) {
      sanitizedCriteria = null
    }

    const icon = typeof payload.icon === 'string' ? payload.icon.trim() || null : null

    const achievement = await db.courseAchievement.create({
      data: {
        courseId: course.id,
        title,
        description: description ?? null,
        unlockType,
        targetModuleId,
        targetLessonId,
        pointsReward,
        icon,
        criteria: sanitizedCriteria,
        createdByProfileId: profile.id,
      },
      include: includeRelations,
    })

    return NextResponse.json(achievement, { status: 201 })
  } catch (error) {
    logError('COURSE_ACHIEVEMENTS_POST', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
