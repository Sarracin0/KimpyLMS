'use client'

import { Award, BarChart3, GitBranch, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { BadgeGrid } from './badge-grid'
import { TopPerformersCard } from './top-performers-card'
import { QuizStatsCard } from './quiz-stats-card'
import { ScenarioStatsCard } from './scenario-stats-card'
import { ArenaStatsCard } from './arena-stats-card'
import { RecentActivityCard } from './recent-activity-card'

type Badge = {
  id: string
  name: string
  description: string
  count: number
  lastAwardedAt: Date
}

type TopProfile = {
  id: string
  userId: string
  points: number
  jobTitle?: string | null
  department?: string | null
}

type CourseStats = {
  courseId: string
  courseTitle: string
  quizCount: number
  totalAttempts: number
  averageScore: number
  passRate: number
  learners: number
}

type ScenarioStats = {
  courseId: string
  courseTitle: string
  attemptCount: number
  avgScore: number
  avgRisk: number | null
  highRiskRate: number
  topCompetencies: Array<{ tag: string; count: number }>
}

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

type ScenarioMetrics = {
  attempts: number
  avgScore: number
  avgRisk: number | null
  highRiskRate: number
  topCompetencies: Array<{ tag: string; count: number }>
}

type ArenaMetrics = {
  attempts: number
  avgScore: number
  avgImprovement: number
  improvementRate: number
  iterationRate: number
  totalTokens: number
}

type BadgeAward = {
  id: string
  awardedAt: Date
  badge: { name: string }
  userProfile: { userId: string }
}

export type GamificationClientProps = {
  badges: Badge[]
  courseStats: CourseStats[]
  topProfiles: TopProfile[]
  scenarioStats: ScenarioStats[]
  scenarioMetrics: ScenarioMetrics
  arenaStats: ArenaStats[]
  arenaMetrics: ArenaMetrics
  recentArenaSummaries: RecentArenaSummary[]
  recentReflections: RecentReflection[]
  badgeAwards: BadgeAward[]
  currentProfileId: string
}

export function GamificationClient({
  badges,
  courseStats,
  topProfiles,
  scenarioStats,
  scenarioMetrics,
  arenaStats,
  arenaMetrics,
  recentArenaSummaries,
  recentReflections,
  badgeAwards,
  currentProfileId,
}: GamificationClientProps) {
  const totalBadgesAwarded = badges.reduce((sum, b) => sum + b.count, 0)
  const totalQuizAttempts = courseStats.reduce((sum, c) => sum + c.totalAttempts, 0)
  const totalScenarioAttempts = scenarioMetrics.attempts + arenaMetrics.attempts
  const totalPointsDistributed = topProfiles.reduce((sum, p) => sum + p.points, 0)

  return (
    <div className="space-y-6 p-6 md:space-y-8 md:p-8">
      <header className="rounded-xl border border-primary/10 bg-primary/5 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Gamification Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Monitora badge, performance quiz, decision labs e practice arena per capire l'engagement del team.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="transition hover:border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Badge assegnati</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBadgesAwarded}</div>
            <p className="text-xs text-muted-foreground">{badges.length} tipi di badge attivi</p>
          </CardContent>
        </Card>

        <Card className="transition hover:border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tentativi quiz</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuizAttempts}</div>
            <p className="text-xs text-muted-foreground">{courseStats.length} corsi con quiz</p>
          </CardContent>
        </Card>

        <Card className="transition hover:border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scenario completati</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalScenarioAttempts}</div>
            <p className="text-xs text-muted-foreground">
              {scenarioMetrics.attempts} labs + {arenaMetrics.attempts} arena
            </p>
          </CardContent>
        </Card>

        <Card className="transition hover:border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Punti totali</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPointsDistributed}</div>
            <p className="text-xs text-muted-foreground">{topProfiles.length} top performer</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
          <TabsTrigger value="labs">Decision Labs</TabsTrigger>
          <TabsTrigger value="arena">Practice Arena</TabsTrigger>
          <TabsTrigger value="activity">Attività recenti</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BadgeGrid badges={badges} />
            </div>
            <TopPerformersCard topProfiles={topProfiles} />
          </div>
        </TabsContent>

        <TabsContent value="quiz" className="space-y-6">
          <QuizStatsCard courseStats={courseStats} />
        </TabsContent>

        <TabsContent value="labs" className="space-y-6">
          <ScenarioStatsCard scenarioStats={scenarioStats} scenarioMetrics={scenarioMetrics} />
        </TabsContent>

        <TabsContent value="arena" className="space-y-6">
          <ArenaStatsCard arenaStats={arenaStats} arenaMetrics={arenaMetrics} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <RecentActivityCard
            recentArenaSummaries={recentArenaSummaries}
            recentReflections={recentReflections}
            badgeAwards={badgeAwards}
            currentProfileId={currentProfileId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
