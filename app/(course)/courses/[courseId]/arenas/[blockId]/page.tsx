import { notFound } from 'next/navigation'

import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'
import { extractArenaPayload } from '@/lib/gamification/arena'
import { PracticeArenaPlayer } from './_components/practice-arena-player'

export default async function PracticeArenaPage({
  params,
}: {
  params: Promise<{ courseId: string; blockId: string }>
}) {
  const { courseId, blockId } = await params
  const { profile, company } = await requireAuthContext()

  const block = await db.lessonBlock.findFirst({
    where: {
      id: blockId,
      lesson: {
        module: {
          courseId,
          course: { companyId: company.id },
        },
      },
      isPublished: true,
    },
    include: {
      gamification: true,
    },
  })

  if (!block || !block.gamification || block.gamification.contentType !== 'ARENA') {
    notFound()
  }

  const arena = extractArenaPayload(block.gamification.result ?? null)
  const isReady = Boolean(arena)

  const attempts = await db.scenarioAttempt.findMany({
    where: {
      gamificationBlockId: block.gamification.id,
      userProfileId: profile.id,
      attemptType: 'ARENA',
    },
    orderBy: { createdAt: 'desc' },
  })

  const serializedAttempts = attempts.map((attempt) => ({
    id: attempt.id,
    score: attempt.score,
    insightTokens: attempt.insightTokens,
    reflections: attempt.reflections,
    path: attempt.path,
    createdAt: attempt.createdAt.toISOString(),
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {isReady ? (
        <PracticeArenaPlayer blockId={blockId} arena={arena!} attempts={serializedAttempts} />
      ) : (
        <div className="rounded-lg border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          La Practice Arena è in fase di generazione. Riprova tra qualche istante oppure rigenera il contenuto dal builder HR.
        </div>
      )}
    </div>
  )
}
