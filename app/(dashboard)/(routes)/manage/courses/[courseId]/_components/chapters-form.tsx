'use client'

import * as z from 'zod'
import axios from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2, PlusCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Attachment, Chapter, Course } from '@prisma/client'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { ChaptersList } from './chapters-list'
import { LessonWorkspaceSheet } from './lesson-workspace-sheet'

interface ChaptersFormProps {
  initialData: Course & { chapters: Chapter[]; attachments: Attachment[] }
  courseId: string
}

const formSchema = z.object({
  title: z.string().min(1),
})

export const ChaptersForm = ({ initialData, courseId }: ChaptersFormProps) => {
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)

  const toggleCreating = () => {
    setIsCreating((current) => !current)
  }

  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
    },
  })

  const { isSubmitting, isValid } = form.formState

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await axios.post(`/api/courses/${courseId}/chapters`, values)
      toast.success('Capitolo creato')
      form.reset()
      toggleCreating()
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore')
    }
  }

  const onReorder = async (updateData: { id: string; position: number }[]) => {
    try {
      setIsUpdating(true)

      await axios.put(`/api/courses/${courseId}/chapters/reorder`, {
        list: updateData,
      })
      toast.success('Capitoli riordinati')
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore')
    } finally {
      setIsUpdating(false)
    }
  }

  const onEdit = (id: string) => {
    setSelectedChapterId(id)
  }

  const selectedChapter = selectedChapterId
    ? initialData.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null
    : null

  const selectedChapterAttachments = selectedChapter
    ? initialData.attachments.filter((attachment) => attachment.chapterId === selectedChapter.id)
    : []

  return (
    <div className="relative rounded-xl border border-dashed border-border/70 bg-card/80 p-6 shadow-sm transition-colors hover:border-primary/40">
      {isUpdating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-sky-700" />
        </div>
      )}
      <div className="flex items-center justify-between font-medium">
        Lezioni
        <Button onClick={toggleCreating} variant="ghost">
          {isCreating ? (
            <>Annulla</>
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              Aggiungi una lezione
            </>
          )}
        </Button>
      </div>
      {isCreating && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input disabled={isSubmitting} placeholder="es. 'Sessione di kick-off'" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button disabled={!isValid || isSubmitting} type="submit">
              Crea lezione
            </Button>
          </form>
        </Form>
      )}
      {!isCreating && (
        <div className={cn('mt-4 text-sm text-muted-foreground', !initialData.chapters.length && 'italic')}>
          {!initialData.chapters.length && 'Ancora nessuna lezione'}
          <ChaptersList onEdit={onEdit} onReorder={onReorder} items={initialData.chapters || []} />
        </div>
      )}
      {!isCreating && <p className="mt-4 text-xs text-muted-foreground">Trascina e rilascia per cambiare l&apos;ordine</p>}
      {selectedChapter ? (
        <LessonWorkspaceSheet
          courseId={courseId}
          chapter={selectedChapter}
          attachments={selectedChapterAttachments}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedChapterId(null)
            }
          }}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}
