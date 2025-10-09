'use client'

import * as z from 'zod'
import axios from 'axios'
import { PlusCircle, File, Loader2, X, Eye } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Attachment, Course } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/file-upload'
import { PdfViewerDialog, isPdfAttachment } from '@/components/pdf-viewer'

interface AttachmentFormProps {
  initialData: Course & { attachments: Attachment[] }
  courseId: string
}

const formSchema = z.object({
  url: z.string().min(1),
})

export const AttachmentForm = ({ initialData, courseId }: AttachmentFormProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const toggleEdit = () => setIsEditing((current) => !current)

  const router = useRouter()

  const attachments = initialData.attachments.filter((attachment) => attachment.chapterId == null)

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      formSchema.parse(values)
      await axios.post(`/api/courses/${courseId}/attachments`, values)
      toast.success('Corso aggiornato')
      toggleEdit()
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore')
    }
  }

  const onDelete = async (id: string) => {
    try {
      setDeletingId(id)
      await axios.delete(`/api/courses/${courseId}/attachments/${id}`)
      toast.success('Allegato eliminato')
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore')
    } finally {
      setDeletingId(null)
    }
  }

  const handleOpenPreview = (attachment: Attachment) => {
    setPreviewAttachment(attachment)
    setIsPreviewOpen(true)
  }

  const handlePreviewOpenChange = (nextOpen: boolean) => {
    setIsPreviewOpen(nextOpen)
    if (!nextOpen) {
      setPreviewAttachment(null)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/80 p-6 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between font-medium">
        Allegati del corso
        <Button onClick={toggleEdit} variant="ghost">
          {isEditing && <>Annulla</>}
          {!isEditing && (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              Aggiungi un file
            </>
          )}
        </Button>
      </div>
      {!isEditing && (
        <>
          {attachments.length === 0 && (
            <p className="mt-4 text-sm italic text-muted-foreground">Ancora nessun allegato</p>
          )}
          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-foreground"
                >
                  <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <p className="line-clamp-1 flex-1 text-xs font-medium text-muted-foreground">{attachment.name}</p>
                  <div className="flex items-center gap-2">
                    {isPdfAttachment(attachment) && (
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(attachment)}
                        className="text-muted-foreground transition hover:text-foreground"
                        title="Anteprima"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {deletingId === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDelete(attachment.id)}
                        className="ml-auto transition hover:opacity-75"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {isEditing && (
        <div>
          <FileUpload
            endpoint="courseAttachment"
            onChange={(url) => {
              if (url) {
                onSubmit({ url })
              }
            }}
          />
          <div className="mt-4 text-xs text-muted-foreground">
            Aggiungi tutto ciò che serve ai learner per completare il corso.
          </div>
        </div>
      )}
      <PdfViewerDialog
        open={isPreviewOpen}
        onOpenChange={handlePreviewOpenChange}
        attachment={previewAttachment}
        contextLabel="Materiale del corso"
      />
    </div>
  )
}
