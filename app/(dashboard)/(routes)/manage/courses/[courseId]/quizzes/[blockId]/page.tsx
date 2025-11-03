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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="mb-8 lg:mb-12">
          <Link
            href={`/manage/courses/${courseId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6 group"
            aria-label="Torna al builder"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>Torna al builder</span>
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">Quiz builder</h1>
            <p className="text-base text-muted-foreground">Crea e configura domande, opzioni e punteggi</p>
          </div>
        </div>
        <QuizEditor
          courseId={courseId}
          blockId={blockId}
          quiz={quiz}
        />
      </div>
    </div>
  )
}
