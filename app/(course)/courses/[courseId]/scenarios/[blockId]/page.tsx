import { notFound } from 'next/navigation'

import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'
import { extractScenarioPayload } from '@/lib/gamification/scenario'
import { ScenarioLabPlayer } from './_components/scenario-lab-player'

export default async function ScenarioLabPage({ params }: { params: Promise<{ courseId: string; blockId: string }> }) {
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

  if (!block || !block.gamification || block.gamification.contentType !== 'SCENARIO') {
    notFound()
  }

  const scenario = extractScenarioPayload(block.gamification.result ?? null)
  if (!scenario) {
    notFound()
  }

  const latestAttempt = await db.scenarioAttempt.findFirst({
    where: {
      gamificationBlockId: block.gamification.id,
      userProfileId: profile.id,
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <ScenarioLabPlayer blockId={blockId} scenario={scenario} latestAttempt={latestAttempt} />
    </div>
  )
}
