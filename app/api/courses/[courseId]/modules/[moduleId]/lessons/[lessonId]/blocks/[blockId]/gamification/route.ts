import { NextRequest, NextResponse } from 'next/server'
import {
  AttachmentScope,
  BlockType,
  GamificationContentType,
  GamificationStatus,
  Prisma,
  QuizQuestionType,
  UserRole,
} from '@prisma/client'

import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { logError } from '@/lib/logger'
import { generateGamificationContent } from '@/lib/gamification/generator'
import type { GamificationGenerationResult } from '@/lib/gamification/types'

type RouteParams = Promise<{
  courseId: string
  moduleId: string
  lessonId: string
  blockId: string
}>

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  const requestStartedAt = Date.now()

  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId, moduleId, lessonId, blockId } = await params

    const block = await db.lessonBlock.findFirst({
      where: {
        id: blockId,
        lessonId,
        lesson: {
          moduleId,
          module: { courseId, course: { companyId: company.id } },
        },
      },
      include: {
        lesson: { include: { module: { include: { course: true } } } },
        gamification: {
          include: {
            flashcardDeck: { include: { cards: true } },
            quiz: {
              include: {
                questions: { include: { options: true } },
              },
            },
          },
        },
        quiz: {
          include: {
            questions: { include: { options: true } },
          },
        },
      },
    })

    if (!block || block.type !== BlockType.GAMIFICATION) {
      return new NextResponse('Gamification block not found', { status: 404 })
    }

    const gamification = block.gamification

    if (!gamification) {
      return new NextResponse('Gamification configuration missing', { status: 422 })
    }

    if (profile.role === UserRole.TRAINER && block.lesson.module.course.createdByProfileId !== profile.id) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const body = await request.json()
    const rawContentType = typeof body.contentType === 'string' ? body.contentType.toUpperCase() : gamification.contentType
    const contentType = Object.values(GamificationContentType).includes(rawContentType as GamificationContentType)
      ? (rawContentType as GamificationContentType)
      : gamification.contentType

    const attachmentIds = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter((value: unknown): value is string => typeof value === 'string')
      : gamification.sourceAttachmentIds

    const settings = (typeof body.settings === 'object' && body.settings !== null ? body.settings : {}) as Record<string, unknown>

    if (attachmentIds.length === 0) {
      return new NextResponse('Select at least one document', { status: 400 })
    }

    const attachments = await db.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        courseId,
        course: { companyId: company.id },
        scope: { in: [AttachmentScope.COURSE, AttachmentScope.LESSON] },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (attachments.length === 0) {
      return new NextResponse('Unable to load selected documents', { status: 400 })
    }

    const attachmentIdSet = new Set(attachments.map((item) => item.id))
    const missingAttachments = attachmentIds.filter((id) => !attachmentIdSet.has(id))
    if (missingAttachments.length > 0) {
      return new NextResponse('One or more documents are not available', { status: 400 })
    }

    await db.gamificationBlock.update({
      where: { id: gamification.id },
      data: {
        status: GamificationStatus.GENERATING,
        contentType,
        sourceAttachmentIds: attachmentIds,
        config: settings as Prisma.JsonObject,
      },
    })

    let generation: GamificationGenerationResult

    try {
      generation = await generateGamificationContent({
        companyId: company.id,
        courseId,
        lessonId,
        blockId,
        requestedBy: {
          profileId: profile.id,
          name: profile.userId,
        },
        contentType,
        attachments,
        settings,
      })
    } catch (error) {
      await db.gamificationBlock.update({
        where: { id: gamification.id },
        data: {
          status: GamificationStatus.FAILED,
          result: { error: (error as Error).message ?? 'Generation failed' } satisfies Prisma.JsonValue,
        },
      })

      logError('GAMIFICATION_GENERATE_ERROR', error)
      return new NextResponse('Unable to generate content', { status: 500 })
    }

    const resultJson = generation.raw ?? generation

    if (contentType === GamificationContentType.QUIZ && generation.quiz) {
      const quizPayload = generation.quiz
      if (!quizPayload.questions || quizPayload.questions.length === 0) {
        await db.gamificationBlock.update({
          where: { id: gamification.id },
          data: {
            status: GamificationStatus.FAILED,
            result: { error: 'The model did not return quiz questions' } satisfies Prisma.JsonValue,
          },
        })

        return new NextResponse('Invalid quiz payload', { status: 422 })
      }
      const quiz = await db.quiz.upsert({
        where: { lessonBlockId: block.id },
        create: {
          companyId: company.id,
          createdByProfileId: profile.id,
          lessonBlockId: block.id,
          title: quizPayload.title,
          description: quizPayload.description ?? null,
          passScore: quizPayload.passScore ?? 70,
          maxAttempts: quizPayload.maxAttempts ?? null,
          timeLimitSeconds: quizPayload.timeLimitSeconds ?? null,
          shuffleQuestions: quizPayload.shuffleQuestions ?? true,
          shuffleOptions: quizPayload.shuffleOptions ?? true,
          pointsReward: quizPayload.pointsReward ?? 0,
          autoGenerated: true,
          isPublished: false,
        },
        update: {
          title: quizPayload.title,
          description: quizPayload.description ?? null,
          passScore: quizPayload.passScore ?? 70,
          maxAttempts: quizPayload.maxAttempts ?? null,
          timeLimitSeconds: quizPayload.timeLimitSeconds ?? null,
          shuffleQuestions: quizPayload.shuffleQuestions ?? true,
          shuffleOptions: quizPayload.shuffleOptions ?? true,
          pointsReward: quizPayload.pointsReward ?? 0,
          autoGenerated: true,
        },
      })

      await db.quizQuestion.deleteMany({ where: { quizId: quiz.id } })

      for (const [position, question] of quizPayload.questions.entries()) {
        const createdQuestion = await db.quizQuestion.create({
          data: {
            quizId: quiz.id,
            position,
            type: question.type ?? QuizQuestionType.MULTIPLE_CHOICE,
            text: question.text,
            explanation: question.explanation ?? null,
            required: question.required ?? false,
            points: question.points ?? 1,
          },
        })

        if (question.options?.length) {
          await db.quizOption.createMany({
            data: question.options.map((option) => ({
              questionId: createdQuestion.id,
              text: option.text,
              isCorrect: option.isCorrect ?? false,
              points: option.points ?? 0,
            })),
          })
        }
      }

      if (gamification.flashcardDeck) {
        await db.flashcardDeck.delete({ where: { id: gamification.flashcardDeck.id } }).catch(() => undefined)
      }

      await db.gamificationBlock.update({
        where: { id: gamification.id },
        data: {
          status: GamificationStatus.READY,
          quizId: quiz.id,
          result: resultJson as Prisma.JsonValue,
        },
      })
    } else if (contentType === GamificationContentType.FLASHCARDS && generation.flashcards) {
      const deckPayload = generation.flashcards
      if (!deckPayload.cards || deckPayload.cards.length === 0) {
        await db.gamificationBlock.update({
          where: { id: gamification.id },
          data: {
            status: GamificationStatus.FAILED,
            result: { error: 'The model did not return flashcard cards' } satisfies Prisma.JsonValue,
          },
        })

        return new NextResponse('Invalid flashcards payload', { status: 422 })
      }
      const deck = await db.flashcardDeck.upsert({
        where: { gamificationBlockId: gamification.id },
        create: {
          companyId: company.id,
          createdByProfileId: profile.id,
          gamificationBlockId: gamification.id,
          title: deckPayload.title,
          description: deckPayload.description ?? null,
          isPublished: false,
          autoGenerated: true,
        },
        update: {
          title: deckPayload.title,
          description: deckPayload.description ?? null,
          autoGenerated: true,
        },
      })

      await db.flashcardCard.deleteMany({ where: { deckId: deck.id } })

      if (deckPayload.cards?.length) {
        await db.flashcardCard.createMany({
          data: deckPayload.cards.map((card, index) => ({
            deckId: deck.id,
            position: index,
            front: card.front,
            back: card.back,
            points: card.points ?? 0,
          })),
        })
      }

      if (block.quiz) {
        await db.quiz.delete({ where: { id: block.quiz.id } }).catch(() => undefined)
      }

      await db.gamificationBlock.update({
        where: { id: gamification.id },
        data: {
          status: GamificationStatus.READY,
          quizId: null,
          result: resultJson as Prisma.JsonValue,
        },
      })
    } else {
      await db.gamificationBlock.update({
        where: { id: gamification.id },
        data: {
          status: GamificationStatus.FAILED,
          result: { error: 'Model returned an unexpected payload' } satisfies Prisma.JsonValue,
        },
      })

      return new NextResponse('Unexpected generation result', { status: 422 })
    }

    const refreshedBlock = await db.lessonBlock.findUnique({
      where: { id: block.id },
      include: {
        gamification: {
          include: {
            flashcardDeck: { include: { cards: { orderBy: { position: 'asc' } } } },
            quiz: {
              include: {
                questions: { include: { options: true }, orderBy: { position: 'asc' } },
              },
            },
          },
        },
        quiz: {
          include: {
            questions: { include: { options: true }, orderBy: { position: 'asc' } },
          },
        },
      },
    })

    return NextResponse.json({
      block: refreshedBlock,
      durationMs: Date.now() - requestStartedAt,
    })
  } catch (error) {
    logError('COURSE_GAMIFICATION_GENERATE', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
