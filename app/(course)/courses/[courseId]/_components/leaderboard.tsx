import Image from 'next/image'
import { Trophy } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { getCourseLeaderboard } from '@/actions/get-course-leaderboard'

export default async function CourseLeaderboard({
  courseId,
  currentUserProfileId,
  limit = 5,
}: {
  courseId: string
  currentUserProfileId: string
  limit?: number
}) {
  const entries = await getCourseLeaderboard(courseId)
  if (entries.length === 0) return null

  const top = entries.slice(0, limit)
  const meIndex = entries.findIndex((e) => e.userProfileId === currentUserProfileId)
  const me = meIndex >= 0 ? { rank: meIndex + 1, ...entries[meIndex] } : null

  return (
    <Card className="mx-auto mb-4 max-w-4xl border-[#5D62E1]/20 bg-white/60 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-[#5D62E1]" />
            <span>Leaderboard del corso</span>
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">Top {limit}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {top.map((e, idx) => {
            const isMe = e.userProfileId === currentUserProfileId
            return (
              <div
                key={e.userProfileId}
                className={`group relative flex items-center gap-3 rounded-full border border-white/30 bg-white/50 px-3 py-1.5 text-xs text-foreground backdrop-blur-md supports-[backdrop-filter]:bg-white/40 ${isMe ? 'ring-2 ring-[#5D62E1]/40' : ''}`}
              >
                <span className="flex h-6 items-center rounded-full bg-[#5D62E1] px-2 font-semibold text-white">#{idx + 1}</span>
                {e.avatarUrl ? (
                  <Image src={e.avatarUrl} alt="avatar" width={24} height={24} className="h-6 w-6 rounded-full" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted" />
                )}
                <span className="font-semibold text-[#5D62E1]">{e.points} pts</span>
              </div>
            )
          })}
        </div>

        {me ? (
          me.rank > limit ? (
            <div className="flex items-center justify-between rounded-lg border border-white/20 bg-white/40 px-3 py-2 text-xs text-foreground backdrop-blur-md supports-[backdrop-filter]:bg-white/30">
              <span className="text-muted-foreground">Tu sei</span>
              <span className="rounded-full bg-[#5D62E1] px-2 py-0.5 font-semibold text-white">#{me.rank}</span>
              <span className="font-semibold text-[#5D62E1]">{me.points} pts</span>
            </div>
          ) : null
        ) : null}
      </CardContent>
    </Card>
  )
}
