'use client'

import * as z from 'zod'
import axios from 'axios'
import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import type { Course } from '@prisma/client'

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const formSchema = z.object({
  title: z.string().min(1, 'Il titolo è obbligatorio'),
  description: z.string().min(1, 'La descrizione è obbligatoria'),
  learningOutcomes: z.string().max(1000).optional().or(z.literal('')),
  prerequisites: z.string().max(1000).optional().or(z.literal('')),
  estimatedDurationMinutes: z
    .union([z.literal(''), z.coerce.number().min(0).max(2000)])
    .transform((value) => (value === '' ? null : value))
    .optional(),
})

type FormValues = z.infer<typeof formSchema>

type CourseBasicsFormProps = {
  courseId: string
  initialData: Pick<Course, 'title' | 'description' | 'learningOutcomes' | 'prerequisites' | 'estimatedDurationMinutes'>
}

export const CourseBasicsForm = ({ courseId, initialData }: CourseBasicsFormProps) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData.title ?? '',
      description: initialData.description ?? '',
      learningOutcomes: initialData.learningOutcomes ?? '',
      prerequisites: initialData.prerequisites ?? '',
      estimatedDurationMinutes: initialData.estimatedDurationMinutes ?? '',
    },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        await axios.patch(`/api/courses/${courseId}`, {
          title: values.title,
          description: values.description,
          learningOutcomes: values.learningOutcomes || null,
          prerequisites: values.prerequisites || null,
          estimatedDurationMinutes: values.estimatedDurationMinutes ?? null,
        })
        toast.success('Informazioni base del corso salvate')
        router.refresh()
      } catch {
        toast.error('Impossibile salvare le informazioni base')
      }
    })
  }

  const isSubmitting = form.formState.isSubmitting || isPending

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Titolo del corso *</FormLabel>
                  <FormControl>
                    <Input placeholder="es. Onboarding Manager" disabled={isSubmitting} {...field} />
                  </FormControl>
                  <FormDescription>Offri ai partecipanti chiarezza immediata sul programma.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Panoramica *</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Riassumi la promessa formativa e il formato di erogazione."
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
                  <FormLabel>Impegno stimato (minuti)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={2000}
                      placeholder="es. 90"
                      disabled={isSubmitting}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>Aiuta i team a pianificare il tempo necessario. Lascia vuoto se non sei sicuro.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="learningOutcomes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Risultati di apprendimento</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Elenca competenze o comportamenti che i dipendenti acquisiranno."
                      disabled={isSubmitting}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prerequisites"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prerequisiti</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Opzionale: indica contesto, policy o corsi propedeutici richiesti."
                      disabled={isSubmitting}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvataggio in corso…' : 'Salva informazioni'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default CourseBasicsForm
