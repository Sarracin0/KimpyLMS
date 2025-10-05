import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { logError } from '@/lib/logger'

import { db } from '@/lib/db'
import { assertRole, requireAuthContext } from '@/lib/current-profile'

export async function GET() {
  try {
    const { company } = await requireAuthContext()

    const teams = await db.companyTeam.findMany({
      where: { companyId: company.id },
      include: {
        memberships: {
          include: {
            userProfile: {
              select: {
                id: true,
                userId: true,
                jobTitle: true,
                role: true,
                avatarUrl: true,
                points: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(teams)
  } catch (error) {
    logError('TEAMS_GET', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile, company } = await requireAuthContext()
    assertRole(profile, UserRole.HR_ADMIN)

    const { name, description } = await request.json()

    if (!name) {
      return new NextResponse('Team name is required', { status: 400 })
    }

    const team = await db.companyTeam.create({
      data: {
        name,
        description,
        companyId: company.id,
        createdById: profile.id,
      },
    })

    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    logError('TEAMS_POST', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
