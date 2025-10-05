import { NextRequest, NextResponse } from 'next/server'
import { AttachmentScope, UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{
  courseId: string
  chapterId: string
}>

export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { courseId, chapterId } = await params
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const chapter = await db.chapter.findFirst({
      where: { id: chapterId, courseId, course: { companyId: company.id } },
    })

    if (!chapter) {
      return new NextResponse('Chapter not found', { status: 404 })
    }

    const attachments = await db.attachment.findMany({
      where: { courseId, chapterId, scope: AttachmentScope.LESSON },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    logError('CHAPTER_ATTACHMENTS_GET', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { courseId, chapterId } = await params
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const chapter = await db.chapter.findFirst({
      where: { id: chapterId, courseId, course: { companyId: company.id } },
    })

    if (!chapter) {
      return new NextResponse('Chapter not found', { status: 404 })
    }

    if (profile.role === UserRole.TRAINER && chapter.courseId !== courseId) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const { url, name, type } = await request.json()

    if (!url) {
      return new NextResponse('Attachment url is required', { status: 400 })
    }

    const attachment = await db.attachment.create({
      data: {
        courseId,
        chapterId,
        url,
        name: name ?? url.split('/').pop() ?? 'Resource',
        type: type ?? null,
        scope: AttachmentScope.LESSON,
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    logError('CHAPTER_ATTACHMENTS_POST', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
