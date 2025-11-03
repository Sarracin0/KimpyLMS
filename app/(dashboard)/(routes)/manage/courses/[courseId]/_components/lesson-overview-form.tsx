'use client'

import * as z from 'zod'
import axios from 'axios'
import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import type { Chapter } from '@prisma/client'

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const formSchema = z.object({
  title: z.string().min(1, 'Il titolo è obbligatorio'),
  description: z.string().min(1, 'La descrizione è obbligatoria'),
  estimatedDurationMinutes: z
    .union([z.literal(''), z.coerce.number().min(0).max(1200)])
    .transform((value) => (value === '' ? null : value))
    .optional(),
})

type LessonOverviewFormProps = {
  courseId: string
  chapterId: string
  initialData: Pick<Chapter, 'title' | 'description' | 'estimatedDurationMinutes'>
}

type FormValues = z.infer<typeof formSchema>

export const LessonOverviewForm = ({ courseId, chapterId, initialData }: LessonOverviewFormProps) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData.title,
      description: initialData.description ?? '',
      estimatedDurationMinutes: initialData.estimatedDurationMinutes ?? '',
    },
  })

  const isSubmitting = form.formState.isSubmitting || isPending

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        await axios.patch(`/api/courses/${courseId}/chapters/${chapterId}`, {
          title: values.title,
          description: values.description,
          estimatedDurationMinutes: values.estimatedDurationMinutes ?? null,
        })
        toast.success('Dettagli della lezione salvati')
        router.refresh()
      } catch {
        toast.error('Impossibile salvare i dettagli della lezione')
      }
    })
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-5 shadow-sm">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titolo della lezione *</FormLabel>
                <FormControl>
                  <Input placeholder="es. Benvenuto nel programma" disabled={isSubmitting} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Narrativa della lezione *</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="Descrivi cosa succede in questa lezione e perché è importante."
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estimatedDurationMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minuti stimati</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={1200}
                    placeholder="es. 45"
                    disabled={isSubmitting}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>Aiuta i dipendenti a pianificare il tempo necessario.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvataggio…' : 'Salva le informazioni della lezione'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default LessonOverviewForm
