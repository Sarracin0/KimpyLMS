import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'

import { NewBadgeForm } from './_components/new-badge-form'
import { AwardBadgeForm } from './_components/award-badge-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge as Pill } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export default async function ManageBadgesPage() {
  const { company } = await requireAuthContext()

  const [badges, members] = await Promise.all([
    db.badge.findMany({
      where: { OR: [{ companyId: company.id }, { companyId: null }] },
      orderBy: { createdAt: 'desc' },
    }),
    db.userProfile.findMany({
      where: { companyId: company.id },
      select: { id: true, userId: true },
      orderBy: { userId: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6 p-6">
      {/* Header minimal ed elegante */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Badge Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea, organizza e assegna badge per valorizzare i risultati del tuo team.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="#catalogo">
            <Button variant="outline">Vai al catalogo</Button>
          </a>
          <a href="#crea-badge">
            <Button>Crea badge</Button>
          </a>
        </div>
      </div>

      {/* Sezione Creazione */}
      <div id="crea-badge">
        <NewBadgeForm />
      </div>

      {/* Catalogo */}
      <div id="catalogo" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {badges.map((badge) => (
          <Card key={badge.id} className="relative overflow-visible">
            {/* Icona/emoji sovrapposta (placeholder) */}
            <div className="absolute -top-4 -left-4 h-10 w-10 rounded-full bg-muted flex items-center justify-center shadow-sm">
              <span className="text-lg">🏆</span>
            </div>
            <CardHeader className="pl-10">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base leading-none">{badge.name}</CardTitle>
                <Pill variant="outline" className="px-2 py-0.5 text-[11px] font-medium">
                  {badge.pointsReward} pt
                </Pill>
              </div>
              <CardDescription className="mt-1">
                {badge.description || 'Nessuna descrizione.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-10 pt-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tipo: {badge.type}</span>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">Assegna</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assegna “{badge.name}”</DialogTitle>
                      </DialogHeader>
                      <AwardBadgeForm badgeId={badge.id} members={members} />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {badges.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Non ci sono ancora badge. Crea il primo badge qui sopra.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
