import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'
import { syncLegacyChapterForBlock } from '@/lib/sync-legacy-chapter'
import { logError } from '@/lib/logger'

type RouteParams = Promise<{
  courseId: string
  moduleId: string
  lessonId: string
  blockId: string
}>

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, [UserRole.HR_ADMIN, UserRole.TRAINER])

    const { courseId, moduleId, lessonId, blockId } = await params

    const courseFilters = {
      companyId: company.id,
      ...(profile.role === UserRole.TRAINER ? { createdByProfileId: profile.id } : {}),
    }

    const block = await db.lessonBlock.findFirst({
      where: {
        id: blockId,
        lessonId,
        lesson: {
          moduleId,
          module: {
            courseId,
            course: courseFilters,
          },
        },
      },
    })

    if (!block) {
      return new NextResponse('Lesson block not found', { status: 404 })
    }

    const body = await request.json()
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
    const rawName = typeof body.name === 'string' ? body.name.trim() : ''
    const rawType = typeof body.type === 'string' ? body.type.trim() : ''

    if (!rawUrl) {
      return new NextResponse('Attachment url is required', { status: 400 })
    }

    const attachment = await db.lessonBlockAttachment.create({
      data: {
        blockId,
        url: rawUrl,
        name: rawName || rawUrl.split('/').pop() || 'Attachment',
        type: rawType || null,
      },
    })

    await syncLegacyChapterForBlock(blockId)

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    logError('LESSON_BLOCK_ATTACHMENT_POST', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
