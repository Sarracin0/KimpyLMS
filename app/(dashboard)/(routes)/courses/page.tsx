import { getDashboardCourses } from '@/actions/get-dashboard-courses'
import CoursesList from '@/components/course-list'
import { requireAuthContext } from '@/lib/current-profile'

export default async function MyCoursesPage() {
  const { profile } = await requireAuthContext()

  const { coursesInProgress, completedCourses } = await getDashboardCourses(profile.id)

  const inProgressMapped = coursesInProgress.map((enrollment) => ({
    ...enrollment.course,
    progress: enrollment.progress,
    enrollmentStatus: enrollment.status,
  }))

  const completedMapped = completedCourses.map((enrollment) => ({
    ...enrollment.course,
    progress: enrollment.progress,
    enrollmentStatus: enrollment.status,
  }))

  return (
    <div className="space-y-8 p-6">
      <div className="rounded-2xl border border-white/20 bg-white/60 p-5 text-foreground backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
        <h1 className="text-xl font-semibold">My courses</h1>
        <p className="text-sm text-muted-foreground">Track your assigned learning plans and complete your training goals.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">In progress</h2>
        <div className="rounded-2xl border border-white/20 bg-white/60 p-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
          <CoursesList
            items={inProgressMapped}
            emptyState="No active courses. Head to the library to discover new learning paths."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Completed</h2>
        <div className="rounded-2xl border border-white/20 bg-white/60 p-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
          <CoursesList items={completedMapped} emptyState="Courses you complete will show up here." />
        </div>
      </section>
    </div>
  )
}
