import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import QuizPlayer from './_components/quiz-player'

export default async function CourseQuizPage({ params }: { params: Promise<{ courseId: string; blockId: string }> }) {
  const { courseId, blockId } = await params

  const block = await db.lessonBlock.findFirst({
    where: { id: blockId, lesson: { module: { courseId } } },
    include: { quiz: { include: { questions: { include: { options: true }, orderBy: { position: 'asc' } } } } },
  })

  if (!block || !block.quiz) {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <QuizPlayer quiz={block.quiz} courseId={courseId} />
    </div>
  )
}
