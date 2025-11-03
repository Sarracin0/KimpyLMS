'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PlusCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

import { DataTable } from './data-table'
import { columns } from './columns'
import { CourseGrid } from './course-grid'

// This type mirrors what page.tsx fetches (includes category, enrollments, teamAssignments)
export type ManageCourse = {
  id: string
  title: string
  description?: string | null
  imageUrl?: string | null
  isPublished: boolean
  updatedAt: string | Date
  category?: { name: string | null } | null
  enrollments: { id: string; status: string }[]
  teamAssignments: { id: string }[]
}

export function ManageCoursesClient({ courses }: { courses: ManageCourse[] }) {
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query) return courses
    const q = query.toLowerCase()
    return courses.filter((c) => c.title.toLowerCase().includes(q))
  }, [courses, query])

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Corsi</h1>
          <p className="text-muted-foreground">Gestisci catalogo, compliance e assegnazioni.</p>
        </div>
        {view === 'grid' ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Cerca corsi..."
              className="w-[260px]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Link href="/manage/create">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuovo corso
              </Button>
            </Link>
          </div>
        ) : (
          <Link href="/manage/create">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuovo corso
            </Button>
          </Link>
        )}
      </header>

      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as 'grid' | 'table')}>
          <TabsList>
            <TabsTrigger value="grid">Griglia</TabsTrigger>
            <TabsTrigger value="table">Tabella</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Separator />

      {view === 'grid' ? (
        <CourseGrid courses={filtered} />
      ) : (
        <DataTable columns={columns} data={courses as any} />
      )}
    </div>
  )
}
