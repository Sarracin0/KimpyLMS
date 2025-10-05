import { db } from '@/lib/db'

export type CourseLeaderboardEntry = {
  userProfileId: string
  avatarUrl: string | null
  points: number
}

// KISS: compute course-scoped points from three sources
// - UserLessonProgress.pointsAwarded (new builder)
// - UserProgress.pointsAwarded (legacy chapters)
// - UserCourseAchievement.pointsAwarded (achievements)
// Only include enrolled users.
export async function getCourseLeaderboard(courseId: string): Promise<CourseLeaderboardEntry[]> {
  // Fetch enrolled users
  const enrollments = await db.courseEnrollment.findMany({
    where: { courseId },
    select: { userProfileId: true },
  })
  if (enrollments.length === 0) return []
  const userIds = enrollments.map((e) => e.userProfileId)

  // Preload user avatars
  const profiles = await db.userProfile.findMany({
    where: { id: { in: userIds } },
    select: { id: true, avatarUrl: true },
  })
  const avatarByUser: Record<string, string | null> = {}
  for (const p of profiles) avatarByUser[p.id] = p.avatarUrl ?? null

  // Chapters (legacy)
  const chapters = await db.chapter.findMany({ where: { courseId }, select: { id: true } })
  const chapterIds = chapters.map((c) => c.id)
  const legacyPoints = chapterIds.length
    ? await db.userProgress.groupBy({
        by: ['userProfileId'],
        where: { chapterId: { in: chapterIds } },
        _sum: { pointsAwarded: true },
      })
    : []

  // New builder: lessons under modules of this course
  const modules = await db.courseModule.findMany({ where: { courseId }, select: { id: true } })
  const moduleIds = modules.map((m) => m.id)
  const lessons = moduleIds.length
    ? await db.lesson.findMany({ where: { moduleId: { in: moduleIds } }, select: { id: true } })
    : []
  const lessonIds = lessons.map((l) => l.id)
  const lessonPoints = lessonIds.length
    ? await db.userLessonProgress.groupBy({
        by: ['userProfileId'],
        where: { lessonId: { in: lessonIds } },
        _sum: { pointsAwarded: true },
      })
    : []

  // Achievements for this course
  const achievementPoints = await db.userCourseAchievement.groupBy({
    by: ['userProfileId'],
    where: { achievement: { courseId } },
    _sum: { pointsAwarded: true },
  })

  const pointsMap = new Map<string, number>()
  const addPoints = (userId: string, pts: number) => {
    if (!pts) return
    pointsMap.set(userId, (pointsMap.get(userId) ?? 0) + pts)
  }

  for (const x of legacyPoints) addPoints(x.userProfileId, x._sum.pointsAwarded ?? 0)
  for (const x of lessonPoints) addPoints(x.userProfileId, x._sum.pointsAwarded ?? 0)
  for (const x of achievementPoints) addPoints(x.userProfileId, x._sum.pointsAwarded ?? 0)

  // Ensure only enrolled users are included
  const results: CourseLeaderboardEntry[] = userIds.map((id) => ({
    userProfileId: id,
    avatarUrl: avatarByUser[id] ?? null,
    points: pointsMap.get(id) ?? 0,
  }))

  results.sort((a, b) => b.points - a.points)
  return results
}