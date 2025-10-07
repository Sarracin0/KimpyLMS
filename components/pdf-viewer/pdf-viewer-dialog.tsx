'use client'

import { useMemo } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PdfViewer } from './pdf-viewer'

export type AttachmentLike = {
  id: string
  name: string
  url: string
  type?: string | null
}

type PdfViewerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  attachment: AttachmentLike | null
  contextLabel?: string
}

const isPdfUrl = (url: string) => /\.pdf($|\?|#)/i.test(url)

export const isPdfAttachment = (attachment: AttachmentLike | null) => {
  if (!attachment) return false
  if (attachment.type && attachment.type.toLowerCase().includes('pdf')) return true
  if (attachment.url && isPdfUrl(attachment.url)) return true
  return false
}

export const PdfViewerDialog = ({ open, onOpenChange, attachment, contextLabel }: PdfViewerDialogProps) => {
  const isPdf = useMemo(() => isPdfAttachment(attachment), [attachment])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] max-w-6xl overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{attachment?.name ?? 'Anteprima documento'}</DialogTitle>
          <DialogDescription>
            {contextLabel ? `Anteprima del materiale: ${contextLabel}` : 'Anteprima del documento PDF'}
          </DialogDescription>
        </DialogHeader>
        {attachment && isPdf ? (
          <div className="h-full overflow-hidden p-4">
            <PdfViewer
              src={attachment.url}
              title={attachment.name}
              attachmentId={attachment.id}
              className="h-full"
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Non riusciamo a mostrare questo contenuto nel viewer.</p>
            <p className="text-xs text-muted-foreground">
              {attachment
                ? 'Apri il file in una nuova scheda oppure scaricalo per consultarlo offline.'
                : 'Seleziona un documento PDF dalla lista per procedere.'}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default PdfViewerDialog
