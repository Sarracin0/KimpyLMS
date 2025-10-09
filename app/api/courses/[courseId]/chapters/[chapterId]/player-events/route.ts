import { NextRequest, NextResponse } from 'next/server'
import { PlayerEventType } from '@prisma/client'

import { requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getChapterWithCourseContext } from '@/lib/video/chapter-access'

type RouteParams = Promise<{
  courseId: string
  chapterId: string
}>

const MAX_EVENTS_PER_REQUEST = 50
const VALID_EVENT_TYPES = new Set(Object.values(PlayerEventType))

type PlayerEventInput = {
  type: PlayerEventType
  playbackSecond?: number | null
  timestampMs?: number | null
}

function normalizeEvent(event: unknown): PlayerEventInput | null {
  if (!event || typeof event !== 'object') return null
  const raw = event as Record<string, unknown>
  const type = raw.type

  if (typeof type !== 'string' || !VALID_EVENT_TYPES.has(type as PlayerEventType)) {
    return null
  }

  const playbackSecond = Number(raw.playbackSecond)
  const timestampMs = Number(raw.timestampMs)

  return {
    type: type as PlayerEventType,
    playbackSecond: Number.isFinite(playbackSecond) && playbackSecond >= 0 ? Math.round(playbackSecond) : null,
    timestampMs: Number.isFinite(timestampMs) && timestampMs >= 0 ? Math.round(timestampMs) : null,
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

    const body = await request.json().catch(() => null)
    const rawEvents = (body && Array.isArray(body.events) ? body.events : []).slice(0, MAX_EVENTS_PER_REQUEST)

    if (rawEvents.length === 0) {
      return new NextResponse('No events provided', { status: 400 })
    }

    const events = rawEvents.map(normalizeEvent).filter((event): event is PlayerEventInput => event !== null)

    if (events.length === 0) {
      return new NextResponse('No valid events provided', { status: 400 })
    }

    await db.playerEvent.createMany({
      data: events.map((event) => ({
        chapterId,
        userProfileId: profile.id,
        type: event.type,
        playbackSecond: event.playbackSecond,
        timestampMs: event.timestampMs,
      })),
    })

    return NextResponse.json({ inserted: events.length })
  } catch (error) {
    logError('PLAYER_EVENTS_POST', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { courseId, chapterId } = await params
    const { company } = await requireAuthContext()

    const chapter = await getChapterWithCourseContext({
      chapterId,
      courseId,
      companyId: company.id,
    })

    if (!chapter) {
      return new NextResponse('Chapter not found', { status: 404 })
    }

    const heatmap = await db.playerEvent.groupBy({
      by: ['playbackSecond'],
      where: {
        chapterId,
        type: PlayerEventType.REWATCH,
        playbackSecond: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
    })

    return NextResponse.json({
      buckets: heatmap
        .filter((bucket) => bucket.playbackSecond !== null)
        .map((bucket) => ({
          second: bucket.playbackSecond as number,
          count: bucket._count._all,
        }))
        .sort((a, b) => a.second - b.second),
    })
  } catch (error) {
    logError('PLAYER_EVENTS_GET', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
