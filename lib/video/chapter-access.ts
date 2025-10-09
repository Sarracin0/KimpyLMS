import { db } from '@/lib/db'

type ChapterAccessInput = {
  chapterId: string
  courseId: string
  companyId: string
}

export async function getChapterWithCourseContext({ chapterId, courseId, companyId }: ChapterAccessInput) {
  return db.chapter.findFirst({
    where: {
      id: chapterId,
      courseId,
      course: {
        id: courseId,
        companyId,
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      videoUrl: true,
      contentUrl: true,
      course: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  })
}
