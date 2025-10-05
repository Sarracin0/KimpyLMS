import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { UserRole } from '@prisma/client'
import FlashcardEditor from './_components/flashcard-editor'

type PageParams = Promise<{
  courseId: string
  deckId: string
}>

export default async function ManageFlashcardsPage({ params }: { params: PageParams }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

  const { courseId, deckId } = await params

  const deck = await db.flashcardDeck.findFirst({
    where: { id: deckId, companyId: company.id },
    include: {
      cards: { orderBy: { position: 'asc' } },
      gamificationBlock: {
        include: {
          lessonBlock: {
            include: { lesson: { include: { module: { include: { course: true } } } } },
          },
        },
      },
    },
  })

  if (!deck) {
    notFound()
  }

  if (
    profile.role === UserRole.TRAINER &&
    deck.gamificationBlock?.lessonBlock.lesson.module.course.createdByProfileId !== profile.id
  ) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <Link
          href={`/manage/courses/${courseId}`}
          className="inline-flex items-center rounded-md p-1 transition hover:bg-muted/60"
          aria-label="Torna al builder"
        >
          <ArrowLeft className="h-5 w-5 text-[#5D62E1]" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Flashcard deck</h1>
          <p className="text-sm text-muted-foreground">
            Rivedi le carte generate dall&apos;AI, modifica contenuti e punteggi prima di pubblicare.
          </p>
        </div>
      </div>

      <FlashcardEditor deck={deck} />
    </div>
  )
}
