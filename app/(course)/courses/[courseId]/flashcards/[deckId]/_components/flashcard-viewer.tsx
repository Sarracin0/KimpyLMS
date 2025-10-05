'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export type FlashcardViewerCard = {
  id: string
  front: string
  back: string
  points: number
}

type FlashcardViewerProps = {
  deck: {
    title: string
    description: string | null
    cards: FlashcardViewerCard[]
  }
  deckId: string
}

export function FlashcardViewer({ deck, deckId }: FlashcardViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [markedComplete, setMarkedComplete] = useState(false)

  const cards = deck.cards
  const currentCard = cards[activeIndex]

  const handleFlip = () => {
    setShowBack((value) => !value)
  }

  const handlePrev = () => {
    setActiveIndex((index) => (index === 0 ? cards.length - 1 : index - 1))
    setShowBack(false)
  }

  const handleNext = () => {
    setActiveIndex((index) => (index === cards.length - 1 ? 0 : index + 1))
    setShowBack(false)
  }

  const markDeckCompleted = async () => {
    if (markedComplete || isCompleting) return
    setIsCompleting(true)
    try {
      const response = await fetch(`/api/flashcards/${deckId}/complete`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Request failed')
      }
      setMarkedComplete(true)
      toast.success('Deck completato! Achievements aggiornati.')
    } catch (error) {
      toast.error('Impossibile registrare il completamento del deck')
    } finally {
      setIsCompleting(false)
    }
  }

  if (cards.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nessuna flashcard disponibile al momento.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-foreground">{deck.title}</h1>
        {deck.description ? (
          <p className="text-sm text-muted-foreground">{deck.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Carta {activeIndex + 1} di {cards.length}
        </p>
      </div>

      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-4">
        <Button variant="outline" className="w-full" onClick={handleFlip}>
          {showBack ? 'Mostra domanda' : 'Mostra risposta'}
        </Button>

        <Card className="w-full shadow-lg transition-transform duration-300 ease-in-out">
          <CardContent className="min-h-[220px] space-y-3 p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {showBack ? 'Risposta' : 'Domanda'}
            </p>
            <p className="whitespace-pre-line text-lg font-semibold text-foreground">
              {showBack ? currentCard.back : currentCard.front}
            </p>
            {currentCard.points > 0 ? (
              <p className="text-xs text-muted-foreground">
                Suggerimento punteggio: {currentCard.points} pts
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex w-full items-center justify-between gap-4">
          <Button variant="secondary" onClick={handlePrev}>
            Precedente
          </Button>
          <Button variant="secondary" onClick={handleNext}>
            Successiva
          </Button>
        </div>
        <div className="w-full space-y-2">
          <Button
            className="w-full"
            onClick={markDeckCompleted}
            disabled={markedComplete || isCompleting}
          >
            {markedComplete ? 'Deck completato' : isCompleting ? 'Registrazione…' : 'Segna come completato'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Premi quando hai ripassato tutte le carte per sbloccare gli achievement collegati.
          </p>
        </div>
      </div>
    </div>
  )
}
