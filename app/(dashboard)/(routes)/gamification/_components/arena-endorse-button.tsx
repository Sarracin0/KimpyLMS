'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/button'

type ArenaEndorseButtonProps = {
  blockId: string
  attemptId: string
  alreadyEndorsed: boolean
  endorsementBonus: number
}

export const ArenaEndorseButton = ({ blockId, attemptId, alreadyEndorsed, endorsementBonus }: ArenaEndorseButtonProps) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (!blockId || !attemptId || alreadyEndorsed) return

    startTransition(async () => {
      try {
        const response = await fetch(`/api/arenas/${blockId}/attempts/${attemptId}/endorse`, {
          method: 'POST',
        })

        if (!response.ok) {
          const message = await response.text()
          throw new Error(message || 'Impossibile registrare endorsement')
        }

        toast.success(`Endorsement assegnato (+${endorsementBonus} tokens)`)
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Errore durante endorsement'
        toast.error(message)
      }
    })
  }

  return (
    <Button
      type="button"
      size="xs"
      variant="secondary"
      disabled={alreadyEndorsed || isPending}
      onClick={handleClick}
    >
      {alreadyEndorsed ? 'Endorsement registrato' : 'Concedi endorsement'}
    </Button>
  )
}
