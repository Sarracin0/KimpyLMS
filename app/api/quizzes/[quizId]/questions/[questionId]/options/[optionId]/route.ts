import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { UserRole } from '@prisma/client'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string; optionId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])
  const { quizId, questionId, optionId } = await params

  const quiz = await db.quiz.findFirst({ where: { id: quizId, companyId: company.id }, include: { lessonBlock: { include: { lesson: { include: { module: { include: { course: true } } } } } } } })
  if (!quiz) return new NextResponse('Not found', { status: 404 })
  if (profile.role === UserRole.TRAINER && quiz.lessonBlock.lesson.module.course.createdByProfileId !== profile.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await request.json()
  const patch: any = {}
  for (const key of ['text','isCorrect','points']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key]
  }

  const updated = await db.quizOption.update({ where: { id: optionId }, data: patch })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string; optionId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])
  const { quizId, questionId, optionId } = await params

  const quiz = await db.quiz.findFirst({ where: { id: quizId, companyId: company.id }, include: { lessonBlock: { include: { lesson: { include: { module: { include: { course: true } } } } } } } })
  if (!quiz) return new NextResponse('Not found', { status: 404 })
  if (profile.role === UserRole.TRAINER && quiz.lessonBlock.lesson.module.course.createdByProfileId !== profile.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  await db.quizAnswerOption.deleteMany({ where: { optionId } })
  await db.quizOption.delete({ where: { id: optionId } })
  return new NextResponse(null, { status: 204 })
}
