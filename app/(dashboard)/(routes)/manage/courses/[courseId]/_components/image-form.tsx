'use client'

import * as z from 'zod'
import axios from 'axios'
import { Pencil, PlusCircle, ImageIcon } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Course } from '@prisma/client'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/file-upload'

interface ImageFormProps {
  initialData: Course
  courseId: string
}

const formSchema = z.object({
  imageUrl: z.string().min(1, {
    message: "L'immagine è obbligatoria",
  }),
})

export const ImageForm = ({ initialData, courseId }: ImageFormProps) => {
  const [isEditing, setIsEditing] = useState(false)

  const toggleEdit = () => setIsEditing((current) => !current)

  const router = useRouter()

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await formSchema.parseAsync(values)
      await axios.patch(`/api/courses/${courseId}`, values)
      toast.success('Corso aggiornato')
      toggleEdit()
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore')
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between font-medium">
        Immagine del corso
        <Button onClick={toggleEdit} variant="ghost">
          {isEditing && <>Annulla</>}
          {!isEditing && !initialData.imageUrl && (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              Aggiungi un&apos;immagine
            </>
          )}
          {!isEditing && initialData.imageUrl && (
            <>
              <Pencil className="mr-2 h-4 w-4" />
              Modifica immagine
            </>
          )}
        </Button>
      </div>
      {!isEditing &&
        (!initialData.imageUrl ? (
          <div className="mt-4 flex h-60 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/60">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          </div>
        ) : (
          <div className="relative mt-4 aspect-video overflow-hidden rounded-lg border border-border/40">
            <Image alt="Anteprima immagine" fill className="object-cover" src={initialData.imageUrl} />
          </div>
        ))}
      {isEditing && (
        <div>
          <FileUpload
            endpoint="courseImage"
            onChange={(url) => {
              if (url) {
                onSubmit({ imageUrl: url })
              }
            }}
          />
          <div className="mt-4 text-xs text-muted-foreground">Rapporto 16:9 consigliato</div>
        </div>
      )}
    </div>
  )
}
