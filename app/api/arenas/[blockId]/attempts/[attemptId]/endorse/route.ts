import { NextRequest, NextResponse } from 'next/server'
import { Prisma, UserRole } from '@prisma/client'

import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { extractArenaPayload } from '@/lib/gamification/arena'
import { evaluateCourseAchievements } from '@/lib/evaluate-course-achievements'
import { logError } from '@/lib/logger'

const DEFAULT_ENDORSEMENT_BONUS = 5

type RouteParams = Promise<{
  blockId: string
  attemptId: string
}>

export async function POST(_request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { blockId, attemptId } = await params

    const attempt = await db.scenarioAttempt.findFirst({
      where: {
        id: attemptId,
        gamificationBlock: {
          lessonBlockId: blockId,
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
    })

    if (!attempt || !attempt.gamificationBlock) {
      return new NextResponse('Attempt not found', { status: 404 })
    }

    if (profile.role === UserRole.TRAINER) {
      const createdBy = attempt.gamificationBlock.lessonBlock.lesson.module.course.createdByProfileId
      if (createdBy && createdBy !== profile.id) {
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    const arenaPayload = extractArenaPayload(attempt.gamificationBlock.result ?? null)
    if (!arenaPayload) {
      return new NextResponse('Practice Arena data unavailable', { status: 422 })
    }

    const reflectionsRecord = attempt.reflections && typeof attempt.reflections === 'object' ? (attempt.reflections as Record<string, unknown>) : {}
    const existingEndorsements = Array.isArray(reflectionsRecord.endorsements)
      ? (reflectionsRecord.endorsements as Array<Record<string, unknown>>)
      : []

    if (existingEndorsements.some((entry) => typeof entry?.profileId === 'string' && entry.profileId === profile.id)) {
      return new NextResponse('Endorsement already recorded', { status: 409 })
    }

    const endorsementBonus = arenaPayload.tokens?.endorsementBonus ?? DEFAULT_ENDORSEMENT_BONUS

    const updatedEndorsements = [
      ...existingEndorsements,
      {
        profileId: profile.id,
        name: profile.userId ?? profile.id,
        createdAt: new Date().toISOString(),
      },
    ]

    const updatedTokens = attempt.insightTokens + endorsementBonus

    const updatedReflections: Record<string, unknown> = {
      ...reflectionsRecord,
      tokensAwarded:
        typeof reflectionsRecord.tokensAwarded === 'number' ? reflectionsRecord.tokensAwarded + endorsementBonus : updatedTokens,
      endorsements: updatedEndorsements,
    }

    const updatedAttempt = await db.scenarioAttempt.update({
      where: { id: attempt.id },
      data: {
        insightTokens: updatedTokens,
        reflections: updatedReflections as Prisma.JsonValue,
      },
      include: {
        gamificationBlock: {
          include: {
            lessonBlock: {
              include: {
                lesson: true,
              },
            },
          },
        },
      },
    })

    await db.userLessonProgress.upsert({
      where: {
        userProfileId_lessonId: {
          userProfileId: attempt.userProfileId,
          lessonId: attempt.gamificationBlock.lessonBlock.lessonId,
        },
      },
      create: {
        userProfileId: attempt.userProfileId,
        lessonId: attempt.gamificationBlock.lessonBlock.lessonId,
        isCompleted: true,
        completedAt: new Date(),
        pointsAwarded: endorsementBonus,
      },
      update: {
        pointsAwarded: {
          increment: endorsementBonus,
        },
      },
    })

    const courseId = attempt.gamificationBlock.lessonBlock.lesson.module?.courseId
    if (courseId) {
      await evaluateCourseAchievements({
        courseId,
        userProfileId: attempt.userProfileId,
      })
    }

    return NextResponse.json({
      attempt: updatedAttempt,
      endorsementBonus,
      endorsements: updatedEndorsements.length,
    })
  } catch (error) {
    logError('ARENA_ENDORSEMENT_CREATE', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
