'use client'

import { CheckCircleIcon, LockIcon, PlayCircleIcon } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type CourseSidebarItemProps = {
  id: string
  label: string
  isCompleted: boolean
  courseId: string
  isLocked: boolean
}

export default function CourseSidebarItem({ id, label, isCompleted, courseId, isLocked }: CourseSidebarItemProps) {
  const pathname = usePathname()
  const router = useRouter()

  const Icon = isLocked ? LockIcon : isCompleted ? CheckCircleIcon : PlayCircleIcon

  const isActive = pathname?.includes(id)

  const onClick = () => {
    if (isLocked) return
    router.push(`/courses/${courseId}/chapters/${id}`)
  }

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        'group relative flex w-full items-center gap-3 px-4 pl-6 py-3 text-sm font-medium text-muted-foreground rounded-md transition-colors hover:text-foreground hover:bg-white/40',
        {
          'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground': isLocked,
          'bg-white/50 text-foreground shadow-sm ring-1 ring-white/30 hover:bg-white/50': isActive,
          'text-emerald-700 hover:text-emerald-700': isCompleted,
          'ring-1 ring-emerald-300/40': isCompleted && isActive,
        },
      )}
    >
      <div className="flex items-center gap-x-2 py-3">
        <Icon
          size={22}
          className={cn('text-muted-foreground', { 'text-foreground': isActive, 'text-emerald-700': isCompleted })}
        />
        {label}
      </div>

      <div
        className={cn('ml-auto h-5 w-1 rounded-full bg-foreground/60 opacity-0 transition-opacity', {
          'opacity-100': isActive,
          'bg-emerald-600': isCompleted,
        })}
      />
    </button>
  )
}
