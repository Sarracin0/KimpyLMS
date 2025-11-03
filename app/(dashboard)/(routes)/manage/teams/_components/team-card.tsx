'use client'

import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { CompanyTeam, TeamMembership, UserProfile, TeamRole } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'

type MemberProfileWithName = Pick<UserProfile, 'id' | 'userId' | 'jobTitle' | 'role' | 'points'> & {
  displayName: string
}

type TeamWithMembers = CompanyTeam & {
  memberships: (TeamMembership & {
    userProfile: MemberProfileWithName
  })[]
}

type AvailableMember = Pick<UserProfile, 'id' | 'userId' | 'jobTitle' | 'role'> & {
  displayName: string
}

type TeamCardProps = {
  team: TeamWithMembers
  availableMembers: AvailableMember[]
}

export const TeamCard = ({ team, availableMembers }: TeamCardProps) => {
  const router = useRouter()
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentMemberIds = new Set(team.memberships.map((member) => member.userProfileId))
  const candidates = availableMembers.filter((member) => !currentMemberIds.has(member.id))

  const onAddMember = async () => {
    if (!selectedUser) return
    try {
      setIsSubmitting(true)
      await axios.post(`/api/teams/${team.id}/members`, {
        userProfileId: selectedUser,
        role: TeamRole.MEMBER,
      })
      toast.success('Membro aggiunto')
      setSelectedUser('')
      router.refresh()
    } catch {
      toast.error('Impossibile aggiungere il membro al momento')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onRemoveMember = async (userProfileId: string) => {
    try {
      setIsSubmitting(true)
      await axios.delete(`/api/teams/${team.id}/members/${userProfileId}`)
      toast.success('Membro rimosso')
      router.refresh()
    } catch {
      toast.error('Impossibile rimuovere il membro')
    } finally {
      setIsSubmitting(false)
    }
  }

  const membersCount = team.memberships.length
  const totalPoints = team.memberships.reduce((acc, m) => acc + (m.userProfile.points ?? 0), 0)
  const initials = useMemo(() => (team.name || '').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join(''), [team.name])

  return (
    <Card className="group flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/30">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/60 bg-muted/40 text-xs font-semibold text-foreground/80">
            {initials || 'T'}
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-semibold text-foreground transition group-hover:text-primary">{team.name}</h3>
            <p className="text-xs text-muted-foreground">{team.description ?? 'Nessuna descrizione.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">{membersCount} membri</Badge>
          <Badge className="text-[11px]" variant="secondary">{totalPoints} punti</Badge>
        </div>
      </div>

      <div className="grow space-y-2">
        {team.memberships.map((membership) => (
          <div key={membership.id} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm hover:border-primary/20">
            <div title={membership.userProfile.userId}>
              <p className="font-medium text-foreground">{membership.userProfile.displayName}</p>
              <p className="text-xs text-muted-foreground">{membership.userProfile.jobTitle ?? membership.userProfile.role}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={() => onRemoveMember(membership.userProfileId)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Rimuovi ${membership.userProfile.displayName} da ${team.name}`}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Rimuovi
            </Button>
          </div>
        ))}
        {team.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun membro.</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-full focus-visible:ring-primary/40">
            <SelectValue placeholder={candidates.length ? 'Seleziona un membro' : 'Tutti sono già assegnati'} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.displayName} – {member.jobTitle ?? member.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onAddMember} disabled={!selectedUser || isSubmitting} className="shrink-0">
          Aggiungi
        </Button>
      </div>
    </Card>
  )
}
