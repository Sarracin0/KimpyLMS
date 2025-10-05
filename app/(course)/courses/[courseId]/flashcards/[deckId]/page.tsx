import { notFound, redirect } from 'next/navigation'

import { requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { CourseEnrollmentSource, UserRole } from '@prisma/client'

import { FlashcardViewer } from './_components/flashcard-viewer'

type PageParams = Promise<{ courseId: string; deckId: string }>

export default async function CourseFlashcardPage({ params }: { params: PageParams }) {
  const { profile, company } = await requireAuthContext()
  const { courseId, deckId } = await params

  const deck = await db.flashcardDeck.findFirst({
    where: {
      id: deckId,
      companyId: company.id,
      gamificationBlock: {
        lessonBlock: {
          lesson: {
            module: {
              courseId,
              course: { companyId: company.id },
            },
          },
        },
      },
    },
    include: {
      cards: { orderBy: { position: 'asc' } },
      gamificationBlock: {
        include: {
          lessonBlock: {
            select: {
              title: true,
              lesson: { select: { title: true } },
            },
          },
        },
      },
    },
  })

  if (!deck) {
    notFound()
  }

  const course = await db.course.findFirst({
    where: { id: courseId, companyId: company.id },
    select: { id: true, isPublished: true },
  })

  if (!course) {
    return redirect('/courses')
  }

  // Auto-enroll HR admins to let them preview learner experience
  if (profile.role === UserRole.HR_ADMIN) {
    await db.courseEnrollment.upsert({
      where: {
        courseId_userProfileId: {
          courseId: course.id,
          userProfileId: profile.id,
        },
      },
      create: {
        courseId: course.id,
        userProfileId: profile.id,
        assignedById: profile.id,
        source: CourseEnrollmentSource.MANUAL,
      },
      update: {},
    })
  }

  const viewerDeck = {
    title: deck.title,
    description: deck.description,
    cards: deck.cards.map((card) => ({
      id: card.id,
      front: card.front,
      back: card.back,
      points: card.points,
    })),
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <FlashcardViewer deck={viewerDeck} />
    </div>
  )
}
