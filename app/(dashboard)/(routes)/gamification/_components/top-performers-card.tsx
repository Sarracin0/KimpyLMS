'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

type TopProfile = {
  id: string
  userId: string
  displayName: string
  points: number
  jobTitle?: string | null
  department?: string | null
}

export function TopPerformersCard({ topProfiles }: { topProfiles: TopProfile[] }) {
  if (topProfiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top performer</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nessun partecipante con punti registrati.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top performer per punti</CardTitle>
        <p className="text-xs text-muted-foreground">Aggiornato in tempo reale.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {topProfiles.map((user, index) => (
          <div key={user.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/70 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {index === 0 ? <Trophy className="h-4 w-4 text-yellow-600" /> : index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.jobTitle ?? '—'} · {user.department ?? '—'}
              </p>
            </div>
            <div className="text-sm font-semibold">{user.points} pt</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
