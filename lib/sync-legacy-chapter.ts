import { BlockType } from '@prisma/client'

import { db } from './db'

const POSITION_MULTIPLIER_MODULE = 10000
const POSITION_MULTIPLIER_LESSON = 100

const computeChapterPosition = (modulePosition: number, lessonPosition: number, blockPosition: number) => {
  return modulePosition * POSITION_MULTIPLIER_MODULE + lessonPosition * POSITION_MULTIPLIER_LESSON + blockPosition
}

export async function syncLegacyChapterForBlock(blockId: string) {
  const block = await db.lessonBlock.findUnique({
    where: { id: blockId },
    include: {
      lesson: {
        include: {
          module: {
            include: {
              course: true,
            },
          },
        },
      },
    },
  })

  if (!block) {
    return
  }

  const syncableTypes = [BlockType.VIDEO_LESSON, BlockType.LIVE_SESSION, BlockType.RESOURCES]
  const isSyncableBlock = syncableTypes.includes(block.type)

  if (!isSyncableBlock) {
    if (block.legacyChapterId) {
      await db.chapter.delete({ where: { id: block.legacyChapterId } }).catch(() => undefined)
      await db.lessonBlock.update({ where: { id: block.id }, data: { legacyChapterId: null } })
    }
    return
  }

  const { lesson } = block
  const module = lesson.module
  const data = {
    title: block.title,
    description: block.content ?? lesson.description ?? module.description ?? null,
    position: computeChapterPosition(module.position ?? 0, lesson.position ?? 0, block.position ?? 0),
    videoUrl: block.type === BlockType.VIDEO_LESSON ? block.videoUrl ?? null : null,
    contentUrl:
      block.type === BlockType.VIDEO_LESSON
        ? block.contentUrl ?? null
        : block.contentUrl ?? null,
    isPublished:
      Boolean(block.isPublished) && Boolean(lesson.isPublished) && Boolean(module.isPublished) && Boolean(module.course.isPublished),
    isPreview: lesson.isPreview ?? false,
    estimatedDurationMinutes: lesson.estimatedDurationMinutes,
  }

  if (block.legacyChapterId) {
    await db.chapter.update({ where: { id: block.legacyChapterId }, data }).catch(() => undefined)
    return
  }

  const chapter = await db.chapter.create({
    data: {
      ...data,
      courseId: module.courseId,
    },
  })

  await db.lessonBlock.update({ where: { id: block.id }, data: { legacyChapterId: chapter.id } })
}

export async function syncLegacyChaptersForModule(moduleId: string) {
  const blocks = await db.lessonBlock.findMany({
    where: {
      lesson: {
        moduleId,
      },
      type: {
        in: [BlockType.VIDEO_LESSON, BlockType.LIVE_SESSION, BlockType.RESOURCES],
      },
    },
    select: { id: true },
  })

  await Promise.all(blocks.map((item) => syncLegacyChapterForBlock(item.id)))
}

export async function syncLegacyChaptersForLesson(lessonId: string) {
  const blocks = await db.lessonBlock.findMany({
    where: {
      lessonId,
      type: {
        in: [BlockType.VIDEO_LESSON, BlockType.LIVE_SESSION, BlockType.RESOURCES],
      },
    },
    select: { id: true },
  })

  await Promise.all(blocks.map((item) => syncLegacyChapterForBlock(item.id)))
}

export async function syncLegacyChaptersForCourse(courseId: string) {
  const blocks = await db.lessonBlock.findMany({
    where: {
      lesson: {
        module: {
          courseId,
        },
      },
      type: {
        in: [BlockType.VIDEO_LESSON, BlockType.LIVE_SESSION, BlockType.RESOURCES],
      },
    },
    select: { id: true },
  })

  await Promise.all(blocks.map((item) => syncLegacyChapterForBlock(item.id)))
}
