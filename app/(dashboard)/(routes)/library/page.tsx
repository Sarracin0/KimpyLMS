import { redirect } from 'next/navigation'

import { getCourses } from '@/actions/get-courses'
import CoursesList from '@/components/course-list'
import { SearchInput } from '@/components/search-input'
import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'

import { Categories } from './_components/category'

type LibraryPageProps = {
  searchParams: Promise<{
    title?: string
    categoryId?: string
  }>
}

const LibraryPage = async ({ searchParams }: LibraryPageProps) => {
  const context = await requireAuthContext()
  const resolvedSearchParams = await searchParams

  if (!context.organizationId) {
    return redirect('/onboarding')
  }

  const categories = await db.category.findMany({
    where: {
      OR: [{ companyId: context.company.id }, { companyId: null }],
    },
    orderBy: { name: 'asc' },
  })

  const courses = await getCourses({
    userProfileId: context.profile.id,
    companyId: context.company.id,
    title: resolvedSearchParams?.title,
    categoryId: resolvedSearchParams?.categoryId,
  })

  return (
    <>
      <div className="block px-6 pt-6 md:hidden">
        <SearchInput />
      </div>
      <div className="space-y-6 p-6 md:space-y-8 md:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Libreria dei corsi</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Sfoglia tutti i corsi disponibili per {context.company.name} e iscriviti subito.
          </p>
        </div>
        <Categories items={categories} />
        <CoursesList
          items={courses}
          emptyState="Nessun corso corrisponde ai filtri selezionati. Prova a modificare la categoria o la ricerca."
        />
      </div>
    </>
  )
}

export default LibraryPage
