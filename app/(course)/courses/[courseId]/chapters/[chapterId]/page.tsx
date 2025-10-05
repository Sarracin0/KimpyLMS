'use server'

import { redirect } from 'next/navigation'

import { getChapter } from '@/actions/get-chapter'
import { Banner } from '@/components/banner'
import { Preview } from '@/components/preview'
import { Separator } from '@/components/ui/separator'
import { requireAuthContext } from '@/lib/current-profile'

import CourseEnrollButton from './_components/course-enroll-button'
import { CourseProgressButton } from './_components/course-progress-button'
import { VideoPlayer } from './_components/video-player'
import { VirtualClassroomCard } from './_components/virtual-classroom-card'

type ChapterDetailsProps = {
  params: Promise<{
    courseId: string
    chapterId: string
  }>
}

export default async function ChapterDetails({ params }: ChapterDetailsProps) {
  const resolvedParams = await params
  const { profile, company } = await requireAuthContext()

  const {
    course,
    chapter,
    attachments,
    nextChapter,
    userProgress,
    enrollment,
    canAccessContent,
    block,
  } = await getChapter({
    userProfileId: profile.id,
    companyId: company.id,
    ...resolvedParams,
  })

  if (!chapter || !course) {
    return redirect('/courses')
  }

  const isLocked = !canAccessContent
  const completedOnEnd = Boolean(enrollment) && !userProgress?.isCompleted
  const liveSessionConfig = block?.liveSessionConfig ?? null
  const liveSessionJoinUrl =
    liveSessionConfig && typeof liveSessionConfig.joinUrl === 'string'
      ? liveSessionConfig.joinUrl
      : null
  const liveSessionMeetingId =
    liveSessionConfig && typeof liveSessionConfig.meetingId === 'string'
      ? liveSessionConfig.meetingId
      : undefined
  const liveSessionStatus =
    liveSessionConfig && typeof liveSessionConfig.status === 'string' ? liveSessionConfig.status : undefined
  const liveSessionScheduledFor = block?.liveSession?.scheduledFor?.toISOString() ?? null

  return (
    <div>
      {userProgress?.isCompleted ? <Banner label="You already completed this chapter." variant="success" /> : null}
      {isLocked ? <Banner label="Enroll in this course to unlock the chapter." variant="warning" /> : null}

      <div className="mx-auto max-w-5xl space-y-4 pb-20 p-4">
        {/* Header: title above video with action on the right */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/20 bg-white/60 p-5 text-foreground backdrop-blur-md supports-[backdrop-filter]:bg-white/50 md:flex-row">
          <div>
            <h1 className="text-2xl font-semibold">{chapter.title}</h1>
            <p className="text-sm text-muted-foreground">Part of {course.title}</p>
          </div>
          {enrollment ? (
            <CourseProgressButton
              chapterId={resolvedParams.chapterId}
              courseId={resolvedParams.courseId}
              nextChapterId={nextChapter?.id}
              isCompleted={!!userProgress?.isCompleted}
            />
          ) : (
            <CourseEnrollButton courseId={resolvedParams.courseId} userProfileId={profile.id} />
          )}
        </div>

        {/* Video / Live session / Resources block */}
        <div className="rounded-2xl border border-white/20 bg-white/60 p-2 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
          {block?.type === 'LIVE_SESSION' ? (
            <VirtualClassroomCard
              title={chapter.title}
              meetingId={liveSessionMeetingId}
              joinUrl={liveSessionJoinUrl ?? chapter.contentUrl}
              status={liveSessionStatus}
              scheduledFor={liveSessionScheduledFor}
              isLocked={isLocked}
            />
          ) : block?.type === 'RESOURCES' ? (
            <div className="space-y-4 rounded-xl border border-white/30 bg-white/60 p-4 text-foreground backdrop-blur supports-[backdrop-filter]:bg-white/50">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{block.title || chapter.title}</h2>
                {block.content ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{block.content}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Materiali aggiuntivi per questa lezione.</p>
                )}
              </div>

              {block.contentUrl ? (
                <a
                  href={block.contentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  Apri link esterno
                </a>
              ) : null}

              <Separator className="bg-white/30" />

              <div>
                <h3 className="text-sm font-semibold text-foreground">Documenti allegati</h3>
                {block.attachments && block.attachments.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {block.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        className="flex w-full items-center justify-between rounded-lg border border-white/40 bg-white/60 p-3 text-sm text-foreground transition-colors backdrop-blur-md supports-[backdrop-filter]:bg-white/50 hover:bg-white/70"
                        target="_blank"
                        href={attachment.url}
                        rel="noreferrer"
                      >
                        {attachment.name}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isLocked ? 'Iscriviti al corso per scaricare i documenti allegati.' : 'Nessun documento caricato per questo blocco.'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <VideoPlayer
              chapterId={chapter.id}
              title={chapter.title}
              courseId={resolvedParams.courseId}
              nextChapterId={nextChapter?.id}
              isLocked={isLocked}
              completeOnEnd={completedOnEnd}
              videoUrl={chapter.videoUrl ?? undefined}
            />
          )}
        </div>

        {/* Description below video */}
        <div className="rounded-2xl border border-white/20 bg-white/50 p-5 backdrop-blur supports-[backdrop-filter]:bg-white/40">
          {chapter.description ? (
            <Preview value={chapter.description} />
          ) : (
            <p className="text-sm text-muted-foreground">No description provided for this lesson yet.</p>
          )}
        </div>

        {/* Attachments (already styled to glass links) */}
        {attachments && attachments.length > 0 && block?.type !== 'RESOURCES' ? (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <a
                className="flex w-full items-center justify-between rounded-lg border border-white/30 bg-white/50 p-3 text-sm text-foreground transition-colors backdrop-blur-md supports-[backdrop-filter]:bg-white/40 hover:bg-white/60"
                key={attachment.id}
                target="_blank"
                href={attachment.url}
                rel="noreferrer"
              >
                {attachment.name}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
