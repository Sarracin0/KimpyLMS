'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArenaEndorseButton } from './arena-endorse-button'

type RecentArenaSummary = {
  id: string
  blockId: string
  courseTitle: string
  blockTitle: string
  createdAt: Date
  summary: string
  improvementAdvice: string
  scoreDelta: number | null
  tokens: number | null
  endorsements: Array<{ profileId?: string; name?: string }>
  endorsementBonus: number
  attemptOwnerId: string
}

type RecentReflection = {
  id: string
  courseTitle: string
  blockTitle: string
  createdAt: Date
  response: string
}

type BadgeAward = {
  id: string
  awardedAt: Date
  badge: { name: string }
  userProfile: { userId: string }
}

export function RecentActivityCard({
  recentArenaSummaries,
  recentReflections,
  badgeAwards,
  currentProfileId,
}: {
  recentArenaSummaries: RecentArenaSummary[]
  recentReflections: RecentReflection[]
  badgeAwards: BadgeAward[]
  currentProfileId: string
}) {
  return (
    <div className="space-y-6">
      {recentArenaSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ultime iterazioni Practice Arena</CardTitle>
            <p className="text-xs text-muted-foreground">Insight Tokens e miglioramenti più recenti.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentArenaSummaries.map((item) => {
              const alreadyEndorsed = item.endorsements.some((endorser) => endorser.profileId === currentProfileId)
              const endorsementCount = item.endorsements.length
              const canEndorse = Boolean(item.blockId)

              return (
                <div key={item.id} className="rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold">
                      {item.courseTitle} · {item.blockTitle}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        Δ {item.scoreDelta !== null ? item.scoreDelta : 0} · Tokens {item.tokens ?? 0}
                      </Badge>
                      {endorsementCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          Endorsement {endorsementCount}
                        </Badge>
                      )}
                      {canEndorse && (
                        <ArenaEndorseButton
                          blockId={item.blockId}
                          attemptId={item.id}
                          alreadyEndorsed={alreadyEndorsed}
                          endorsementBonus={item.endorsementBonus}
                        />
                      )}
                    </div>
                  </div>
                  {item.summary && <p className="mt-2 text-sm">{item.summary}</p>}
                  {item.improvementAdvice && (
                    <p className="mt-1 text-xs text-muted-foreground">Coach tip: {item.improvementAdvice}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat('it', { dateStyle: 'medium' }).format(item.createdAt)}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {recentReflections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent reflections</CardTitle>
            <p className="text-xs text-muted-foreground">Le risposte aperte aiutano a indirizzare il coaching individuale.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentReflections.map((item) => (
              <div key={item.id} className="rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <p className="mb-1 text-xs font-semibold">
                  {item.courseTitle} · {item.blockTitle}
                </p>
                <p className="text-sm">
                  "{item.response.length > 220 ? `${item.response.slice(0, 220)}…` : item.response}"
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat('it', { dateStyle: 'medium' }).format(item.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {badgeAwards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ultimi badge assegnati</CardTitle>
            <p className="text-xs text-muted-foreground">Gli ultimi 25 rilasci del tuo team.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {badgeAwards.map((award) => (
              <div
                key={award.id}
                className="flex flex-col gap-1 rounded-lg border border-border/40 bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{award.userProfile.userId}</p>
                  <p className="text-xs text-muted-foreground">{award.badge.name}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat('it', { dateStyle: 'medium', timeStyle: 'short' }).format(award.awardedAt)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {recentArenaSummaries.length === 0 && recentReflections.length === 0 && badgeAwards.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            Nessuna attività recente da visualizzare.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
