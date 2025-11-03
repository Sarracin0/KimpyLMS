'use client'

import { useEffect, useMemo, useState } from 'react'
import { Attachment, Chapter } from '@prisma/client'
import { BookOpenCheck, CalendarClock, LayoutDashboard, Sparkles, Video } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { LessonOverviewForm } from './lesson-overview-form'
import { LessonResources } from './lesson-resources'
import { ChapterVideoForm } from '../chapters/[chapterId]/_components/chapter-video-form'
import { ChapterAccessForm } from '../chapters/[chapterId]/_components/chapter-access-form'
import { Card, CardContent } from '@/components/ui/card'

import { cn } from '@/lib/utils'

export type LessonWorkspaceSheetProps = {
  courseId: string
  chapter: Chapter
  attachments: Attachment[]
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

export const LessonWorkspaceSheet = ({ courseId, chapter, attachments, onOpenChange, onChanged }: LessonWorkspaceSheetProps) => {
  const [open, setOpen] = useState(true)
  const [activeBlock, setActiveBlock] = useState<'overview' | 'video' | 'live' | 'resources' | 'gamification' | 'access'>('overview')

  useEffect(() => {
    setOpen(true)
    setActiveBlock('overview')
  }, [chapter.id])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    onOpenChange(next)
  }

  const blockStatuses = useMemo(() => ({
    overview: Boolean(chapter.title && chapter.description),
    video: Boolean(chapter.videoUrl || chapter.contentUrl),
    resources: attachments.length > 0,
    live: Boolean(chapter.contentUrl && chapter.contentUrl.startsWith('live:')),
    gamification: false,
    access: chapter.isPublished,
  }), [attachments.length, chapter.contentUrl, chapter.description, chapter.isPublished, chapter.title, chapter.videoUrl])

  const blocks = [
    {
      id: 'overview' as const,
      title: 'Panoramica',
      description: 'Tono, narrativa, impegno stimato',
      icon: LayoutDashboard,
      completed: blockStatuses.overview,
    },
    {
      id: 'video' as const,
      title: 'Lezione video',
      description: blockStatuses.video ? 'Video pronto' : 'Carica o collega un video',
      icon: Video,
      completed: blockStatuses.video,
    },
    {
      id: 'live' as const,
      title: 'Sessione live',
      description: 'Pianifica un momento in diretta',
      icon: CalendarClock,
      completed: blockStatuses.live,
    },
    {
      id: 'resources' as const,
      title: 'Risorse',
      description: attachments.length ? `${attachments.length} file di supporto` : 'Slide, PDF, manuali',
      icon: BookOpenCheck,
      completed: blockStatuses.resources,
    },
    {
      id: 'gamification' as const,
      title: 'Gamificazione',
      description: 'Pianifica le ricompense future',
      icon: Sparkles,
      completed: blockStatuses.gamification,
    },
    {
      id: 'access' as const,
      title: 'Accesso e pubblicazione',
      description: chapter.isPublished ? 'Lezione pubblicata' : 'Anteprima e comandi di pubblicazione',
      icon: Sparkles,
      completed: blockStatuses.access,
    },
  ]

  const renderActiveBlock = () => {
    switch (activeBlock) {
      case 'overview':
        return (
          <LessonOverviewForm
            courseId={courseId}
            chapterId={chapter.id}
            initialData={{
              title: chapter.title,
              description: chapter.description ?? '',
              estimatedDurationMinutes: chapter.estimatedDurationMinutes ?? null,
            }}
          />
        )
      case 'video':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Carica un file video (richiede `UPLOADTHING_TOKEN`) oppure incolla un URL sicuro verso contenuti in streaming ospitati
              su Vimeo, YouTube o sul tuo CDN interno.
            </p>
            <ChapterVideoForm initialData={chapter} chapterId={chapter.id} courseId={courseId} />
          </div>
        )
      case 'live':
        return (
          <Card className="border-dashed border-border/60 bg-muted/20">
            <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
              <p>
                L&apos;integrazione con il live streaming è nella roadmap. Per ora aggiungi nel blocco risorse un link all&apos;invito in
                calendario o alla registrazione del webinar così i learner avranno tutti i dettagli di accesso.
              </p>
              <p className="text-xs">
                In arrivo: sincronizzazione automatica con il modulo Live Sessions e gamification basata sulla partecipazione.
              </p>
            </CardContent>
          </Card>
        )
      case 'resources':
        return (
          <LessonResources courseId={courseId} chapterId={chapter.id} initialItems={attachments} onChanged={onChanged} />
        )
      case 'gamification':
        return (
          <Card className="border-dashed border-border/60 bg-muted/20">
            <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
              <p>
                Stiamo preparando il Gamification Studio, dove potrai assegnare badge, streak e punti bonus per ogni lezione.
                Definisci ora i learning outcome così aggiungere incentivi in seguito sarà semplicissimo.
              </p>
              <p className="text-xs">
                Suggerimento: annota gli obiettivi desiderati nella descrizione della lezione in modo che il team possa convertirli
                in criteri per i badge appena lo studio sarà disponibile.
              </p>
            </CardContent>
          </Card>
        )
      case 'access':
        return <ChapterAccessForm initialData={chapter} chapterId={chapter.id} courseId={courseId} />
      default:
        return null
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-background sm:max-w-4xl">
        <SheetHeader className="space-y-2 text-left">
          <Badge
            variant="secondary"
            className={cn('w-fit px-2 py-1 uppercase tracking-wide', chapter.isPublished ? 'bg-emerald-100 text-emerald-700' : '')}
          >
            {chapter.isPublished ? 'Lezione pubblicata' : 'Lezione in bozza'}
          </Badge>
          <SheetTitle>{chapter.title}</SheetTitle>
          <SheetDescription>
            Prepara media e risorse con cui interagiranno i dipendenti. Ogni modifica viene salvata in tempo reale nel builder.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-24">
          <div className="grid gap-3 md:grid-cols-2">
            {blocks.map((block) => {
              const Icon = block.icon
              const isActive = activeBlock === block.id
              return (
                <Card
                  key={block.id}
                  role="button"
                  onClick={() => setActiveBlock(block.id)}
                  className={cn(
                    'border border-border/60 bg-card/80 transition hover:border-primary/40',
                    isActive && 'border-primary bg-primary/5 shadow-sm',
                  )}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-muted/30 text-muted-foreground',
                        isActive && 'border-primary/40 bg-primary/10 text-primary',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{block.title}</p>
                        {block.completed ? <Badge variant="outline">Pronto</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{block.description}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Separator />

          <section className="space-y-4">{renderActiveBlock()}</section>
        </div>

        <SheetFooter className="mt-6" />
      </SheetContent>
    </Sheet>
  )
}

export default LessonWorkspaceSheet
