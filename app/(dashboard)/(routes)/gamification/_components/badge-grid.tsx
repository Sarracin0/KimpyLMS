'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type BadgeType = {
  id: string
  name: string
  description: string
  count: number
  lastAwardedAt: Date
}

export function BadgeGrid({ badges }: { badges: BadgeType[] }) {
  if (badges.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          Nessun badge assegnato finora.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Badge assegnati</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {badges.map((badge) => (
            <div key={badge.id} className="relative rounded-lg border border-border/50 bg-card/70 p-4">
              <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded-l-md bg-primary/60" />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{badge.description}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {badge.count}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Ultimo: {new Intl.DateTimeFormat('it', { dateStyle: 'medium' }).format(badge.lastAwardedAt)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
