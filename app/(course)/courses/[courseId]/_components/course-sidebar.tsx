import { CourseProgress } from '@/components/course-progress'
import { requireAuthContext } from '@/lib/current-profile'
import { Accordion } from '@/components/ui/accordion'

import CourseSidebarItem from './course-sidebar-item'
import CourseSidebarModule from './course-sidebar-module'
import { CourseWithStructure } from './course-sidebar.types'

type CourseSidebarProps = {
  course: CourseWithStructure
  progressCount: number
}

export default async function CourseSidebar({ course, progressCount }: CourseSidebarProps) {
  const { profile } = await requireAuthContext()

  const enrollment = course.enrollments.find((item) => item.userProfileId === profile.id)

  // Determina quale struttura usare: nuova (modules) o legacy (chapters)
  const hasModules = course.modules && course.modules.length > 0
  const hasChapters = course.chapters.length > 0

  return (
    <div className="flex h-full flex-col overflow-y-auto border-r border-white/20 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50 rounded-t-2xl shadow-lg">
      <div className="flex flex-col border-b border-white/20 p-6">
        <h1 className="text-lg font-semibold text-foreground">{course.title}</h1>
        {enrollment ? (
          <div className="mt-8">
            <CourseProgress variant="success" value={progressCount} />
          </div>
        ) : null}
      </div>

      <div className="flex w-full flex-col">
        {hasModules ? (
          // Nuova struttura gerarchica: Module → Lesson → Block
          <Accordion type="multiple" className="w-full">
            {course.modules?.map((module) => (
              <CourseSidebarModule
                key={module.id}
                module={module}
                courseId={course.id}
                isLocked={!enrollment}
              />
            ))}
          </Accordion>
        ) : hasChapters ? (
          // Legacy: chapters piatti
          course.chapters.map((chapter) => (
            <CourseSidebarItem
              key={chapter.id}
              id={chapter.id}
              label={chapter.title}
              isCompleted={!!chapter.progress?.[0]?.isCompleted}
              courseId={course.id}
              isLocked={!chapter.isPreview && !enrollment}
            />
          ))
        ) : null}
      </div>
    </div>
  )
}
