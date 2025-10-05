import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { UserRole } from '@prisma/client'

export async function GET(_: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER, UserRole.LEARNER])

  const { quizId } = await params

  const quiz = await db.quiz.findFirst({
    where: { id: quizId, companyId: company.id },
    include: { questions: { include: { options: true }, orderBy: { position: 'asc' } }, lessonBlock: true },
  })
  if (!quiz) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(quiz)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

  const { quizId } = await params
  const body = await request.json()

  const quiz = await db.quiz.findFirst({ where: { id: quizId, companyId: company.id }, include: { lessonBlock: { include: { lesson: { include: { module: { include: { course: true } } } } } } } })
  if (!quiz) return new NextResponse('Not found', { status: 404 })

  if (profile.role === UserRole.TRAINER && quiz.lessonBlock.lesson.module.course.createdByProfileId !== profile.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const patch: any = {}
  for (const key of ['title','description','passScore','maxAttempts','timeLimitSeconds','shuffleQuestions','shuffleOptions','pointsReward','isPublished']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key]
  }

  const updated = await db.quiz.update({ where: { id: quizId }, data: patch })
  return NextResponse.json(updated)
}
