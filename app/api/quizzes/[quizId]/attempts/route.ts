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

  const maxAttempts = quiz.maxAttempts ?? Infinity
  if (nextAttemptNumber > maxAttempts) {
    return new NextResponse('Max attempts reached', { status: 400 })
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
