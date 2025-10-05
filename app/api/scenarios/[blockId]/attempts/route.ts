import { NextRequest, NextResponse } from 'next/server'
import { UserRole, Prisma } from '@prisma/client'

import { requireAuthContext, assertRole } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { extractScenarioPayload } from '@/lib/gamification/scenario'
import { logError } from '@/lib/logger'

const MAX_POINTS_REWARD = 500

type RouteParams = Promise<{ blockId: string }>

type StepInput = {
  nodeId: unknown
  choiceId?: unknown
  reflection?: unknown
}

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.LEARNER, UserRole.HR_ADMIN, UserRole.TRAINER])

    const { blockId } = await params
    const body = await request.json()
    const stepsInput: StepInput[] = Array.isArray(body?.path) ? body.path : []

    if (!stepsInput.length) {
      return new NextResponse('Invalid attempt payload', { status: 400 })
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
      },
    })

    if (!block || !block.gamification || block.gamification.contentType !== 'SCENARIO') {
      return new NextResponse('Scenario not found', { status: 404 })
    }

    const scenario = extractScenarioPayload(block.gamification.result ?? null)
    if (!scenario) {
      return new NextResponse('Scenario data unavailable', { status: 422 })
    }

    const nodeMap = new Map(scenario.nodes.map((node) => [node.id, node]))

    const pathRecords: Array<Record<string, unknown>> = []
    const reflections: Array<{ nodeId: string; response: string }> = []
    const competencyTagSet = new Set<string>()

    let scoreTotal = 0
    let riskAccumulator = 0
    let riskCount = 0

    for (const step of stepsInput) {
      const nodeId = typeof step.nodeId === 'string' ? step.nodeId : ''
      if (!nodeId) {
        return new NextResponse('Missing nodeId in path', { status: 400 })
      }
      const node = nodeMap.get(nodeId)
      if (!node) {
        return new NextResponse(`Unknown node ${nodeId}`, { status: 400 })
      }

      if (node.type === 'decision') {
        const choiceId = typeof step.choiceId === 'string' ? step.choiceId : ''
        const choice = node.choices?.find((item) => item.id === choiceId)
        if (!choice) {
          return new NextResponse(`Invalid choice for node ${nodeId}`, { status: 400 })
        }

        const impactScore = typeof choice.impact?.score === 'number' ? choice.impact.score : 0
        const impactRisk = typeof choice.impact?.risk === 'number' ? choice.impact.risk : 0

        scoreTotal += impactScore
        riskAccumulator += impactRisk
        riskCount += 1

        for (const tag of choice.impact?.competencyTags ?? []) {
          if (typeof tag === 'string' && tag.trim().length > 0) {
            competencyTagSet.add(tag.trim())
          }
        }

        pathRecords.push({
          nodeId,
          type: 'decision',
          choiceId: choice.id,
          label: choice.label,
          feedback: choice.feedback,
          impact: {
            score: impactScore,
            risk: impactRisk,
            competencyTags: choice.impact?.competencyTags ?? [],
            summary: choice.impact?.summary ?? null,
          },
        })
      } else {
        let responseText = ''
        if (typeof step.reflection === 'string') {
          responseText = step.reflection.trim()
        } else if (step.reflection && typeof step.reflection === 'object') {
          const record = step.reflection as { text?: unknown }
          if (typeof record.text === 'string') {
            responseText = record.text.trim()
          }
        }
        pathRecords.push({
          nodeId,
          type: 'reflection',
          prompt: node.prompt ?? node.situation,
          response: responseText,
        })
        if (responseText) {
          reflections.push({ nodeId, response: responseText })
        }
      }
    }

    if (pathRecords.length === 0) {
      return new NextResponse('No valid path provided', { status: 400 })
    }

    const averageRisk = riskCount > 0 ? Math.round(riskAccumulator / riskCount) : null
    const normalizedScore = Math.max(0, Math.round(scoreTotal))

    const existingAttempt = await db.scenarioAttempt.findFirst({
      where: {
        gamificationBlockId: block.gamification.id,
        userProfileId: profile.id,
      },
      orderBy: { createdAt: 'asc' },
    })

    const attempt = await db.scenarioAttempt.create({
      data: {
        gamificationBlockId: block.gamification.id,
        userProfileId: profile.id,
        path: pathRecords as Prisma.JsonArray,
        score: normalizedScore,
        riskLevel: averageRisk,
        reflections: reflections.length > 0 ? (reflections as unknown as Prisma.JsonValue) : null,
      },
    })

    const isFirstAttempt = !existingAttempt
    const pointsAwarded = isFirstAttempt ? Math.min(MAX_POINTS_REWARD, normalizedScore) : 0

    if (pointsAwarded > 0 && profile.role === UserRole.LEARNER) {
      await db.userPoints.create({
        data: {
          userProfileId: profile.id,
          delta: pointsAwarded,
          type: 'COMPLETION',
          reason: `Decision Lab completed (${scenario.intro.slice(0, 40)})`,
          referenceId: block.gamification.id,
        },
      })
    }

    if (profile.role === UserRole.LEARNER) {
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
          pointsAwarded,
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
          pointsAwarded,
        },
      })
    }

    return NextResponse.json({
      attempt,
      metrics: {
        score: normalizedScore,
        riskLevel: averageRisk,
        competencyTags: Array.from(competencyTagSet),
        pointsAwarded,
      },
    })
  } catch (error) {
    logError('SCENARIO_ATTEMPT_CREATE', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
