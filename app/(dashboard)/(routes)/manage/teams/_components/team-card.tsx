'use client'

import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { CompanyTeam, TeamMembership, UserProfile, TeamRole } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type TeamWithMembers = CompanyTeam & {
  memberships: (TeamMembership & {
    userProfile: Pick<UserProfile, 'id' | 'userId' | 'jobTitle' | 'role' | 'points'>
  })[]
}

type TeamCardProps = {
  team: TeamWithMembers
  availableMembers: Pick<UserProfile, 'id' | 'userId' | 'jobTitle' | 'role'>[]
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
      toast.success('Member added')
      setSelectedUser('')
      router.refresh()
    } catch {
      toast.error('Unable to add member right now')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onRemoveMember = async (userProfileId: string) => {
    try {
      setIsSubmitting(true)
      await axios.delete(`/api/teams/${team.id}/members/${userProfileId}`)
      toast.success('Member removed')
      router.refresh()
    } catch {
      toast.error('Unable to remove member')
    } finally {
      setIsSubmitting(false)
    }
  }

  const membersCount = team.memberships.length
  const totalPoints = team.memberships.reduce((acc, m) => acc + (m.userProfile.points ?? 0), 0)

  return (
    <Card className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/30">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{team.name}</h3>
          <p className="text-xs text-muted-foreground">{team.description ?? 'No description provided.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">{membersCount} members</Badge>
          <Badge className="text-[11px]" variant="secondary">{totalPoints} pts</Badge>
        </div>
      </div>

      <div className="grow space-y-2">
        {team.memberships.map((membership) => (
          <div key={membership.id} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm hover:border-primary/20">
            <div>
              <p className="font-medium text-foreground">{membership.userProfile.userId}</p>
              <p className="text-xs text-muted-foreground">{membership.userProfile.jobTitle ?? membership.userProfile.role}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={() => onRemoveMember(membership.userProfileId)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Remove ${membership.userProfile.userId} from ${team.name}`}
            >
              Remove
            </Button>
          </div>
        ))}
        {team.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-full focus-visible:ring-primary/40">
            <SelectValue placeholder={candidates.length ? 'Select a teammate' : 'Everyone is already assigned'} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.userId} – {member.jobTitle ?? member.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onAddMember} disabled={!selectedUser || isSubmitting} className="shrink-0">
          Add
        </Button>
      </div>
    </Card>
  )
}
