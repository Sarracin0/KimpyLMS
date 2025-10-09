'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ArenaStats = {
  courseId: string
  courseTitle: string
  attempts: number
  avgScore: number
  avgImprovement: number
  improvementRate: number
  iterationRate: number
  totalTokens: number
}

type ArenaMetrics = {
  attempts: number
  avgScore: number
  avgImprovement: number
  improvementRate: number
  iterationRate: number
  totalTokens: number
}

export function ArenaStatsCard({
  arenaStats,
  arenaMetrics,
}: {
  arenaStats: ArenaStats[]
  arenaMetrics: ArenaMetrics
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Practice Arena overview</CardTitle>
          <p className="text-xs text-muted-foreground">Analizza iterazioni, coaching e Insight Tokens generati.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Tentativi</p>
              <p className="text-lg font-semibold">{arenaMetrics.attempts}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Punteggio medio</p>
              <p className="text-lg font-semibold">{arenaMetrics.avgScore}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Miglioramento medio</p>
              <p className="text-lg font-semibold">{arenaMetrics.avgImprovement}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Iterazioni multi-tentativo</p>
              <p className="text-lg font-semibold">{arenaMetrics.iterationRate}%</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Insight Tokens</p>
              <p className="text-lg font-semibold">{arenaMetrics.totalTokens}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {arenaStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance per corso</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corso</TableHead>
                  <TableHead>Tentativi</TableHead>
                  <TableHead>Punteggio</TableHead>
                  <TableHead>Miglioramento</TableHead>
                  <TableHead>Iteration rate</TableHead>
                  <TableHead>Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arenaStats.map((entry) => (
                  <TableRow key={entry.courseId}>
                    <TableCell className="font-medium">{entry.courseTitle}</TableCell>
                    <TableCell>{entry.attempts}</TableCell>
                    <TableCell>{entry.avgScore}</TableCell>
                    <TableCell>{entry.avgImprovement}</TableCell>
                    <TableCell>{entry.iterationRate}%</TableCell>
                    <TableCell>{entry.totalTokens}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {arenaStats.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nessuna Practice Arena ancora attiva. Aggiungi il blocco dal course builder per avviare le iterazioni guidate.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
