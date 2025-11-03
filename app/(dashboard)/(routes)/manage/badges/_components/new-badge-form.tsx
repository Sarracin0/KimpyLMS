'use client'

import * as z from 'zod'
import axios from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

import { BadgeType } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const formSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(200).optional(),
  type: z.nativeEnum(BadgeType),
  pointsReward: z.coerce.number().min(0).max(500).default(0),
})

export const NewBadgeForm = () => {
  const router = useRouter()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      type: BadgeType.CUSTOM,
      pointsReward: 0,
    },
  })

  const { isSubmitting, isValid } = form.formState

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await axios.post('/api/badges', values)
      toast.success('Badge creato')
      form.reset()
      router.refresh()
    } catch {
      toast.error('Impossibile creare il badge')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-foreground">Crea un badge</h3>
          <p className="text-xs text-muted-foreground">Premia il tuo team con riconoscimenti personalizzati.</p>
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Es. Customer Hero" disabled={isSubmitting} {...field} />
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
              <FormLabel>Descrizione</FormLabel>
              <FormControl>
                <Textarea rows={3} disabled={isSubmitting} placeholder="Perché dovrebbe essere assegnato?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select disabled={isSubmitting} value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(BadgeType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pointsReward"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Punti</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => field.onChange(Math.max(0, Number(field.value || 0) - 1))}
                      disabled={isSubmitting}
                      aria-label="Diminuisci punti"
                    >
                      −
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={500}
                      disabled={isSubmitting}
                      className="w-24 text-center"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => field.onChange(Math.min(500, Number(field.value || 0) + 1))}
                      disabled={isSubmitting}
                      aria-label="Aumenta punti"
                    >
                      +
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={!isValid || isSubmitting}>
          Crea badge
        </Button>
      </form>
    </Form>
  )
}
