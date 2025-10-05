import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{
  courseId: string
  moduleId: string
  lessonId: string
  blockId: string
  attachmentId: string
}>

export async function DELETE(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId, moduleId, lessonId, blockId, attachmentId } = await params

    const courseFilters = {
      companyId: company.id,
      ...(profile.role === UserRole.TRAINER ? { createdByProfileId: profile.id } : {}),
    }

    const attachment = await db.lessonBlockAttachment.findFirst({
      where: {
        id: attachmentId,
        blockId,
        block: {
          lessonId,
          lesson: {
            moduleId,
            module: {
              courseId,
              course: courseFilters,
            },
          },
        },
      },
    })

    if (!attachment) {
      return new NextResponse('Attachment not found', { status: 404 })
    }

    await db.lessonBlockAttachment.delete({ where: { id: attachment.id } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    logError('LESSON_BLOCK_ATTACHMENT_DELETE', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
