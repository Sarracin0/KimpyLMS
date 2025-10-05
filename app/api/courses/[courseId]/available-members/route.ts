import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'

import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'

// GET - Ottieni tutti i membri dell'organizzazione disponibili per l'iscrizione al corso
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

    // Ottieni tutti i membri dell'organizzazione, includendo i team a cui appartengono
    const allMembers = await db.userProfile.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        userId: true,
        role: true,
        jobTitle: true,
        department: true,
        avatarUrl: true,
        points: true,
        streakCount: true,
        memberships: {
          select: {
            team: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { jobTitle: 'asc' },
      ],
    })

    // Ottieni gli utenti già iscritti al corso
    const enrolledMembers = await db.courseEnrollment.findMany({
      where: { courseId },
      select: { userProfileId: true },
    })

    const enrolledUserIds = enrolledMembers.map((e) => e.userProfileId)

    // Filtra i membri disponibili (non ancora iscritti)
    const availableMembersRaw = allMembers.filter((member) => !enrolledUserIds.includes(member.id))

    // Mappa per includere i team come array semplice { id, name }
    const availableMembers = availableMembersRaw.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      jobTitle: m.jobTitle,
      department: m.department,
      avatarUrl: m.avatarUrl,
      points: m.points,
      streakCount: m.streakCount,
      teams: m.memberships.map((mm) => mm.team),
    }))

    // Raggruppa per ruolo per una migliore organizzazione
    const membersByRole = {
      HR_ADMIN: availableMembers.filter((m) => m.role === UserRole.HR_ADMIN),
      TRAINER: availableMembers.filter((m) => m.role === UserRole.TRAINER),
      LEARNER: availableMembers.filter((m) => m.role === UserRole.LEARNER),
    }

    return NextResponse.json({
      availableMembers,
      membersByRole,
      totalAvailable: availableMembers.length,
      totalEnrolled: enrolledUserIds.length,
      totalMembers: allMembers.length,
    })
  } catch (error) {
    console.error('[COURSE_AVAILABLE_MEMBERS_GET]', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
