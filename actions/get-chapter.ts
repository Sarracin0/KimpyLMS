import { BlockType, CourseEnrollment, UserProgress as PrismaUserProgress } from '@prisma/client'

import { db } from '@/lib/db'

type GetChapterArgs = {
  userProfileId: string
  companyId: string
  courseId: string
  chapterId: string
}

type ChapterAccessResponse = {
  course: {
    id: string
    title: string
    description: string | null
    estimatedDurationMinutes: number | null
    imageUrl: string | null
  } | null
  chapter: {
    id: string
    title: string
    description: string | null
    videoUrl: string | null
    contentUrl: string | null
    position: number
    isPreview: boolean
  } | null
  attachments: { id: string; name: string; url: string; type: string | null }[] | null
  nextChapter: { id: string; title: string; position: number } | null
  userProgress: PrismaUserProgress | null
  enrollment: CourseEnrollment | null
  canAccessContent: boolean
  block:
    | {
        id: string
        type: BlockType
        title: string
        content: string | null
        contentUrl: string | null
        liveSessionConfig: Record<string, unknown> | null
        liveSession:
          | {
              id: string
              scheduledFor: Date
              durationMinutes: number | null
            }
          | null
        attachments: { id: string; name: string; url: string; type: string | null }[]
      }
    | null
}

export async function getChapter({ userProfileId, companyId, courseId, chapterId }: GetChapterArgs): Promise<ChapterAccessResponse> {
  try {
    const course = await db.course.findFirst({
      where: { id: courseId, companyId, isPublished: true },
      select: {
        id: true,
        title: true,
        description: true,
        estimatedDurationMinutes: true,
        imageUrl: true,
      },
    })

    if (!course) {
      return {
        course: null,
        chapter: null,
        attachments: null,
        nextChapter: null,
        userProgress: null,
        enrollment: null,
        canAccessContent: false,
        block: null,
      }
    }

    const chapter = await db.chapter.findFirst({
      where: { id: chapterId, courseId, isPublished: true },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        contentUrl: true,
        position: true,
        isPreview: true,
      },
    })

    if (!chapter) {
      return {
        course,
        chapter: null,
        attachments: null,
        nextChapter: null,
        userProgress: null,
        enrollment: null,
        canAccessContent: false,
        block: null,
      }
    }

    const lessonBlock = await db.lessonBlock.findFirst({
      where: { legacyChapterId: chapter.id },
      select: {
        id: true,
        lessonId: true,
        type: true,
        title: true,
        content: true,
        contentUrl: true,
        liveSessionConfig: true,
        liveSession: {
          select: {
            id: true,
            scheduledFor: true,
            durationMinutes: true,
          },
        },
      },
    })

    const enrollment = await db.courseEnrollment.findUnique({
      where: {
        courseId_userProfileId: {
          courseId,
          userProfileId,
        },
      },
    })

    const legacyAttachments = await db.attachment.findMany({
      where: {
        courseId,
        OR: [
          { chapterId: chapter.id },
          { chapterId: null },
        ],
      },
      select: { id: true, name: true, url: true, type: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const blockAttachments = lessonBlock
      ? await db.lessonBlockAttachment.findMany({
          where: {
            OR: [
              { blockId: lessonBlock.id },
              {
                block: {
                  lessonId: lessonBlock.lessonId,
                  type: BlockType.RESOURCES,
                },
              },
            ],
          },
          select: { id: true, name: true, url: true, type: true, createdAt: true, blockId: true },
          orderBy: { createdAt: 'asc' },
        })
      : []

    const normalizedLegacyAttachments = legacyAttachments.map((attachment) => ({
      ...attachment,
      createdAtMs: attachment.createdAt.getTime(),
    }))

    const normalizedBlockAttachments = blockAttachments.map((attachment) => ({
      ...attachment,
      createdAtMs: attachment.createdAt.getTime(),
    }))

    const attachments = [...normalizedLegacyAttachments, ...normalizedBlockAttachments]
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map(({ id, name, url, type }) => ({ id, name, url, type }))

    const attachmentsForCurrentBlock = lessonBlock
      ? normalizedBlockAttachments
          .filter((attachment) => attachment.blockId === lessonBlock.id)
          .sort((a, b) => a.createdAtMs - b.createdAtMs)
          .map(({ id, name, url, type }) => ({ id, name, url, type }))
      : []

    const nextChapter = await db.chapter.findFirst({
      where: { courseId, isPublished: true, position: { gt: chapter.position } },
      select: { id: true, title: true, position: true },
      orderBy: { position: 'asc' },
    })

    const userProgress = await db.userProgress.findUnique({
      where: {
        userProfileId_chapterId: {
          userProfileId,
          chapterId,
        },
      },
    })

    const canAccessContent = Boolean(enrollment || chapter.isPreview)
    const visibleAttachments = enrollment ? attachments : []
    const visibleBlockAttachments = enrollment ? attachmentsForCurrentBlock : []

    return {
      course,
      chapter,
      attachments: visibleAttachments,
      nextChapter,
      userProgress,
      enrollment,
      canAccessContent,
      block: lessonBlock
        ? {
            id: lessonBlock.id,
            type: lessonBlock.type,
            title: lessonBlock.title,
            content: lessonBlock.content ?? null,
            contentUrl: lessonBlock.contentUrl ?? null,
            liveSessionConfig: (lessonBlock.liveSessionConfig as Record<string, unknown> | null) ?? null,
            liveSession: lessonBlock.liveSession,
            attachments: visibleBlockAttachments,
          }
        : null,
    }
  } catch {
    return {
      course: null,
      chapter: null,
      attachments: null,
      nextChapter: null,
      userProgress: null,
      enrollment: null,
      canAccessContent: false,
      block: null,
    }
  }
}
