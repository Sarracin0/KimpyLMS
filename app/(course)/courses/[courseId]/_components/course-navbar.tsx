import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CourseMobileSidebar from './course-mobile-sidebar'
import { NavbarRoutes } from '@/components/navbar-routes'
import { CourseWithStructure } from './course-sidebar.types'

type CourseNavbarProps = {
  course: CourseWithStructure
  progressCount: number
}

export default function CourseNavbar({ course, progressCount }: CourseNavbarProps) {
  return (
    <div className="flex h-full items-center border-b border-white/20 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50 p-4">
      <CourseMobileSidebar course={course} progressCount={progressCount} />

      <div className="ml-1">
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/50 px-3 py-1.5 text-sm text-foreground backdrop-blur-md transition-colors hover:bg-white/60"
        >
          <ArrowLeft className="h-4 w-4 text-[#5D62E1]" />
          <span className="hidden sm:inline">Back to courses</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </div>

      <div className="ml-auto">
        <NavbarRoutes />
      </div>
    </div>
  )
}
