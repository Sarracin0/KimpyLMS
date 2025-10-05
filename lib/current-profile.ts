import { auth } from '@clerk/nextjs/server'
import { createClerkClient } from '@clerk/backend'
import { Prisma, UserRole } from '@prisma/client'

import { db } from './db'
import { slugify } from './utils'

export type AuthContext = {
  userId: string | null
  organizationId: string | null
  needsOrganization: boolean
  profile: Awaited<ReturnType<typeof db.userProfile.findUnique>>
  company: Awaited<ReturnType<typeof db.company.findUnique>>
}

type ClerkMembership = {
  organization: {
    id: string
    name: string
    slug: string | null
    imageUrl?: string | null
    publicMetadata?: Record<string, unknown>
  }
  role: string
}

const clerkRoleMap: Record<string, UserRole> = {
  admin: UserRole.HR_ADMIN,
  owner: UserRole.HR_ADMIN,
  manager: UserRole.TRAINER,
  basic_member: UserRole.LEARNER,
}

function mapClerkRoleToUserRole(role?: string | null): UserRole {
  if (!role) return UserRole.LEARNER
  return clerkRoleMap[role] ?? UserRole.TRAINER
}

function generateCompanySlug(base: string) {
  let slug = slugify(base)
  if (!slug) {
    slug = `company-${Math.random().toString(36).slice(2, 8)}`
  }
  return slug
}

async function ensureUniqueCompanySlug(initialSlug: string) {
  let candidate = initialSlug
  let counter = 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db.company.findUnique({ where: { slug: candidate } })
    if (!existing) return candidate
    candidate = `${initialSlug}-${counter}`
    counter += 1
  }
}

function getMembershipForOrganization(
  memberships: ClerkMembership[] | null | undefined,
  organizationId: string,
) {
  return memberships?.find((membership) => membership.organization.id === organizationId)
}

export async function getCurrentAuthContext() {
  const { userId, orgId } = await auth()

  if (!userId) {
    return {
      userId: null,
      organizationId: null,
      needsOrganization: false,
      profile: null,
      company: null,
    }
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to resolve the current user')
  }

  const clerk = createClerkClient({ secretKey })

  const user = await clerk.users.getUser(userId)
  const membershipsResponse = await clerk.users.getOrganizationMembershipList({ userId })
  const memberships = membershipsResponse.data as ClerkMembership[]

  const organizationId = orgId ?? memberships[0]?.organization?.id ?? null

  if (!organizationId) {
    return {
      userId,
      organizationId: null,
      needsOrganization: true,
      profile: null,
      company: null,
    }
  }

  const membership = getMembershipForOrganization(memberships, organizationId)

  const organizationName = membership?.organization?.name ?? 'Kimpy'
  const initialSlug = generateCompanySlug(membership?.organization?.slug ?? organizationName)

  let company = await db.company.findUnique({ where: { clerkOrgId: organizationId } })

  if (!company) {
    const ensuredSlug = await ensureUniqueCompanySlug(initialSlug)

    try {
      company = await db.company.create({
        data: {
          clerkOrgId: organizationId,
          name: organizationName,
          slug: ensuredSlug,
          domain: (membership?.organization?.publicMetadata?.domain as string | undefined) ?? null,
          logoUrl: membership?.organization?.imageUrl ?? null,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        company = await db.company.findUnique({ where: { clerkOrgId: organizationId } })

        if (!company) {
          throw new Error('Failed to resolve company after duplicate creation attempt')
        }
      } else {
        throw error
      }
    }
  } else {
    // ✅ FIX: Aggiorna i dati della company se sono cambiati in Clerk
    const companyUpdates: Record<string, unknown> = {}

    if (company.name !== organizationName) {
      companyUpdates.name = organizationName
    }

    if (membership?.organization?.imageUrl && company.logoUrl !== membership.organization.imageUrl) {
      companyUpdates.logoUrl = membership.organization.imageUrl
    }

    const currentDomain = (membership?.organization?.publicMetadata?.domain as string | undefined) ?? null
    if (company.domain !== currentDomain) {
      companyUpdates.domain = currentDomain
    }

    // Aggiorna solo se ci sono cambiamenti
    if (Object.keys(companyUpdates).length > 0) {
      company = await db.company.update({
        where: { id: company.id },
        data: companyUpdates,
      })
    }
  }

  let profile = await db.userProfile.findUnique({ where: { userId } })

  if (!profile) {
    try {
      profile = await db.userProfile.create({
        data: {
          userId,
          companyId: company.id,
          role: mapClerkRoleToUserRole(membership?.role),
          jobTitle: (user?.publicMetadata?.jobTitle as string | undefined) ?? null,
          department: (user?.publicMetadata?.department as string | undefined) ?? null,
          avatarUrl: user.imageUrl ?? null,
          timezone: (user?.publicMetadata?.timezone as string | undefined) ?? null,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        profile = await db.userProfile.findUnique({ where: { userId } })

        if (!profile) {
          throw new Error('Failed to resolve user profile after duplicate creation attempt')
        }
      } else {
        throw error
      }
    }
  } else {
    const updates: Record<string, unknown> = {}

    if (profile.companyId !== company.id) {
      updates.companyId = company.id
    }

    if (user.imageUrl && user.imageUrl !== profile.avatarUrl) {
      updates.avatarUrl = user.imageUrl
    }

    if (membership?.role === 'admin' && profile.role !== UserRole.HR_ADMIN) {
      updates.role = UserRole.HR_ADMIN
    }

    if (Object.keys(updates).length > 0) {
      profile = await db.userProfile.update({
        where: { id: profile.id },
        data: updates,
      })
    }
  }

  return {
    userId,
    organizationId,
    needsOrganization: false,
    profile,
    company,
  }
}

export async function requireAuthContext() {
  const context = await getCurrentAuthContext()

  if (!context.userId) {
    throw new Error('User not authenticated')
  }

  if (context.needsOrganization) {
    throw new Error('User is not attached to an organization')
  }

  if (!context.profile || !context.company) {
    throw new Error('Unable to resolve profile/company context')
  }

  return context as Required<typeof context>
}

type AllowedRole = UserRole | UserRole[]

export function assertRole(profile: { role: UserRole }, allowed: AllowedRole) {
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed]
  if (!allowedRoles.includes(profile.role)) {
    throw new Error('Insufficient permissions')
  }
}
