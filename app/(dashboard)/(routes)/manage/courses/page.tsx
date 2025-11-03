import { UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'

import { ManageCoursesClient } from './_component/manage-courses-client'

export default async function ManageCoursesPage() {
  const { profile, company } = await requireAuthContext()

  const courses = await db.course.findMany({
    where:
      profile.role === UserRole.HR_ADMIN
        ? { companyId: company.id }
        : { companyId: company.id, createdByProfileId: profile.id },
    include: {
      category: true,
      enrollments: true,
      teamAssignments: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return <ManageCoursesClient courses={courses as any} />
}
