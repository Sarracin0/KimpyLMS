'use client'

import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type AwardBadgeFormProps = {
  badgeId: string
  members: { id: string; userId: string }[]
}

export const AwardBadgeForm = ({ badgeId, members }: AwardBadgeFormProps) => {
  const router = useRouter()
  const [selectedMember, setSelectedMember] = useState('')
  const [context, setContext] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async () => {
    if (!selectedMember) return
    try {
      setIsSubmitting(true)
      await axios.post(`/api/badges/${badgeId}/award`, {
        userProfileId: selectedMember,
        context,
      })
      toast.success('Badge assegnato')
      setSelectedMember('')
      setContext('')
      router.refresh()
    } catch {
      toast.error('Impossibile assegnare il badge')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <Select value={selectedMember} onValueChange={setSelectedMember} disabled={isSubmitting}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Seleziona un utente" />
        </SelectTrigger>
        <SelectContent>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.userId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        value={context}
        onChange={(event) => setContext(event.target.value)}
        rows={3}
        placeholder="Perché assegni questo badge?"
        disabled={isSubmitting}
      />
      <Button onClick={onSubmit} disabled={!selectedMember || isSubmitting}>
        Assegna badge
      </Button>
    </div>
  )
}
