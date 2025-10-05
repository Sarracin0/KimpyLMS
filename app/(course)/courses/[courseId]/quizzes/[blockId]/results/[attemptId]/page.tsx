import { notFound, redirect } from 'next/navigation'

import { requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { UserRole } from '@prisma/client'
import { QuizResultsViewer } from './_components/quiz-results-viewer'

export default async function QuizAttemptResultPage({
  params,
}: {
  params: Promise<{ courseId: string; blockId: string; attemptId: string }>
}) {
  const { profile, company } = await requireAuthContext()
  const { courseId, blockId, attemptId } = await params

  const attempt = await db.quizAttempt.findFirst({
    where: {
      id: attemptId,
      quizId: blockId,
      quiz: { companyId: company.id },
    },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: { options: true },
          },
        },
      },
      answers: {
        include: {
          options: {
            include: {
              option: true,
            },
          },
        },
      },
    },
  })

  if (!attempt) {
    return notFound()
  }

  const isOwner = attempt.userProfileId === profile.id
  const canView = isOwner || profile.role !== UserRole.LEARNER

  if (!canView) {
    return redirect(`/courses/${courseId}`)
  }

  const questionMap = new Map(attempt.answers.map((answer) => [answer.questionId, answer]))

  const maxPossibleScore = attempt.quiz.questions.reduce((acc, question) => {
    const maxOptionPoints = question.options
      .filter((option) => option.isCorrect)
      .reduce((sum, option) => sum + (option.points || 0), 0)
    const questionMax = question.points > 0 ? question.points : maxOptionPoints
    return acc + questionMax
  }, 0)

  const questions = attempt.quiz.questions.map((question) => {
    const answer = questionMap.get(question.id)
    const selectedOptionIds = new Set(answer?.options?.map((opt) => opt.optionId) ?? [])

    return {
      id: question.id,
      text: question.text,
      explanation: question.explanation ?? null,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
      })),
      userSelection: {
        selectedOptionIds: Array.from(selectedOptionIds),
        freeText: answer?.freeText ?? null,
        isCorrect: answer?.isCorrect ?? null,
        scoreAwarded: answer?.scoreAwarded ?? 0,
      },
    }
  })

  const percent = maxPossibleScore > 0 ? Math.round(((attempt.score ?? 0) * 100) / maxPossibleScore) : 0

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <QuizResultsViewer
        quiz={{
          id: attempt.quizId,
          title: attempt.quiz.title,
          passScore: attempt.quiz.passScore,
          pointsReward: attempt.quiz.pointsReward,
        }}
        attempt={{
          id: attempt.id,
          score: attempt.score ?? 0,
          maxScore: maxPossibleScore,
          percent: percent,
          passed: attempt.passed,
          submittedAt: attempt.submittedAt,
        }}
        questions={questions}
        retakeHref={`/courses/${courseId}/quizzes/${attempt.quizId}`}
      />
    </div>
  )
}
