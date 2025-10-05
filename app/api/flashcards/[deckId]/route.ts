import { NextRequest, NextResponse } from 'next/server'
import { GamificationStatus, UserRole } from '@prisma/client'

import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{
  deckId: string
}>

const sharedInclude = {
  cards: { orderBy: { position: 'asc' } },
  gamificationBlock: {
    include: {
      lessonBlock: {
        include: {
          lesson: { include: { module: { include: { course: true } } } },
        },
      },
    },
  },
}

export async function GET(_: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { deckId } = await params

    const deck = await db.flashcardDeck.findFirst({
      where: { id: deckId, companyId: company.id },
      include: sharedInclude,
    })

    if (!deck) {
      return new NextResponse('Deck not found', { status: 404 })
    }

    if (
      profile.role === UserRole.TRAINER &&
      deck.gamificationBlock?.lessonBlock.lesson.module.course.createdByProfileId !== profile.id
    ) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    return NextResponse.json(deck)
  } catch (error) {
    logError('FLASHCARD_DECK_GET', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { deckId } = await params

    const deck = await db.flashcardDeck.findFirst({
      where: { id: deckId, companyId: company.id },
      include: sharedInclude,
    })

    if (!deck) {
      return new NextResponse('Deck not found', { status: 404 })
    }

    if (
      profile.role === UserRole.TRAINER &&
      deck.gamificationBlock?.lessonBlock.lesson.module.course.createdByProfileId !== profile.id
    ) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (typeof body.title === 'string') {
      const title = body.title.trim()
      if (!title) {
        return new NextResponse('Title is required', { status: 400 })
      }
      data.title = title
    }

    if (typeof body.description === 'string') {
      data.description = body.description.trim() || null
    } else if (body.description === null) {
      data.description = null
    }

    if (typeof body.isPublished === 'boolean') {
      data.isPublished = body.isPublished
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(deck)
    }

    const updated = await db.flashcardDeck.update({ where: { id: deck.id }, data, include: sharedInclude })
    return NextResponse.json(updated)
  } catch (error) {
    logError('FLASHCARD_DECK_PATCH', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { deckId } = await params

    const deck = await db.flashcardDeck.findFirst({
      where: { id: deckId, companyId: company.id },
      include: sharedInclude,
    })

    if (!deck) {
      return new NextResponse('Deck not found', { status: 404 })
    }

    if (
      profile.role === UserRole.TRAINER &&
      deck.gamificationBlock?.lessonBlock.lesson.module.course.createdByProfileId !== profile.id
    ) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    await db.flashcardDeck.delete({ where: { id: deck.id } })

    if (deck.gamificationBlock) {
      await db.gamificationBlock
        .update({
          where: { id: deck.gamificationBlock.id },
          data: { status: GamificationStatus.DRAFT, result: null, quizId: null },
        })
        .catch(() => undefined)
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    logError('FLASHCARD_DECK_DELETE', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
