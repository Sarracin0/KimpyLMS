import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Eye, LayoutDashboard, Video } from 'lucide-react'
import { UserRole } from '@prisma/client'

import { Banner } from '@/components/banner'
import { IconBadge } from '@/components/icon-badge'
import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'

import { ChapterActions } from './_components/chapter-actions'
import { ChapterAccessForm } from './_components/chapter-access-form'
import { ChapterDescriptionForm } from './_components/chapter-description-form'
import { ChapterTitleForm } from './_components/chapter-title-form'
import { ChapterVideoForm } from './_components/chapter-video-form'

type ChapterIdPageProps = {
  params: Promise<{
    courseId: string
    chapterId: string
  }>
}

const ChapterIdPage = async ({ params }: ChapterIdPageProps) => {
  const resolvedParams = await params
  const { profile, company } = await requireAuthContext()

  const chapter = await db.chapter.findFirst({
    where: {
      id: resolvedParams.chapterId,
      courseId: resolvedParams.courseId,
      course: { companyId: company.id },
    },
    include: {
      course: { select: { createdByProfileId: true } },
    },
  })

  if (!chapter) {
    return redirect('/manage/courses')
  }

  if (profile.role === UserRole.TRAINER && chapter.course.createdByProfileId !== profile.id) {
    return redirect('/manage/courses')
  }

  const requiredFields = [chapter.title, chapter.description, chapter.videoUrl || chapter.contentUrl]

  const totalFields = requiredFields.length
  const completedFields = requiredFields.filter(Boolean).length

  const completionText = `(${completedFields}/${totalFields})`
  const isComplete = requiredFields.every(Boolean)

  return (
    <>
      {!chapter.isPublished && (
        <Banner variant="warning" label="Questo capitolo non è pubblicato. Non sarà visibile nel corso." />
      )}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="w-full">
            <Link
              href={`/manage/courses/${resolvedParams.courseId}`}
              className="mb-6 flex items-center text-sm transition hover:opacity-75"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alla configurazione del corso
            </Link>
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-col gap-y-2">
                <h1 className="text-2xl font-medium">Workspace del capitolo</h1>
                <span className="text-sm text-muted-foreground">Compila tutti i campi {completionText}</span>
              </div>
              <ChapterActions
                disabled={!isComplete}
                courseId={resolvedParams.courseId}
                chapterId={resolvedParams.chapterId}
                isPublished={chapter.isPublished}
              />
            </div>
          </div>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-x-2">
                <IconBadge icon={LayoutDashboard} />
                <h2 className="text-xl">Personalizza il capitolo</h2>
              </div>
              <ChapterTitleForm
                initialData={chapter}
                courseId={resolvedParams.courseId}
                chapterId={resolvedParams.chapterId}
              />
              <ChapterDescriptionForm
                initialData={chapter}
                courseId={resolvedParams.courseId}
                chapterId={resolvedParams.chapterId}
              />
            </div>
            <div>
              <div className="flex items-center gap-x-2">
                <IconBadge icon={Eye} />
                <h2 className="text-xl">Impostazioni di accesso</h2>
              </div>
              <ChapterAccessForm
                initialData={chapter}
                courseId={resolvedParams.courseId}
                chapterId={resolvedParams.chapterId}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-x-2">
              <IconBadge icon={Video} />
              <h2 className="text-xl">Aggiungi contenuti alla lezione</h2>
            </div>
            <ChapterVideoForm
              initialData={chapter}
              chapterId={resolvedParams.chapterId}
              courseId={resolvedParams.courseId}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default ChapterIdPage
