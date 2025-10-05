import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { logError } from '@/lib/logger'

import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'

type RouteParams = Promise<{
  courseId: string
}>

export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { company } = await requireAuthContext()
    const { courseId } = await params
    const course = await db.course.findFirst({ where: { id: courseId, companyId: company.id } })
    if (!course) return new NextResponse('Not found', { status: 404 })
    return NextResponse.json(course)
  } catch (error) {
    logError('COURSE_GET', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId } = await params
    const existingCourse = await db.course.findFirst({ where: { id: courseId, companyId: company.id } })

    if (!existingCourse) {
      return new NextResponse('Course not found', { status: 404 })
    }

    if (profile.role === UserRole.TRAINER && existingCourse.createdByProfileId !== profile.id) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const {
      title,
      description,
      imageUrl,
      categoryId,
      estimatedDurationMinutes,
      level,
      learningOutcomes,
      prerequisites,
      isLeaderboardEnabled,
    } = await request.json()

    const updatedCourse = await db.course.update({
      where: { id: courseId },
      data: {
        title,
        description,
        imageUrl,
        categoryId: categoryId ? categoryId : null,
        estimatedDurationMinutes: typeof estimatedDurationMinutes === 'number' ? estimatedDurationMinutes : null,
        level,
        learningOutcomes,
        prerequisites,
        isLeaderboardEnabled: typeof isLeaderboardEnabled === 'boolean' ? isLeaderboardEnabled : undefined,
      },
    })

    return NextResponse.json(updatedCourse)
  } catch (error) {
    logError('COURSE_PATCH', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId } = await params

    const existingCourse = await db.course.findFirst({ where: { id: courseId, companyId: company.id } })

    if (!existingCourse) {
      return new NextResponse('Course not found', { status: 404 })
    }

    if (profile.role === UserRole.TRAINER && existingCourse.createdByProfileId !== profile.id) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    await db.course.delete({ where: { id: courseId } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    logError('COURSE_DELETE', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
