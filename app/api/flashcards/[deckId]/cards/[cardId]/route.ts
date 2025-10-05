import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'

import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{
  deckId: string
  cardId: string
}>

async function loadDeckWithAuth(deckId: string, companyId: string, profileId: string, role: UserRole) {
  const deck = await db.flashcardDeck.findFirst({
    where: { id: deckId, companyId },
    include: {
      gamificationBlock: {
        include: {
          lessonBlock: {
            include: { lesson: { include: { module: { include: { course: true } } } } },
          },
        },
      },
      cards: { orderBy: { position: 'asc' } },
    },
  })

  if (!deck) {
    return { deck: null, forbidden: false }
  }

  if (role === UserRole.TRAINER && deck.gamificationBlock?.lessonBlock.lesson.module.course.createdByProfileId !== profileId) {
    return { deck: null, forbidden: true }
  }

  return { deck, forbidden: false }
}

export async function PATCH(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { deckId, cardId } = await params
    const { deck, forbidden } = await loadDeckWithAuth(deckId, company.id, profile.id, profile.role)

    if (forbidden) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (!deck) {
      return new NextResponse('Deck not found', { status: 404 })
    }

    const card = deck.cards.find((item) => item.id === cardId)
    if (!card) {
      return new NextResponse('Card not found', { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (typeof body.front === 'string') {
      const front = body.front.trim()
      if (!front) {
        return new NextResponse('Front text cannot be empty', { status: 400 })
      }
      data.front = front
    }

    if (typeof body.back === 'string') {
      const back = body.back.trim()
      if (!back) {
        return new NextResponse('Back text cannot be empty', { status: 400 })
      }
      data.back = back
    }

    if (typeof body.points === 'number') {
      data.points = body.points
    }

    if (typeof body.position === 'number' && Number.isInteger(body.position)) {
      data.position = body.position
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(card)
    }

    const updatedCard = await db.flashcardCard.update({
      where: { id: card.id },
      data,
    })

    if (Object.prototype.hasOwnProperty.call(data, 'position')) {
      await normalizePositions(deck.id)
    }

    return NextResponse.json(updatedCard)
  } catch (error) {
    logError('FLASHCARD_CARD_PATCH', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { deckId, cardId } = await params
    const { deck, forbidden } = await loadDeckWithAuth(deckId, company.id, profile.id, profile.role)

    if (forbidden) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (!deck) {
      return new NextResponse('Deck not found', { status: 404 })
    }

    const card = deck.cards.find((item) => item.id === cardId)
    if (!card) {
      return new NextResponse('Card not found', { status: 404 })
    }

    await db.flashcardCard.delete({ where: { id: card.id } })

    await normalizePositions(deck.id)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    logError('FLASHCARD_CARD_DELETE', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

async function normalizePositions(deckId: string) {
  const cards = await db.flashcardCard.findMany({
    where: { deckId },
    orderBy: { position: 'asc' },
  })

  await Promise.all(
    cards.map((item, index) =>
      item.position === index
        ? Promise.resolve()
        : db.flashcardCard.update({ where: { id: item.id }, data: { position: index } }),
    ),
  )
}
