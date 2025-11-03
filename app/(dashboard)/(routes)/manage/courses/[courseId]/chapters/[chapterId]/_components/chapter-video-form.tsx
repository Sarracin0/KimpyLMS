'use client'

import * as z from 'zod'
import axios from 'axios'
import { Pencil, PlusCircle, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Chapter } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/file-upload'
import { Input } from '@/components/ui/input'

interface ChapterVideoFormProps {
  initialData: Chapter
  courseId: string
  chapterId: string
}

const formSchema = z.object({
  videoUrl: z.string().min(1),
})

export const ChapterVideoForm = ({ initialData, courseId, chapterId }: ChapterVideoFormProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [manualUrl, setManualUrl] = useState(initialData.videoUrl ?? '')
  const [isSavingLink, setIsSavingLink] = useState(false)

  const toggleEdit = () => setIsEditing((current) => !current)

  const router = useRouter()

  useEffect(() => {
    setManualUrl(initialData.videoUrl ?? '')
  }, [initialData.videoUrl])

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      formSchema.parse(values)
      await axios.patch(`/api/courses/${courseId}/chapters/${chapterId}`, values)
      toast.success('Capitolo aggiornato')
      toggleEdit()
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore')
    }
  }

  const onSaveManualLink = async () => {
    if (!manualUrl) {
      toast.error('Inserisci un URL valido prima di salvare')
      return
    }

    try {
      setIsSavingLink(true)
      await onSubmit({ videoUrl: manualUrl })
    } catch {
      toast.error('Impossibile salvare il link')
    } finally {
      setIsSavingLink(false)
    }
  }

  return (
    <div className="mt-6 rounded-md border bg-slate-100 p-4">
      <div className="flex items-center justify-between font-medium">
        Video del capitolo
        <Button onClick={toggleEdit} variant="ghost">
          {isEditing && <>Annulla</>}
          {!isEditing && !initialData.videoUrl && (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              Aggiungi un video
            </>
          )}
          {!isEditing && initialData.videoUrl && (
            <>
              <Pencil className="mr-2 h-4 w-4" />
              Modifica video
            </>
          )}
        </Button>
      </div>
      {!isEditing &&
        (!initialData.videoUrl ? (
          <div className="flex h-60 items-center justify-center rounded-md bg-slate-200">
            <Video className="h-10 w-10 text-slate-500" />
          </div>
        ) : (
          <div className="relative mt-2 overflow-hidden rounded-lg border border-slate-200">
            <video
              controls
              className="h-full w-full"
              src={initialData.videoUrl ?? ''}
              preload="metadata"
            />
          </div>
        ))}
      {isEditing && (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
            <p className="text-sm font-medium text-foreground">Carica un file video</p>
            <p className="text-xs text-muted-foreground">
              Utilizziamo UploadThing per l&apos;archiviazione sicura. Assicurati che `UPLOADTHING_TOKEN` sia configurato nell&apos;ambiente.
            </p>
            <div className="mt-3">
              <FileUpload
                endpoint="chapterVideo"
                onChange={(url) => {
                  if (url) {
                    onSubmit({ videoUrl: url })
                  }
                }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">…oppure incolla un link esterno</p>
            <p className="text-xs text-muted-foreground">
              Collega un MP4, un video Vimeo, YouTube non in elenco o un URL di streaming interno già in uso in azienda.
            </p>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <Input
                placeholder="https://"
                value={manualUrl}
                onChange={(event) => setManualUrl(event.target.value)}
                disabled={isSavingLink}
              />
              <Button onClick={onSaveManualLink} disabled={isSavingLink}>
                {isSavingLink ? 'Salvataggio…' : 'Salva link'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {initialData.videoUrl && !isEditing && (
        <div className="mt-2 text-xs text-muted-foreground">
          Assicurati che i video caricati siano compressi per una riproduzione fluida.
        </div>
      )}
    </div>
  )
}
