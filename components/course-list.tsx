import type { CourseEnrollmentStatus } from '@prisma/client'

import CourseCard from './course-card'

type CourseListItem = {
  id: string
  title: string
  imageUrl?: string | null
  chapters?: { id: string }[]
  modules?: { id: string }[]
  _count?: { modules?: number }
  category?: { name: string | null } | null
  progress: number | null
  enrollmentStatus?: CourseEnrollmentStatus | null
}

type CoursesListProps = {
  items: CourseListItem[]
  emptyState?: string
}

export default function CoursesList({ items, emptyState }: CoursesListProps) {
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((course) => (
          <CourseCard
            key={course.id}
            id={course.id}
            title={course.title}
            imageUrl={course.imageUrl}
            progress={course.progress}
            status={course.enrollmentStatus}
            moduleCount={course.modules?.length ?? course._count?.modules ?? course.chapters?.length ?? 0}
            category={course?.category?.name ?? undefined}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          {emptyState ?? 'No courses to show yet.'}
        </div>
      ) : null}
    </div>
  )
}
