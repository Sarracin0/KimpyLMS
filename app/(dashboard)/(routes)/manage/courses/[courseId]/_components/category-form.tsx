'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Course } from '@prisma/client'
import { PencilIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useState } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { Combobox } from '@/components/ui/combobox'

type CategoryFormProps = {
  initialData: Course
  courseId: string
  options: Array<{ label: string; value: string }>
}

const formSchema = z.object({
  categoryId: z.string().min(1),
})

type FormSchema = z.infer<typeof formSchema>

export default function CategoryForm({ initialData, courseId, options }: CategoryFormProps) {
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()

  const toggleEdit = () => setIsEditing((current) => !current)

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { categoryId: initialData.categoryId ?? '' },
  })

  const { isSubmitting, isValid } = form.formState

  const onSubmit = async (values: FormSchema) => {
    try {
      await axios.patch(`/api/courses/${courseId}`, values)
      toast.success('Corso aggiornato!')
      toggleEdit()
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore!')
    }
  }

  const selectedOption = options.find((option) => option.value === initialData?.categoryId)

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between font-medium">
        Categoria del corso
        <Button variant="ghost" onClick={toggleEdit}>
          {isEditing ? (
            'Annulla'
          ) : (
            <>
              <PencilIcon className="mr-2 h-4 w-4" />
              Modifica categoria
            </>
          )}
        </Button>
      </div>

      {!isEditing ? (
        <p className={cn('mt-2 text-sm', { 'italic text-muted-foreground': !initialData.categoryId })}>
          {selectedOption?.label ?? 'Nessuna categoria'}
        </p>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Combobox options={options} {...field} />
                  </FormControl>
                  <FormMessage />
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
