import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import type { ChapterCommentVisibility } from '@prisma/client'

import { requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getChapterWithCourseContext } from '@/lib/video/chapter-access'

type RouteParams = Promise<{
  courseId: string
  chapterId: string
}>

const MAX_COMMENT_LENGTH = 1200
const VISIBILITY_VALUES = ['PRIVATE', 'PUBLIC', 'HR_ONLY'] as const satisfies ChapterCommentVisibility[]
const VALID_VISIBILITY = new Set<string>(VISIBILITY_VALUES)

type CommentPayload = {
  content: string
  visibility: ChapterCommentVisibility
  playbackSecond?: number | null
}

function parsePayload(body: unknown): CommentPayload | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  const content = typeof raw.content === 'string' ? raw.content.trim() : ''
  const visibility = typeof raw.visibility === 'string' ? raw.visibility.toUpperCase() : ''
  const playbackSecond = Number(raw.playbackSecond)

  if (!content) return null
  if (content.length > MAX_COMMENT_LENGTH) return null
  if (!VALID_VISIBILITY.has(visibility as ChapterCommentVisibility)) return null

  return {
    content,
    visibility: visibility as ChapterCommentVisibility,
    playbackSecond: Number.isFinite(playbackSecond) && playbackSecond >= 0 ? Math.round(playbackSecond) : null,
  }
}

function buildVisibilityFilter(
  profileId: string,
  isHrAdmin: boolean,
): Record<string, unknown>[] {
  if (isHrAdmin) {
    return [
      { visibility: 'PUBLIC' },
      { visibility: 'PRIVATE', userProfileId: profileId },
      { visibility: 'HR_ONLY' },
    ]
  }

  return [
    { visibility: 'PUBLIC' },
    { visibility: 'PRIVATE', userProfileId: profileId },
    { visibility: 'HR_ONLY', userProfileId: profileId },
  ]
}

export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { courseId, chapterId } = await params
    const { profile, company } = await requireAuthContext()

    const chapter = await getChapterWithCourseContext({
      chapterId,
      courseId,
      companyId: company.id,
    })

    if (!chapter) {
      return new NextResponse('Chapter not found', { status: 404 })
    }

    const isHrAdmin = profile.role === UserRole.HR_ADMIN

    const comments = await db.chapterComment.findMany({
      where: {
        chapterId,
        deletedAt: null,
        OR: buildVisibilityFilter(profile.id, isHrAdmin),
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        content: true,
        visibility: true,
        playbackSecond: true,
        createdAt: true,
        userProfileId: true,
      },
    })

    return NextResponse.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        visibility: comment.visibility,
        playbackSecond: comment.playbackSecond,
        createdAt: comment.createdAt,
        authorId: comment.userProfileId,
        isMine: comment.userProfileId === profile.id,
      })),
    })
  } catch (error) {
    logError('CHAPTER_COMMENTS_GET', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { courseId, chapterId } = await params
    const { profile, company } = await requireAuthContext()

    const chapter = await getChapterWithCourseContext({
      chapterId,
      courseId,
      companyId: company.id,
    })

    if (!chapter) {
      return new NextResponse('Chapter not found', { status: 404 })
    }

    const payload = parsePayload(await request.json().catch(() => null))

    if (!payload) {
      return new NextResponse('Invalid payload', { status: 400 })
    }

    const comment = await db.chapterComment.create({
      data: {
        chapterId,
        userProfileId: profile.id,
        content: payload.content,
        visibility: payload.visibility,
        playbackSecond: payload.playbackSecond,
      },
      select: {
        id: true,
        content: true,
        visibility: true,
        playbackSecond: true,
        createdAt: true,
        userProfileId: true,
      },
    })

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        visibility: comment.visibility,
        playbackSecond: comment.playbackSecond,
        createdAt: comment.createdAt,
        authorId: comment.userProfileId,
        isMine: true,
      },
    }, { status: 201 })
  } catch (error) {
    logError('CHAPTER_COMMENTS_POST', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
