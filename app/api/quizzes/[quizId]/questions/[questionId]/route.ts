import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { QuizQuestionType, UserRole } from '@prisma/client'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])
  const { quizId, questionId } = await params

  const quiz = await db.quiz.findFirst({ where: { id: quizId, companyId: company.id }, include: { lessonBlock: { include: { lesson: { include: { module: { include: { course: true } } } } } } } })
  if (!quiz) return new NextResponse('Not found', { status: 404 })
  if (profile.role === UserRole.TRAINER && quiz.lessonBlock.lesson.module.course.createdByProfileId !== profile.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await request.json()
  const patch: any = {}
  for (const key of ['text','explanation','required','points']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key]
  }
  if (body.type && ['MULTIPLE_CHOICE','TRUE_FALSE','SHORT_ANSWER'].includes(body.type)) {
    patch.type = body.type as QuizQuestionType
  }

  const updated = await db.quizQuestion.update({ where: { id: questionId }, data: patch })

  if (patch.type === 'TRUE_FALSE') {
    // Reset options to True/False
    await db.quizOption.deleteMany({ where: { questionId } })
    await db.quizOption.createMany({ data: [
      { questionId, text: 'Vero', isCorrect: true, points: 1 },
      { questionId, text: 'Falso', isCorrect: false, points: 0 },
    ] })
  } else if (patch.type === 'SHORT_ANSWER') {
    await db.quizOption.deleteMany({ where: { questionId } })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])
  const { quizId, questionId } = await params

  const quiz = await db.quiz.findFirst({ where: { id: quizId, companyId: company.id }, include: { lessonBlock: { include: { lesson: { include: { module: { include: { course: true } } } } } } } })
  if (!quiz) return new NextResponse('Not found', { status: 404 })
  if (profile.role === UserRole.TRAINER && quiz.lessonBlock.lesson.module.course.createdByProfileId !== profile.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  await db.quizAnswerOption.deleteMany({ where: { answer: { questionId } } })
  await db.quizAnswer.deleteMany({ where: { questionId } })
  await db.quizOption.deleteMany({ where: { questionId } })
  await db.quizQuestion.delete({ where: { id: questionId } })

  return new NextResponse(null, { status: 204 })
}
