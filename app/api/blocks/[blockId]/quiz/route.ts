import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { UserRole } from '@prisma/client'

export async function GET(_: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER, UserRole.LEARNER])

  const { blockId } = await params

  const quiz = await db.quiz.findFirst({
    where: {
      lessonBlockId: blockId,
      companyId: company.id,
    },
    include: {
      questions: {
        include: { options: true },
        orderBy: { position: 'asc' },
      },
    },
  })

  if (!quiz) {
    return new NextResponse('Quiz not found or not available', { status: 404 })
  }

  // For learners, only show published quizzes
  if (profile.role === UserRole.LEARNER && !quiz.isPublished) {
    return new NextResponse('Quiz not available', { status: 404 })
  }

  return NextResponse.json(quiz)
}
