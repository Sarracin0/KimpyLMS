import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { QuizQuestionType, UserRole } from '@prisma/client'

export async function POST(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])
  const { quizId } = await params

  const quiz = await db.quiz.findFirst({ where: { id: quizId, companyId: company.id }, include: { lessonBlock: { include: { lesson: { include: { module: { include: { course: true } } } } } }, questions: true } })
  if (!quiz) return new NextResponse('Not found', { status: 404 })
  if (profile.role === UserRole.TRAINER && quiz.lessonBlock.lesson.module.course.createdByProfileId !== profile.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await request.json()
  const type: QuizQuestionType = ['MULTIPLE_CHOICE','TRUE_FALSE','SHORT_ANSWER'].includes(body.type) ? body.type : 'MULTIPLE_CHOICE'

  const position = quiz.questions.length > 0 ? Math.max(...quiz.questions.map(q => q.position)) + 1 : 0

  const created = await db.quizQuestion.create({
    data: {
      quizId: quiz.id,
      position,
      type,
      text: body.text?.trim() || 'Nuova domanda',
      points: typeof body.points === 'number' ? body.points : 1,
    },
  })

  let withDefaults: any = created
  if (type === 'TRUE_FALSE') {
    const [opt1, opt2] = await db.$transaction([
      db.quizOption.create({ data: { questionId: created.id, text: 'Vero', isCorrect: true, points: 1 } }),
      db.quizOption.create({ data: { questionId: created.id, text: 'Falso', isCorrect: false, points: 0 } }),
    ])
    withDefaults = { ...created, options: [opt1, opt2] }
  } else {
    withDefaults = { ...created, options: [] }
  }

  return NextResponse.json(withDefaults, { status: 201 })
}
