import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'

import { NewTeamForm } from './_components/new-team-form'
import { TeamCard } from './_components/team-card'

export default async function ManageTeamsPage() {
  const { company } = await requireAuthContext()

  const [teams, members] = await Promise.all([
    db.companyTeam.findMany({
      where: { companyId: company.id },
      include: {
        memberships: {
          include: {
            userProfile: {
              select: { id: true, userId: true, jobTitle: true, role: true, points: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.userProfile.findMany({
      where: { companyId: company.id },
      select: { id: true, userId: true, jobTitle: true, role: true },
      orderBy: { userId: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Team management</h1>
        <p className="text-sm text-muted-foreground">
          Create teams, assign members, and encourage collaborative learning challenges.
        </p>
      </div>

      <NewTeamForm availableMembers={members} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} availableMembers={members} />
        ))}
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">No teams yet. Start by creating your first team above.</p>
      ) : null}
    </div>
  )
}
