import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'

import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { evaluateCourseAchievements } from '@/lib/evaluate-course-achievements'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{ deckId: string }>

export async function POST(_request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.LEARNER, UserRole.HR_ADMIN, UserRole.TRAINER])

    const { deckId } = await params

    const deck = await db.flashcardDeck.findFirst({
      where: {
        id: deckId,
        companyId: company.id,
        gamificationBlock: {
          lessonBlock: {
            lesson: {
              module: {
                course: {
                  companyId: company.id,
                },
              },
            },
          },
        },
      },
      include: {
        gamificationBlock: {
          include: {
            lessonBlock: {
              select: {
                lessonId: true,
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
            },
          },
        },
      },
    })

    const lessonBlock = deck?.gamificationBlock?.lessonBlock
    const courseId = lessonBlock?.lesson?.module?.courseId ?? null
    const lessonId = lessonBlock?.lessonId ?? null

    if (!deck || !lessonId || !courseId) {
      return new NextResponse('Flashcard deck not found', { status: 404 })
    }

    if (profile.role === UserRole.LEARNER) {
      await db.userLessonProgress.upsert({
        where: {
          userProfileId_lessonId: {
            userProfileId: profile.id,
            lessonId,
          },
        },
        create: {
          userProfileId: profile.id,
          lessonId,
          isCompleted: true,
          completedAt: new Date(),
          pointsAwarded: 0,
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
        },
      })

      await evaluateCourseAchievements({
        courseId,
        userProfileId: profile.id,
      })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    logError('FLASHCARD_COMPLETE', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
