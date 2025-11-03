'use client'

import qs from 'query-string'
import { IconType } from 'react-icons'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { cn } from '@/lib/utils'

interface CategoryItemProps {
  label: string
  value?: string
  icon?: IconType
}

export const CategoryItem = ({ label, value, icon: Icon }: CategoryItemProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentCategoryId = searchParams.get('categoryId')
  const currentTitle = searchParams.get('title')

  const isSelected = currentCategoryId === value

  const onClick = () => {
    const url = qs.stringifyUrl(
      {
        url: pathname,
        query: {
          title: currentTitle,
          categoryId: isSelected ? null : value,
        },
      },
      { skipNull: true, skipEmptyString: true },
    )

    router.push(url)
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-x-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        isSelected && 'border-primary/40 bg-primary/10 text-primary',
      )}
      type="button"
    >
      {Icon && <Icon size={18} />}
      <div className="truncate">{label}</div>
    </button>
  )
}
