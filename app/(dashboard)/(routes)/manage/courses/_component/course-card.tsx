'use client'

import Link from 'next/link'
import { CalendarClock, MoreHorizontal, Play, Tag } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ManageCourse } from './manage-courses-client'

export function CourseCard({ course }: { course: ManageCourse }) {
  const total = course.enrollments.length
  const completed = course.enrollments.filter((e) => e.status === 'COMPLETED').length

  return (
    <Card className="group relative overflow-hidden border bg-card transition hover:shadow-lg">
      <div className="p-4">
        {/* Header testo-only */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Icona in cerchio, nessuna immagine/preview */}
            <div className="grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-muted/40">
              <Play className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {course.category?.name ? (
                  <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{course.category.name}</span>
                ) : (
                  <span className="text-muted-foreground">Uncategorised</span>
                )}
              </div>
              <h3 className={cn('mt-0.5 truncate text-base font-medium leading-tight')}>{course.title}</h3>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant={course.isPublished ? 'default' : 'secondary'}>{course.isPublished ? 'Published' : 'Draft'}</Badge>
            <Button variant="ghost" size="icon" className="opacity-0 transition group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-3 w-3" />
            <span>Aggiornato {new Date(course.updatedAt).toLocaleDateString()}</span>
          </div>
          <div className="font-medium text-foreground">{completed}/{total}</div>
        </div>

        {/* Azioni */}
        <div className="mt-4 flex gap-2">
          <Link href={`/manage/courses/${course.id}`}>
            <Button size="sm">Gestisci</Button>
          </Link>
          <Link href={`/courses/${course.id}`}>
            <Button size="sm" variant="outline">
              Anteprima
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}
