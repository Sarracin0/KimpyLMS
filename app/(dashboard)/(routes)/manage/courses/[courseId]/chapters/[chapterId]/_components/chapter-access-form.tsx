'use client'

import * as z from 'zod'
import axios from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Chapter } from '@prisma/client'
import { Form, FormControl, FormDescription, FormField, FormItem } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'

interface ChapterAccessFormProps {
  initialData: Chapter
  courseId: string
  chapterId: string
}

const formSchema = z.object({
  isPreview: z.boolean().default(false),
})

export const ChapterAccessForm = ({ initialData, courseId, chapterId }: ChapterAccessFormProps) => {
  const [isEditing, setIsEditing] = useState(false)

  const toggleEdit = () => setIsEditing((current) => !current)

  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isPreview: !!initialData.isPreview,
    },
  })

  const { isSubmitting, isValid } = form.formState

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await axios.patch(`/api/courses/${courseId}/chapters/${chapterId}`, values)
      toast.success('Capitolo aggiornato')
      toggleEdit()
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore')
    }
  }

  return (
    <div className="mt-6 rounded-md border bg-slate-100 p-4">
      <div className="flex items-center justify-between font-medium">
        Accesso al capitolo
        <Button onClick={toggleEdit} variant="ghost">
          {isEditing ? (
            <>Annulla</>
          ) : (
            <>
              <Pencil className="mr-2 h-4 w-4" />
              Modifica accesso
            </>
          )}
        </Button>
      </div>
      {!isEditing && (
        <p className={cn('mt-2 text-sm', !initialData.isPreview && 'italic text-slate-500')}>
          {initialData.isPreview ? <>Questo capitolo è disponibile in anteprima.</> : <>Anteprima disattivata per questo capitolo.</>}
        </p>
      )}
      {isEditing && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="isPreview"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormDescription>Abilita questa opzione se vuoi che i learner vedano il capitolo in anteprima prima di iscriversi.</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex items-center gap-x-2">
              <Button disabled={!isValid || isSubmitting} type="submit">
                Salva
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}
