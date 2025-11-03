'use client'

import { useState } from 'react'
import { ExternalLink, Eye, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PdfViewerDialog, type AttachmentLike, isPdfAttachment } from '@/components/pdf-viewer'

export type AttachmentResource = AttachmentLike

type AttachmentResourceListProps = {
  attachments: AttachmentResource[]
  contextLabel?: string
}

export const AttachmentResourceList = ({ attachments, contextLabel }: AttachmentResourceListProps) => {
  const [selected, setSelected] = useState<AttachmentResource | null>(null)
  const [open, setOpen] = useState(false)

  const handleOpen = (attachment: AttachmentResource) => {
    setSelected(attachment)
    setOpen(true)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSelected(null)
    }
  }

  return (
    <>
      <div className="space-y-2">
        {attachments.map((attachment) => {
          const isPdf = isPdfAttachment(attachment)
          const label = isPdf ? 'PDF didattico' : 'Risorsa esterna'

          return (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/30 bg-white/60 p-3 text-sm text-foreground transition-colors backdrop-blur supports-[backdrop-filter]:bg-white/40 hover:bg-white/65"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium leading-tight">{attachment.name}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isPdf && (
                  <Button variant="secondary" size="sm" className="gap-2" onClick={() => handleOpen(attachment)}>
                    <Eye className="h-4 w-4" />
                    Apri viewer
                  </Button>
                )}
                <Button variant={isPdf ? 'ghost' : 'secondary'} size={isPdf ? 'icon' : 'sm'} asChild>
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {!isPdf ? 'Apri link' : null}
                  </a>
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <PdfViewerDialog open={open} onOpenChange={handleOpenChange} attachment={selected} contextLabel={contextLabel} />
    </>
  )
}

export default AttachmentResourceList
