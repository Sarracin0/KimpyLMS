'use client'

import { Chapter } from '@prisma/client'
import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Clock, Grip, Pencil, Video } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface ChaptersListProps {
  items: Chapter[]
  onReorder: (updateData: { id: string; position: number }[]) => void
  onEdit: (id: string) => void
}

export const ChaptersList = ({ items, onReorder, onEdit }: ChaptersListProps) => {
  const [isMounted, setIsMounted] = useState(false)
  const [chapters, setChapters] = useState(items)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setChapters(items)
  }, [items])

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(chapters)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    const startIndex = Math.min(result.source.index, result.destination.index)
    const endIndex = Math.max(result.source.index, result.destination.index)

    const updatedChapters = items.slice(startIndex, endIndex + 1)

    setChapters(items)

    const bulkUpdateData = updatedChapters.map((chapter) => ({
      id: chapter.id,
      position: items.findIndex((item) => item.id === chapter.id),
    }))

    onReorder(bulkUpdateData)
  }

  if (!isMounted) {
    return null
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="chapters">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {chapters.map((chapter, index) => (
              <Draggable key={chapter.id} draggableId={chapter.id} index={index}>
                {(provided) => (
                  <div
                    className={cn(
                      'mb-4 flex items-center gap-x-3 rounded-xl border border-border/60 bg-card/80 px-3 py-3 text-sm text-foreground shadow-sm transition hover:border-primary/40 hover:bg-card',
                      chapter.isPublished && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                    )}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    onClick={() => onEdit(chapter.id)}
                  >
                    <div
                      className={cn(
                        'rounded-md border border-border/40 bg-muted/40 px-2 py-3 transition hover:bg-muted',
                        chapter.isPublished && 'border-emerald-200 bg-emerald-100/60 hover:bg-emerald-100',
                      )}
                      {...provided.dragHandleProps}
                    >
                      <Grip className="h-5 w-5" />
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{chapter.title}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {chapter.estimatedDurationMinutes ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {chapter.estimatedDurationMinutes} min
                            </span>
                          ) : null}
                          {chapter.videoUrl ? (
                            <span className="inline-flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              Video presente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              Media da caricare
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-x-2">
                        {chapter.isPreview && <Badge variant="outline">Anteprima</Badge>}
                        <Badge className={cn('bg-slate-500', chapter.isPublished && 'bg-emerald-600')}>
                          {chapter.isPublished ? 'Pubblicato' : 'Bozza'}
                        </Badge>
                        <Pencil
                          onClick={(event) => {
                            event.stopPropagation()
                            onEdit(chapter.id)
                          }}
                          className="h-4 w-4 cursor-pointer text-muted-foreground transition hover:text-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}
