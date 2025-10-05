import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { UserRole } from '@prisma/client'

// Return attempt details (optional helper)
export async function GET(_: NextRequest, { params }: { params: Promise<{ quizId: string; attemptId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.LEARNER])

  const { quizId, attemptId } = await params

  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, quizId, userProfileId: profile.id, quiz: { companyId: company.id } },
    include: { answers: { include: { selectedOptions: { include: { option: true } } } } },
  })
  if (!attempt) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(attempt)
}
