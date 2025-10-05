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
}

type NewTeamFormProps = {
  availableMembers: AvailableMember[]
}

const formSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters'),
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
    return availableMembers.filter((m) =>
      m.userId.toLowerCase().includes(q) || (m.jobTitle ?? '').toLowerCase().includes(q),
    )
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

      toast.success('Team created')
      form.reset()
      setSelected(new Set())
      setQuery('')
      router.refresh()
    } catch {
      toast.error('Unable to create team right now')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Create a new team</h3>
            <p className="text-xs text-muted-foreground">Minimal, fast onboarding: name, optional description, pick members.</p>
          </div>
          {selected.size > 0 ? (
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Product Excellence" disabled={isSubmitting} {...field} />
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
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="What is this team focused on?" disabled={isSubmitting} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Quick member pick */}
        <div className="rounded-md border bg-card">
          <div className="flex items-center gap-2 p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people (id, title)"
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0 || isSubmitting}
            >
              Clear
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto px-3 pb-3">
            {filtered.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">No people found</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((m) => {
                  const checked = selected.has(m.id)
                  return (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-md border p-2 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={checked} onCheckedChange={() => toggle(m.id)} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.userId}</p>
                          <p className="text-xs text-muted-foreground">{m.jobTitle ?? m.role}</p>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => toggle(m.id)}>
                        {checked ? 'Remove' : 'Add'}
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
            {selected.size > 0 ? `Create team and add ${selected.size}` : 'Create team'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
