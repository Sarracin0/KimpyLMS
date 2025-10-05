import { NextRequest, NextResponse } from 'next/server'
import { AttachmentScope, UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{
  courseId: string
}>

export async function GET(_: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId } = await params

    const attachments = await db.attachment.findMany({
      where: {
        courseId,
        course: { companyId: company.id },
        scope: { in: [AttachmentScope.COURSE, AttachmentScope.LESSON] },
      },
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    logError('COURSE_DOCUMENTS_GET', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId } = await params

    const course = await db.course.findFirst({
      where: { id: courseId, companyId: company.id },
      select: { id: true },
    })

    if (!course) {
      return new NextResponse('Course not found', { status: 404 })
    }

    const { url, name, type } = await request.json()

    if (typeof url !== 'string' || !url.trim()) {
      return new NextResponse('Document url is required', { status: 400 })
    }

    const attachment = await db.attachment.create({
      data: {
        courseId,
        chapterId: null,
        url: url.trim(),
        name: typeof name === 'string' && name.trim() ? name.trim() : url.trim().split('/').pop() ?? 'Document',
        type: typeof type === 'string' && type.trim() ? type.trim() : null,
        scope: AttachmentScope.COURSE,
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    logError('COURSE_DOCUMENTS_POST', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
