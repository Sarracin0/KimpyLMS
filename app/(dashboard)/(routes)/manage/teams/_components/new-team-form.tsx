'use client'

import * as z from 'zod'
import axios from 'axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

type AvailableMember = {
  id: string
  userId: string
  jobTitle: string | null
  role: string
  displayName: string
}

type NewTeamFormProps = {
  availableMembers: AvailableMember[]
}

const formSchema = z.object({
  name: z.string().min(2, 'Il nome del team deve avere almeno 2 caratteri'),
  description: z.string().max(200).optional(),
})

export const NewTeamForm = ({ availableMembers }: NewTeamFormProps) => {
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const { isSubmitting, isValid } = form.formState

  // Member selection state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return availableMembers
    return availableMembers.filter((m) => {
      const haystack = [
        m.displayName,
        m.userId,
        m.jobTitle ?? '',
        m.role,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [availableMembers, query])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { data: team } = await axios.post('/api/teams', values)

      // Bulk add members (optional)
      if (selected.size > 0) {
        await Promise.all(
          Array.from(selected).map((userProfileId) =>
            axios.post(`/api/teams/${team.id}/members`, { userProfileId }),
          ),
        )
      }

      toast.success('Team creato')
      form.reset()
      setSelected(new Set())
      setQuery('')
      router.refresh()
    } catch {
      toast.error('Impossibile creare il team al momento')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 rounded-xl border bg-card p-4 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Crea un nuovo team</h3>
            <p className="text-xs text-muted-foreground">Onboarding rapido: nome, descrizione opzionale, selezione dei membri.</p>
          </div>
          {selected.size > 0 ? (
            <span className="text-xs text-muted-foreground">{selected.size} selezionati</span>
          ) : null}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome team</FormLabel>
                <FormControl>
                  <Input placeholder="es. Team Prodotto" disabled={isSubmitting} {...field} />
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
                <FormLabel>Descrizione (opzionale)</FormLabel>
                <FormControl>
                  <Input placeholder="Su cosa è focalizzato questo team?" disabled={isSubmitting} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Quick member pick */}
        <div className="rounded-md border border-border/60 bg-card">
          <div className="flex items-center gap-2 p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca persone (nome, ruolo)"
              className="h-9 focus-visible:ring-primary/40"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0 || isSubmitting}
            >
              Pulisci
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto px-3 pb-3">
            {filtered.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nessuna persona trovata</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((m) => {
                  const checked = selected.has(m.id)
                  return (
                    <li
                      key={m.id}
                      title={m.userId}
                      className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 p-2 hover:border-primary/20 hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={checked} onCheckedChange={() => toggle(m.id)} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.displayName}</p>
                          <p className="text-xs text-muted-foreground">{m.jobTitle ?? m.role}</p>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => toggle(m.id)}>
                        {checked ? 'Rimuovi' : 'Aggiungi'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {selected.size > 0 ? `Crea team e aggiungi ${selected.size}` : 'Crea team'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
