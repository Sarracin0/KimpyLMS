import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ChapterCoachMessageRole, PlayerEventType } from '@prisma/client'

import { requireAuthContext } from '@/lib/current-profile'
import { db } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getOpenAIClient } from '@/lib/openai/client'
import { getChapterWithCourseContext } from '@/lib/video/chapter-access'

type RouteParams = Promise<{
  courseId: string
  chapterId: string
}>

type CoachPayload = {
  message: string
  sessionId?: string
  playbackSecond?: number | null
}

const MAX_MESSAGE_LENGTH = 800
const HISTORY_LIMIT = 10

function parsePayload(body: unknown): CoachPayload | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  const message = typeof raw.message === 'string' ? raw.message.trim() : ''
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return null
  }

  const sessionId = typeof raw.sessionId === 'string' && raw.sessionId.trim().length > 0 ? raw.sessionId.trim() : undefined
  const playbackSecondRaw = raw.playbackSecond
  const playbackSecond = Number(playbackSecondRaw)

  return {
    message,
    sessionId,
    playbackSecond: Number.isFinite(playbackSecond) && playbackSecond >= 0 ? Math.round(playbackSecond) : null,
  }
}

function formatSeconds(second?: number | null) {
  if (typeof second !== 'number' || !Number.isFinite(second) || second < 0) return null
  const minutes = Math.floor(second / 60)
  const seconds = Math.floor(second % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

type OpenAIResponse = Awaited<ReturnType<ReturnType<typeof getOpenAIClient>['responses']['create']>>

function extractAssistantText(response: OpenAIResponse): string | null {
  if (!response) return null
  const fragments: string[] = []

  for (const item of response.output ?? []) {
    if (item.type === 'message') {
      for (const content of item.content ?? []) {
        if (content.type === 'output_text') {
          fragments.push(content.text)
        } else if ('text' in content && typeof content.text === 'string') {
          fragments.push(content.text)
        }
      }
    } else if (item.type === 'output_text') {
      fragments.push(item.text)
    }
  }

  const text = fragments.join('').trim()
  return text.length > 0 ? text : null
}

export async function POST(request: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { courseId, chapterId } = await params
    const { profile, company } = await requireAuthContext()

    const payload = parsePayload(await request.json().catch(() => null))

    if (!payload) {
      return new NextResponse('Invalid payload', { status: 400 })
    }

    const chapter = await getChapterWithCourseContext({
      chapterId,
      courseId,
      companyId: company.id,
    })

    if (!chapter) {
      return new NextResponse('Chapter not found', { status: 404 })
    }

    const sessionId = payload.sessionId ?? randomUUID()

    const historyRecords = await db.chapterCoachMessage.findMany({
      where: {
        chapterId,
        userProfileId: profile.id,
        sessionId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: HISTORY_LIMIT,
    })

    const history = historyRecords.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    const formattedTimestamp = formatSeconds(payload.playbackSecond)

    const contextLines = [
      `Corso: ${chapter.course.title}`,
      `Capitolo: ${chapter.title}`,
    ]

    if (formattedTimestamp) {
      contextLines.push(`Timestamp video: ${formattedTimestamp}`)
    }

    if (chapter.description) {
      contextLines.push(`Descrizione del capitolo: ${chapter.description}`)
    }

    const systemPrompt = `Sei Coach AI, un tutor empatico che aiuta i dipendenti HR e Learner a comprendere il contenuto del capitolo senza inventare informazioni. Rispondi in modo conciso (max 4 frasi), proponi esempi concreti e, quando opportuno, suggerisci azioni pratiche.`

    const userPrompt = [contextLines.join('\n'), '', 'Domanda utente:', payload.message].join('\n')

    const client = getOpenAIClient()
    const model = process.env.OPENAI_COACH_MODEL || 'gpt-4.1-mini'

    const inputMessages = [
      {
        role: 'system' as const,
        content: [{ type: 'input_text' as const, text: systemPrompt }],
      },
      ...history.map((message) => ({
        role: message.role === ChapterCoachMessageRole.USER ? ('user' as const) : ('assistant' as const),
        content: [{ type: 'input_text' as const, text: message.content }],
      })),
      {
        role: 'user' as const,
        content: [{ type: 'input_text' as const, text: userPrompt }],
      },
    ]

    const userMessage = await db.chapterCoachMessage.create({
      data: {
        chapterId,
        userProfileId: profile.id,
        sessionId,
        role: ChapterCoachMessageRole.USER,
        content: payload.message,
        playbackSecond: payload.playbackSecond,
      },
      select: {
        id: true,
        createdAt: true,
      },
    })

    const response = await client.responses.create({
      model,
      temperature: 0.4,
      top_p: 0.9,
      input: inputMessages,
    })

    const text = extractAssistantText(response)

    if (!text) {
      logError('COACH_EMPTY_RESPONSE', response)
      return new NextResponse('Unable to generate response', { status: 502 })
    }

    const assistantMessage = await db.chapterCoachMessage.create({
      data: {
        chapterId,
        userProfileId: profile.id,
        sessionId,
        role: ChapterCoachMessageRole.AI,
        content: text,
        playbackSecond: payload.playbackSecond,
        metadata: {
          model,
        },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    })

    await db.playerEvent.create({
      data: {
        chapterId,
        userProfileId: profile.id,
        type: PlayerEventType.COACH_PROMPT,
        playbackSecond: payload.playbackSecond,
      },
    })

    return NextResponse.json({
      sessionId,
      message: {
        id: assistantMessage.id,
        role: 'assistant',
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
      acknowledged: {
        id: userMessage.id,
        createdAt: userMessage.createdAt,
      },
    })
  } catch (error) {
    logError('COACH_ROUTE_POST', error)
    if (error instanceof Error && 'status' in error) {
      const status = Number((error as { status?: number }).status)
      if (Number.isFinite(status) && status >= 400) {
        return new NextResponse('AI service error', { status })
      }
    }
    return new NextResponse('Internal server error', { status: 500 })
  }
}
