'use client'

import * as z from 'zod'
import axios from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TitleFormProps {
  initialData: {
    title: string
  }
  courseId: string
}

const formSchema = z.object({
  title: z.string().min(1, {
    message: 'Il titolo è obbligatorio',
  }),
})

export const TitleForm = ({ initialData, courseId }: TitleFormProps) => {
  const [isEditing, setIsEditing] = useState(false)

  const toggleEdit = () => setIsEditing((current) => !current)

  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData,
  })

  const { isSubmitting, isValid } = form.formState

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await axios.patch(`/api/courses/${courseId}`, values)
      toast.success('Corso aggiornato')
      toggleEdit()
      router.refresh()
    } catch {
      toast.error('Si è verificato un errore')
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between font-medium">
        Titolo del corso
        <Button onClick={toggleEdit} variant="ghost">
          {isEditing ? (
            <>Annulla</>
          ) : (
            <>
              <Pencil className="mr-2 h-4 w-4" />
              Modifica titolo
            </>
          )}
        </Button>
      </div>
      {!isEditing && <p className="mt-2 text-base font-semibold text-foreground">{initialData.title}</p>}
      {isEditing && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input disabled={isSubmitting} placeholder="es. 'Sviluppo web avanzato'" {...field} />
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
