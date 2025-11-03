import Link from 'next/link'
import type { CourseEnrollmentStatus } from '@prisma/client'
import { BookOpenIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { IconBadge } from './icon-badge'
import { CourseProgress } from './course-progress'

const STATUS_LABEL: Record<CourseEnrollmentStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  OVERDUE: 'Overdue',
}

type CourseCardProps = {
  id: string
  title: string
  imageUrl?: string | null
  moduleCount: number
  progress: number | null
  category?: string | null
  status?: CourseEnrollmentStatus | null
}

export default function CourseCard({ id, title, moduleCount, progress, category, status }: CourseCardProps) {
  return (
    <Link href={`/courses/${id}`} className="block focus:outline-none">
      <Card className="group h-full overflow-hidden rounded-xl border bg-card p-4 transition hover:border-primary/30 hover:shadow-md focus-within:ring-2 focus-within:ring-primary/30">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/60 bg-muted/40 text-foreground/80">
            <BookOpenIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-semibold leading-tight tracking-tight group-hover:text-primary md:text-[15px]">
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{category ?? 'General track'}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-sm md:text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <IconBadge size="sm" icon={BookOpenIcon} />
            <span>
              {moduleCount} {moduleCount === 1 ? 'Module' : 'Modules'}
            </span>
          </div>
          {status ? (
            <span className="text-xs font-medium text-muted-foreground">{STATUS_LABEL[status] ?? status}</span>
          ) : null}
        </div>

        {progress !== null ? (
          <div className="mt-3">
            <CourseProgress variant={progress === 100 ? 'success' : 'default'} size="sm" value={progress} />
          </div>
        ) : (
          <span className="mt-3 inline-block text-sm font-medium text-primary">View course details</span>
        )}
      </Card>
    </Link>
  )
}
