'use client'

import { CourseEnrollmentStatus } from '@prisma/client'
import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Pencil } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { AddParticipantsTrigger } from './add-participants-trigger'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'

type ManageCourseRow = {
  id: string
  title: string
  imageUrl?: string | null
  isPublished: boolean
  category?: { name: string | null } | null
  enrollments: { id: string; status: CourseEnrollmentStatus }[]
  teamAssignments: { id: string }[]
  updatedAt: Date | string
}

export const columns: ColumnDef<ManageCourseRow>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="text-sm">
          Titolo
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const course = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 rounded-md">
            <AvatarImage src={course.imageUrl ?? undefined} alt={course.title} />
            <AvatarFallback className="rounded-md text-xs">{course.title?.[0] ?? 'C'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link href={`/manage/courses/${course.id}`} className="block truncate font-medium text-foreground hover:underline">
              {course.title}
            </Link>
            <div className="truncate text-xs text-muted-foreground">
              {course.category?.name ?? 'Senza categoria'}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'category',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="text-sm">
          Categoria
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return <span className="text-sm text-muted-foreground">{row.original.category?.name ?? 'Senza categoria'}</span>
    },
  },
  {
    accessorKey: 'enrollments',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="text-sm">
          Learner
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const count = row.original.enrollments.length
      const completed = row.original.enrollments.filter((item) => item.status === CourseEnrollmentStatus.COMPLETED).length
      const percent = count ? Math.round((completed / count) * 100) : 0

      return (
        <div className="flex items-center gap-3">
          <div className="w-28">
            <Progress value={percent} variant={percent === 100 ? 'success' : 'default'} />
          </div>
          <span className="text-sm font-medium text-foreground">{completed}/{count}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'teamAssignments',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="text-sm">
        Squadre
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-sm font-medium text-foreground">{row.original.teamAssignments.length}</span>,
  },
  {
    accessorKey: 'isPublished',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="text-sm">
        Stato
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const isPublished = row.original.isPublished
      return (
        <Badge
          className={cn(
            'rounded-full px-2 py-0.5 text-xs',
            isPublished ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
          )}
        >
          {isPublished ? 'Pubblicato' : 'Bozza'}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="text-sm">
        Aggiornato
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const value = row.original.updatedAt
      const date = typeof value === 'string' ? new Date(value) : value
      return (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(date, { addSuffix: true, locale: it })}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const { id } = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-7 w-7 p-0">
              <span className="sr-only">Apri menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <Link href={`/manage/courses/${id}`}>
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" />
                Modifica corso
              </DropdownMenuItem>
            </Link>
            <AddParticipantsTrigger courseId={id} />
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
