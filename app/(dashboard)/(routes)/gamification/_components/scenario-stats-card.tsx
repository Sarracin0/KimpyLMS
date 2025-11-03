'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ScenarioStats = {
  courseId: string
  courseTitle: string
  attemptCount: number
  avgScore: number
  avgRisk: number | null
  highRiskRate: number
  topCompetencies: Array<{ tag: string; count: number }>
}

type ScenarioMetrics = {
  attempts: number
  avgScore: number
  avgRisk: number | null
  highRiskRate: number
  topCompetencies: Array<{ tag: string; count: number }>
}

export function ScenarioStatsCard({
  scenarioStats,
  scenarioMetrics,
}: {
  scenarioStats: ScenarioStats[]
  scenarioMetrics: ScenarioMetrics
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Decision Labs overview</CardTitle>
          <p className="text-xs text-muted-foreground">
            Monitora performance e propensione al rischio negli scenari interattivi.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Tentativi</p>
              <p className="text-lg font-semibold">{scenarioMetrics.attempts}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Punteggio medio</p>
              <p className="text-lg font-semibold">{scenarioMetrics.avgScore}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Rischio medio</p>
              <p className="text-lg font-semibold">{scenarioMetrics.avgRisk !== null ? scenarioMetrics.avgRisk : '—'}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Scelte ad alto rischio</p>
              <p className="text-lg font-semibold">{scenarioMetrics.highRiskRate}%</p>
            </div>
          </div>
          {scenarioMetrics.topCompetencies.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Competenze principali</p>
              <div className="flex flex-wrap gap-2">
                {scenarioMetrics.topCompetencies.map(({ tag, count }) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag} · {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {scenarioStats.length > 0 && (
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
                  <TableHead>Rischio</TableHead>
                  <TableHead>High-risk</TableHead>
                  <TableHead>Focus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarioStats.map((entry) => (
                  <TableRow key={entry.courseId}>
                    <TableCell className="font-medium">{entry.courseTitle}</TableCell>
                    <TableCell>{entry.attemptCount}</TableCell>
                    <TableCell>{entry.avgScore}</TableCell>
                    <TableCell>{entry.avgRisk !== null ? entry.avgRisk : '—'}</TableCell>
                    <TableCell>{entry.highRiskRate}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.topCompetencies.length ? entry.topCompetencies.map(({ tag }) => tag).join(', ') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {scenarioStats.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nessun Decision Lab completato. Genera uno scenario dal builder per raccogliere insight comportamentali.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
