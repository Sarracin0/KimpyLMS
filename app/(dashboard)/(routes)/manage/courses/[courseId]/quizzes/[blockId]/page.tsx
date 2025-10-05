import { notFound } from 'next/navigation'
import Link from 'next/link'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { UserRole } from '@prisma/client'
import { ArrowLeft } from 'lucide-react'
import QuizEditor from './_components/quiz-editor'

export default async function ManageQuizPage({ params }: { params: Promise<{ courseId: string; blockId: string }> }) {
  const { profile, company } = await requireAuthContext()
  assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

  const { courseId, blockId } = await params

  const block = await db.lessonBlock.findFirst({
    where: { id: blockId, lesson: { module: { courseId, course: { companyId: company.id } } } },
    include: { lesson: { include: { module: { include: { course: true } } } } },
  })

  if (!block) {
    notFound()
  }

  if (profile.role === UserRole.TRAINER && block.lesson.module.course.createdByProfileId !== profile.id) {
    notFound()
  }

  const quiz = await db.quiz.upsert({
    where: { lessonBlockId: blockId },
    update: {},
    create: {
      companyId: company.id,
      createdByProfileId: profile.id,
      lessonBlockId: blockId,
      title: block.title || 'New Quiz',
      description: block.content,
      passScore: 70,
      maxAttempts: 3,
      timeLimitSeconds: 600,
      shuffleQuestions: true,
      shuffleOptions: true,
      pointsReward: 100,
      isPublished: false,
    },
    include: {
      questions: {
        include: { options: true },
        orderBy: { position: 'asc' },
      },
    },
  })

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href={`/manage/courses/${courseId}`}
          className="inline-flex items-center rounded-md p-1 hover:bg-muted/60 transition"
          aria-label="Torna al builder"
        >
          <ArrowLeft className="h-5 w-5 text-[#5D62E1]" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Quiz builder</h1>
          <p className="text-sm text-muted-foreground">Configura le domande, le opzioni e i punteggi per il quiz</p>
        </div>
      </div>
      <QuizEditor
        courseId={courseId}
        blockId={blockId}
        quiz={quiz}
      />
    </div>
  )
}
