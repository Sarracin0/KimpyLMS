import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { UserRole } from '@prisma/client'

export async function POST(request: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])
  const { quizId, questionId } = await params

  const quiz = await db.quiz.findFirst({ where: { id: quizId, companyId: company.id }, include: { lessonBlock: { include: { lesson: { include: { module: { include: { course: true } } } } } } } })
  if (!quiz) return new NextResponse('Not found', { status: 404 })
  if (profile.role === UserRole.TRAINER && quiz.lessonBlock.lesson.module.course.createdByProfileId !== profile.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await request.json()
  const text = typeof body.text === 'string' && body.text.trim() ? body.text.trim() : 'Nuova opzione'

  const created = await db.quizOption.create({
    data: {
      questionId,
      text,
      isCorrect: !!body.isCorrect,
      points: typeof body.points === 'number' ? body.points : 0,
    },
  })

  return NextResponse.json(created, { status: 201 })
}
