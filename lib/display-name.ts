import type { User } from '@clerk/backend'
import { createClerkClient } from '@clerk/backend'

const DEFAULT_NAME = 'Utente'

export function deriveDisplayNameFromIdentifier(identifier: string | null | undefined, fallback = DEFAULT_NAME) {
  if (!identifier) return fallback

  const trimmed = identifier.trim()
  if (!trimmed) return fallback

  if (trimmed.includes('@')) {
    const [handle] = trimmed.split('@')
    if (handle) return handle
  }

  if (trimmed.includes('_')) {
    const parts = trimmed.split('_')
    const candidate = parts[parts.length - 1]?.trim()
    if (candidate && candidate.length > 0 && candidate.length <= 16) {
      return candidate
    }
  }

  if (trimmed.length <= 16) {
    return trimmed
  }

  return fallback
}

export function deriveDisplayNameFromClerkUser(user: User | null | undefined, fallback = DEFAULT_NAME) {
  if (!user) return fallback

  const fullName = user.fullName?.trim()
  if (fullName) return fullName

  const joined = [user.firstName, user.lastName].filter((part): part is string => Boolean(part && part.trim())).join(' ')
  if (joined) return joined

  if (user.username) {
    return user.username
  }

  const email =
    user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null
  if (email) {
    const [handle] = email.split('@')
    if (handle) return handle
  }

  return deriveDisplayNameFromIdentifier(user.id, fallback)
}

export async function buildUserDisplayNameMap(userIds: Iterable<string>) {
  const ids = Array.from(new Set(Array.from(userIds).filter((id): id is string => Boolean(id))))
  const displayNameMap = new Map<string, string>()

  if (ids.length === 0) {
    return displayNameMap
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to resolve user display names')
  }

  const clerk = createClerkClient({ secretKey })

  await Promise.all(
    ids.map(async (id) => {
      try {
        const user = await clerk.users.getUser(id)
        const displayName = deriveDisplayNameFromClerkUser(
          user,
          deriveDisplayNameFromIdentifier(id, DEFAULT_NAME),
        )
        displayNameMap.set(id, displayName)
      } catch {
        displayNameMap.set(id, deriveDisplayNameFromIdentifier(id, DEFAULT_NAME))
      }
    }),
  )

  return displayNameMap
}
