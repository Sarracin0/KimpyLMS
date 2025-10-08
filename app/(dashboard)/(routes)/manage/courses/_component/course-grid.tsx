"use client"

import { CourseCard } from "./course-card"
import type { ManageCourse } from "./manage-courses-client"

export function CourseGrid({ courses }: { courses: ManageCourse[] }) {
  if (!courses.length) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed p-16 text-center text-sm text-muted-foreground">
        Nessun corso trovato.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  )
}
