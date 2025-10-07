'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Eye, Paperclip, Trash2 } from 'lucide-react'
import type { Attachment } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUpload } from '@/components/file-upload'
import { PdfViewerDialog, isPdfAttachment } from '@/components/pdf-viewer'
import { cn } from '@/lib/utils'

type LessonResourcesProps = {
  courseId: string
  chapterId: string
  initialItems: Attachment[]
  onChanged?: () => void
}

type LessonLinkFormState = {
  url: string
  name: string
}

export const LessonResources = ({ courseId, chapterId, initialItems, onChanged }: LessonResourcesProps) => {
  const [items, setItems] = useState(initialItems)
  const [linkForm, setLinkForm] = useState<LessonLinkFormState>({ url: '', name: '' })
  const [isLinkSaving, setIsLinkSaving] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const refresh = (next: Attachment[]) => {
    setItems(next)
    onChanged?.()
  }

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const createAttachment = async (payload: { url: string; name?: string; type?: string }) => {
    const response = await axios.post(`/api/courses/${courseId}/chapters/${chapterId}/attachments`, payload)
    const next = [response.data as Attachment, ...items]
    refresh(next)
    toast.success('Resource added')
  }

  const handleUpload = async (url?: string) => {
    try {
      if (!url) return
      await createAttachment({ url })
    } catch {
      toast.error('Unable to add file')
    }
  }

  const handleCreateLink = async () => {
    if (!linkForm.url) {
      toast.error('Add a valid URL')
      return
    }

    try {
      setIsLinkSaving(true)
      await createAttachment({
        url: linkForm.url,
        name: linkForm.name || linkForm.url,
        type: 'link',
      })
      setLinkForm({ url: '', name: '' })
    } catch {
      toast.error('Unable to save link')
    } finally {
      setIsLinkSaving(false)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    try {
      await axios.delete(`/api/courses/${courseId}/chapters/${chapterId}/attachments/${attachmentId}`)
      const next = items.filter((item) => item.id !== attachmentId)
      refresh(next)
      toast.success('Resource removed')
    } catch {
      toast.error('Unable to delete resource')
    }
  }

  const handlePreviewOpenChange = (nextOpen: boolean) => {
    setIsPreviewOpen(nextOpen)
    if (!nextOpen) {
      setPreviewAttachment(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">Upload supporting files</p>
        <p className="text-xs text-muted-foreground">Slide decks, PDFs, worksheets or transcripts.</p>
        <div className="mt-3">
          <FileUpload endpoint="courseAttachment" onChange={handleUpload} />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">Link to hosted content</p>
        <p className="text-xs text-muted-foreground">Embed knowledge base articles, Google Docs or intranet pages.</p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="Resource name"
            value={linkForm.name}
            onChange={(event) => setLinkForm((state) => ({ ...state, name: event.target.value }))}
          />
          <Input
            placeholder="https://"
            value={linkForm.url}
            onChange={(event) => setLinkForm((state) => ({ ...state, url: event.target.value }))}
            className="md:flex-1"
          />
          <Button type="button" onClick={handleCreateLink} disabled={isLinkSaving}>
            {isLinkSaving ? 'Saving…' : 'Add link'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lesson resources yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm',
              )}
            >
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.type ?? 'file'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {isPdfAttachment(item) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPreviewAttachment(item)
                      setIsPreviewOpen(true)
                    }}
                    title="Anteprima"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <PdfViewerDialog open={isPreviewOpen} onOpenChange={handlePreviewOpenChange} attachment={previewAttachment} contextLabel="Risorsa lezione" />
    </div>
  )
}

export default LessonResources
