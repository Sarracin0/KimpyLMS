import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'

import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{
  deckId: string
}>

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { deckId } = await params

    const deck = await db.flashcardDeck.findFirst({
      where: { id: deckId, companyId: company.id },
      include: {
        gamificationBlock: {
          include: {
            lessonBlock: {
              include: { lesson: { include: { module: { include: { course: true } } } } },
            },
          },
        },
        cards: true,
      },
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
    const front = typeof body.front === 'string' ? body.front.trim() : ''
    const back = typeof body.back === 'string' ? body.back.trim() : ''
    const points = typeof body.points === 'number' ? body.points : 0

    if (!front || !back) {
      return new NextResponse('Front and back text are required', { status: 400 })
    }

    const card = await db.flashcardCard.create({
      data: {
        deckId: deck.id,
        position: deck.cards.length,
        front,
        back,
        points,
      },
    })

    return NextResponse.json(card, { status: 201 })
  } catch (error) {
    logError('FLASHCARD_CARD_POST', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
