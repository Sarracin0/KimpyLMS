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
    <div className="space-y-6 p-6 md:space-y-8 md:p-8">
      <div className="rounded-xl border border-primary/10 bg-primary/5 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Gestione team</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Crea team, assegna i membri e promuovi sfide di apprendimento collaborativo.
        </p>
      </div>

      <NewTeamForm availableMembers={members} />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} availableMembers={members} />
        ))}
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun team ancora. Crea il primo team qui sopra.</p>
      ) : null}
    </div>
  )
}
