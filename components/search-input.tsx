'use client'

import qs from 'query-string'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'

export const SearchInput = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const currentCategoryId = searchParams.get('categoryId')
  const initialTitle = searchParams.get('title') ?? ''

  const [value, setValue] = useState(initialTitle)
  const debouncedValue = useDebounce(value)

  useEffect(() => {
    const url = qs.stringifyUrl(
      {
        url: pathname,
        query: {
          categoryId: currentCategoryId,
          title: debouncedValue,
        },
      },
      { skipEmptyString: true, skipNull: true },
    )

    router.push(url)
  }, [debouncedValue, currentCategoryId, router, pathname])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        onChange={(e) => setValue(e.target.value)}
        value={value}
        className="w-full rounded-full bg-muted pl-9 focus-visible:ring-primary/40 md:w-[340px]"
        placeholder="Cerca un corso"
      />
    </div>
  )
}
