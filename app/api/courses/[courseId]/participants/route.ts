import { NextRequest, NextResponse } from 'next/server'
import { CourseEnrollmentSource, UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'
import { buildUserDisplayNameMap, deriveDisplayNameFromIdentifier } from '@/lib/display-name'

// GET - Ottieni tutti i partecipanti del corso
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const { profile, company } = await requireAuthContext()

    // Verifica che l'utente sia HR_ADMIN o il creatore del corso
    const course = await db.course.findFirst({
      where: {
        id: courseId,
        companyId: company.id,
        ...(profile.role !== UserRole.HR_ADMIN && { createdByProfileId: profile.id }),
      },
    })

    if (!course) {
      return NextResponse.json({ error: 'Corso non trovato o accesso negato' }, { status: 404 })
    }

    // Ottieni tutti i partecipanti del corso con il progresso
    const enrollments = await db.courseEnrollment.findMany({
      where: { courseId },
      include: {
        userProfile: {
          select: {
            id: true,
            userId: true,
            role: true,
            jobTitle: true,
            department: true,
            avatarUrl: true,
            points: true,
            streakCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const userIdSet = new Set(enrollments.map((enrollment) => enrollment.userProfile.userId))
    const displayNameMap =
      userIdSet.size > 0 ? await buildUserDisplayNameMap(userIdSet) : new Map<string, string>()

    // Calcola il progresso per ogni partecipante
    const enrollmentsWithProgress = await Promise.all(
      enrollments.map(async (enrollment) => {
        // Ottieni tutti i capitoli pubblicati del corso
        const publishedChapters = await db.chapter.findMany({
          where: {
            courseId,
            isPublished: true,
          },
          select: { id: true },
        })

        // Ottieni i capitoli completati dall'utente
         const completedChapters = await db.userProgress.findMany({
           where: {
             userProfileId: enrollment.userProfile.id,
             chapterId: { in: publishedChapters.map(chapter => chapter.id) },
             isCompleted: true,
           },
           select: { chapterId: true },
         })

        const progressPercentage = publishedChapters.length > 0 
          ? Math.round((completedChapters.length / publishedChapters.length) * 100)
          : 0

        return {
          ...enrollment,
          userProfile: {
            ...enrollment.userProfile,
            displayName:
              displayNameMap.get(enrollment.userProfile.userId) ??
              deriveDisplayNameFromIdentifier(enrollment.userProfile.userId, 'Utente'),
          },
          progress: {
            completedChapters: completedChapters.length,
            totalChapters: publishedChapters.length,
            percentage: progressPercentage,
          },
        }
      })
    )

    return NextResponse.json({ enrollments: enrollmentsWithProgress })
  } catch (error) {
    console.error('[COURSE_PARTICIPANTS_GET]', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// POST - Aggiungi partecipanti al corso
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const { profile, company } = await requireAuthContext()
    const { userProfileIds, dueDate } = await req.json()

    // Verifica che l'utente sia HR_ADMIN o il creatore del corso
    const course = await db.course.findFirst({
      where: {
        id: courseId,
        companyId: company.id,
        ...(profile.role !== UserRole.HR_ADMIN && { createdByProfileId: profile.id }),
      },
    })

    if (!course) {
      return NextResponse.json({ error: 'Corso non trovato o accesso negato' }, { status: 404 })
    }

    if (!userProfileIds || !Array.isArray(userProfileIds) || userProfileIds.length === 0) {
      return NextResponse.json({ error: 'Lista di utenti non valida' }, { status: 400 })
    }

    // Verifica che tutti gli utenti appartengano alla stessa company
    const validUsers = await db.userProfile.findMany({
      where: {
        id: { in: userProfileIds },
        companyId: company.id,
      },
    })

    if (validUsers.length !== userProfileIds.length) {
      return NextResponse.json({ error: 'Alcuni utenti non sono validi' }, { status: 400 })
    }

    // Ottieni le iscrizioni esistenti per evitare duplicati
    const existingEnrollments = await db.courseEnrollment.findMany({
      where: {
        courseId,
        userProfileId: { in: userProfileIds },
      },
      select: { userProfileId: true },
    })

    const existingUserIds = existingEnrollments.map(e => e.userProfileId)
    const newUserIds = userProfileIds.filter(id => !existingUserIds.includes(id))

    if (newUserIds.length === 0) {
      return NextResponse.json({ 
        message: 'Tutti gli utenti selezionati sono già iscritti al corso',
        added: 0,
        skipped: existingUserIds.length 
      })
    }

    // Crea le nuove iscrizioni
    const enrollmentData = newUserIds.map(userProfileId => ({
      courseId,
      userProfileId,
      assignedById: profile.id,
      source: CourseEnrollmentSource.MANUAL,
      dueDate: dueDate ? new Date(dueDate) : null,
    }))

    await db.courseEnrollment.createMany({
      data: enrollmentData,
    })

    return NextResponse.json({
      message: `${newUserIds.length} partecipanti aggiunti con successo`,
      added: newUserIds.length,
      skipped: existingUserIds.length,
    })
  } catch (error) {
    console.error('[COURSE_PARTICIPANTS_POST]', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// DELETE - Rimuovi partecipanti dal corso
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const { profile, company } = await requireAuthContext()
    const { userProfileIds } = await req.json()

    // Verifica che l'utente sia HR_ADMIN o il creatore del corso
    const course = await db.course.findFirst({
      where: {
        id: courseId,
        companyId: company.id,
        ...(profile.role !== UserRole.HR_ADMIN && { createdByProfileId: profile.id }),
      },
    })

    if (!course) {
      return NextResponse.json({ error: 'Corso non trovato o accesso negato' }, { status: 404 })
    }

    if (!userProfileIds || !Array.isArray(userProfileIds) || userProfileIds.length === 0) {
      return NextResponse.json({ error: 'Lista di utenti non valida' }, { status: 400 })
    }

    // Rimuovi le iscrizioni
    const result = await db.courseEnrollment.deleteMany({
      where: {
        courseId,
        userProfileId: { in: userProfileIds },
      },
    })

    return NextResponse.json({
      message: `${result.count} partecipanti rimossi con successo`,
      removed: result.count,
    })
  } catch (error) {
    console.error('[COURSE_PARTICIPANTS_DELETE]', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
