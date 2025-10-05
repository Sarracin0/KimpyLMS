import { redirect } from 'next/navigation'

import { getProgress } from '@/actions/get-progress'
import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'
import { DashboardProvider } from '@/components/providers/dashboard-provider'
import { CourseEnrollmentSource, UserRole } from '@prisma/client'

import CourseNavbar from './_components/course-navbar'
import CourseSidebar from './_components/course-sidebar'
import CourseLeaderboard from './_components/leaderboard'

type CourseLayoutProps = {
  children: React.ReactNode
  params: Promise<{ courseId: string }>
}

export default async function CourseLayout({ children, params }: CourseLayoutProps) {
  const context = await requireAuthContext()
  const { profile, company, organizationId } = context
  const resolvedParams = await params

  const course = await db.course.findFirst({
    where: { id: resolvedParams.courseId, companyId: company.id },
    include: {
      chapters: {
        where: { isPublished: true },
        include: {
          progress: { where: { userProfileId: profile.id } },
          attachments: true,
        },
        orderBy: { position: 'asc' },
      },
      modules: {
        where: { isPublished: true },
        include: {
          lessons: {
            where: { isPublished: true },
            include: {
              blocks: {
                where: { isPublished: true },
                include: {
                  liveSession: { select: { meetingUrl: true } },
                  gamification: {
                    include: {
                      flashcardDeck: { select: { id: true, title: true } },
                    },
                  },
                },
                orderBy: { position: 'asc' },
              },
              progress: { where: { userProfileId: profile.id } },
            },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { position: 'asc' },
      },
      enrollments: {
        where: { userProfileId: profile.id },
        select: { id: true, status: true, userProfileId: true },
      },
    },
  })

  if (!course) {
    return redirect('/courses')
  }

  // Auto-enroll HR admins in the course so they can see learner UI seamlessly
  if (profile.role === UserRole.HR_ADMIN) {
    await db.courseEnrollment.upsert({
      where: {
        courseId_userProfileId: {
          courseId: course.id,
          userProfileId: profile.id,
        },
      },
      create: {
        courseId: course.id,
        userProfileId: profile.id,
        assignedById: profile.id,
        source: CourseEnrollmentSource.MANUAL,
      },
      update: {},
    })
  }

  const progressCount = await getProgress(profile.id, course.id)

  return (
    <DashboardProvider
      value={{
        profile: {
          id: profile.id,
          role: profile.role,
          jobTitle: profile.jobTitle,
          department: profile.department,
          points: profile.points,
          streakCount: profile.streakCount,
          avatarUrl: profile.avatarUrl,
        },
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          logoUrl: company.logoUrl,
        },
        organizationId,
      }}
    >
      <div className="h-full">
        <div className="fixed inset-y-0 z-50 h-20 w-full md:pl-80">
          <CourseNavbar course={course as any} progressCount={progressCount} />
        </div>

        <div className="fixed inset-y-0 z-50 hidden h-full w-80 flex-col md:flex">
          <CourseSidebar course={course as any} progressCount={progressCount} />
        </div>

        <main className="h-full pt-20 md:pl-80">
          {course.isLeaderboardEnabled ? (
            <CourseLeaderboard courseId={course.id} currentUserProfileId={profile.id} />
          ) : null}
          {children}
        </main>
      </div>
    </DashboardProvider>
  )
}
