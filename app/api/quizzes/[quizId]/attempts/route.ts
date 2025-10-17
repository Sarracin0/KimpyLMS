import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { UserRole } from '@prisma/client'

export async function POST(_: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.LEARNER, UserRole.HR_ADMIN, UserRole.TRAINER])
  const { quizId } = await params

  const quiz = await db.quiz.findFirst({ where: { id: quizId, companyId: company.id }, include: { attempts: { where: { userProfileId: profile.id } } } })
  if (!quiz) return new NextResponse('Not found', { status: 404 })

  const nextAttemptNumber = (quiz.attempts.length > 0 ? Math.max(...quiz.attempts.map(a => a.attemptNumber)) : 0) + 1

  // If maxAttempts is null or 0, treat as unlimited
  const maxAttempts = quiz.maxAttempts && quiz.maxAttempts > 0 ? quiz.maxAttempts : Infinity
  if (nextAttemptNumber > maxAttempts) {
    return new NextResponse(
      JSON.stringify({
        error: 'Max attempts reached',
        attempts: quiz.attempts.length,
        maxAttempts: quiz.maxAttempts
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const attempt = await db.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userProfileId: profile.id,
      attemptNumber: nextAttemptNumber,
    },
  })

  return NextResponse.json(attempt, { status: 201 })
}
