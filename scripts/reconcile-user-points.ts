import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SumRow = { userProfileId: string; _sum: Record<string, number | null | undefined> }

const normalizeSum = (value: number | null | undefined) => (typeof value === 'number' ? value : 0)

async function main() {
  console.log('🔄 Reconciling user points with leaderboard totals...')

  const [profiles, legacy, lessons, achievements, ledger] = await Promise.all([
    prisma.userProfile.findMany({ select: { id: true, points: true } }),
    prisma.userProgress.groupBy({ by: ['userProfileId'], _sum: { pointsAwarded: true } }),
    prisma.userLessonProgress.groupBy({ by: ['userProfileId'], _sum: { pointsAwarded: true } }),
    prisma.userCourseAchievement.groupBy({ by: ['userProfileId'], _sum: { pointsAwarded: true } }),
    prisma.userPoints.groupBy({ by: ['userProfileId'], _sum: { delta: true } }),
  ])

  const scoreboardTotals = new Map<string, number>()
  const ledgerTotals = new Map<string, number>()

  const collect = (map: Map<string, number>, rows: SumRow[], field: 'pointsAwarded' | 'delta') => {
    for (const row of rows) {
      const current = map.get(row.userProfileId) ?? 0
      map.set(row.userProfileId, current + normalizeSum(row._sum[field] ?? null))
    }
  }

  collect(scoreboardTotals, legacy as SumRow[], 'pointsAwarded')
  collect(scoreboardTotals, lessons as SumRow[], 'pointsAwarded')
  collect(scoreboardTotals, achievements as SumRow[], 'pointsAwarded')
  collect(ledgerTotals, ledger as SumRow[], 'delta')

  const updates: Array<{ id: string; target: number; current: number }> = []

  for (const profile of profiles) {
    const scoreboardTotal = scoreboardTotals.get(profile.id) ?? 0
    const ledgerTotal = ledgerTotals.get(profile.id) ?? 0
    const target = Math.max(scoreboardTotal, ledgerTotal, 0)

    if (profile.points !== target) {
      updates.push({ id: profile.id, target, current: profile.points })
    }
  }

  if (updates.length === 0) {
    console.log('✅ All user profiles already have coherent totals. Nothing to do.')
    return
  }

  console.log(`📊 Found ${updates.length} profiles to update out of ${profiles.length}`)

  const BATCH_SIZE = 100
  let processed = 0

  for (let index = 0; index < updates.length; index += BATCH_SIZE) {
    const batch = updates.slice(index, index + BATCH_SIZE)
    await prisma.$transaction(
      batch.map((entry) =>
        prisma.userProfile.update({ where: { id: entry.id }, data: { points: entry.target } })
      )
    )
    processed += batch.length
    console.log(`  ➤ Updated ${processed}/${updates.length} profiles...`)
  }

  const increases = updates.filter((item) => item.target > item.current).length
  const decreases = updates.length - increases

  console.log('🎯 Reconciliation completed:')
  console.log(`   • Profiles increased: ${increases}`)
  console.log(`   • Profiles decreased: ${decreases}`)
  console.log(`   • Total processed: ${updates.length}`)
}

main()
  .catch((error) => {
    console.error('❌ Failed to reconcile user points', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
