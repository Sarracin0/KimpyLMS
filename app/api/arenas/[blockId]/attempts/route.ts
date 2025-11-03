import { NextRequest, NextResponse } from 'next/server'
import { PointsType, Prisma, UserRole } from '@prisma/client'

import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { extractArenaPayload } from '@/lib/gamification/arena'
import { evaluatePracticeArenaPlan } from '@/lib/gamification/arena-evaluator'
import { logError } from '@/lib/logger'
import { evaluateCourseAchievements } from '@/lib/evaluate-course-achievements'

const MIN_PLAN_LENGTH = 40
const IMPROVEMENT_THRESHOLD = 5

type RouteParams = Promise<{ blockId: string }>

type PostBody = {
  plan?: unknown
  previousAttemptId?: unknown
}

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.LEARNER, UserRole.HR_ADMIN, UserRole.TRAINER])

    const { blockId } = await params
    const body = (await request.json().catch(() => ({}))) as PostBody

    const planText = typeof body.plan === 'string' ? body.plan.trim() : ''
    if (planText.length < MIN_PLAN_LENGTH) {
      return new NextResponse(`Provide a plan of at least ${MIN_PLAN_LENGTH} characters`, { status: 400 })
    }

    const block = await db.lessonBlock.findFirst({
      where: {
        id: blockId,
        lesson: {
          module: {
            course: {
              companyId: company.id,
            },
          },
        },
      },
      include: {
        gamification: true,
        lesson: {
          select: {
            module: {
              select: {
                courseId: true,
              },
            },
          },
        },
      },
    })

    if (!block || !block.gamification || block.gamification.contentType !== 'ARENA') {
      return new NextResponse('Practice Arena not found', { status: 404 })
    }

    const arenaPayload = extractArenaPayload(block.gamification.result ?? null)
    if (!arenaPayload) {
      return new NextResponse('Practice Arena data unavailable', { status: 422 })
    }

    const existingAttempts = await db.scenarioAttempt.findMany({
      where: {
        gamificationBlockId: block.gamification.id,
        userProfileId: profile.id,
        attemptType: 'ARENA',
      },
      orderBy: { createdAt: 'asc' },
    })

    const previousAttempt = existingAttempts.at(-1) ?? null
    const previousPlan = previousAttempt
      ? (() => {
          const path = Array.isArray(previousAttempt.path) ? (previousAttempt.path as Array<Record<string, unknown>>) : []
          const lastSubmission = path.findLast((entry) => entry && entry.type === 'submission')
          const content = lastSubmission && typeof lastSubmission.plan === 'string' ? lastSubmission.plan.trim() : ''
          return content.length > 0 ? content : null
        })()
      : null

    const evaluation = await evaluatePracticeArenaPlan({ arena: arenaPayload, plan: planText, previousPlan })

    const attemptNumber = existingAttempts.length + 1

    const baseTokens = arenaPayload.tokens.baseAward ?? 5
    const improvementBonus = arenaPayload.tokens.improvementBonus ?? 10
    const previousScore = previousAttempt?.score ?? 0
    const scoreDelta = evaluation.overallScore - previousScore
    const tokensAwarded = previousAttempt
      ? scoreDelta >= IMPROVEMENT_THRESHOLD
        ? improvementBonus
        : 0
      : baseTokens

    const attempt = await db.scenarioAttempt.create({
      data: {
        gamificationBlockId: block.gamification.id,
        userProfileId: profile.id,
        attemptType: 'ARENA',
        path: [
          {
            type: 'submission',
            version: attemptNumber,
            plan: planText,
          },
        ] as Prisma.JsonArray,
        score: evaluation.overallScore,
        reflections: {
          evaluation,
          previousScore,
          scoreDelta,
          tokensAwarded,
        } satisfies Prisma.JsonValue,
        insightTokens: tokensAwarded,
      },
    })

    if (profile.role === UserRole.LEARNER) {
      if (tokensAwarded > 0) {
        await db.$transaction([
          db.userProfile.update({
            where: { id: profile.id },
            data: { points: { increment: tokensAwarded } },
          }),
          db.userPoints.create({
            data: {
              userProfileId: profile.id,
              delta: tokensAwarded,
              type: PointsType.BONUS,
              reason: 'Practice Arena tokens',
              referenceId: block.gamification.id,
            },
          }),
        ])
      }

      await db.userLessonProgress.upsert({
        where: {
          userProfileId_lessonId: {
            userProfileId: profile.id,
            lessonId: block.lessonId,
          },
        },
        create: {
          userProfileId: profile.id,
          lessonId: block.lessonId,
          isCompleted: true,
          completedAt: new Date(),
          pointsAwarded: tokensAwarded,
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
          pointsAwarded: {
            increment: tokensAwarded,
          },
        },
      })
    }

    const courseIdForEval = block.lesson?.module?.courseId
    if (courseIdForEval && profile.role === UserRole.LEARNER) {
      await evaluateCourseAchievements({
        courseId: courseIdForEval,
        userProfileId: profile.id,
      })
    }

    return NextResponse.json({
      attempt,
      evaluation,
      tokensAwarded,
      previousScore,
      scoreDelta,
    })
  } catch (error) {
    logError('ARENA_ATTEMPT_CREATE', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
