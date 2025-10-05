'use client'

import { UserButton } from '@clerk/nextjs'
import { Briefcase, Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useDashboardContext } from '@/components/providers/dashboard-provider'

import { Button } from '@/components/ui/button'
import { SearchInput } from './search-input'

export const NavbarRoutes = () => {
  const { profile } = useDashboardContext()
  const pathname = usePathname()

  const isManageRoute = pathname?.startsWith('/manage') ?? false
  const showSearch = !isManageRoute && (pathname?.startsWith('/library') || pathname === '/courses')
  const canManage = profile.role === 'HR_ADMIN' || profile.role === 'TRAINER'

  return (
    <>
      {showSearch ? (
        <div className="hidden w-full max-w-xl md:block">
          <SearchInput />
        </div>
      ) : null}
      <div className="ml-auto flex items-center gap-x-2">
        {canManage ? (
          <Link href={isManageRoute ? '/courses' : '/manage/courses'}>
            <Button
              size="sm"
              variant={isManageRoute ? 'outline' : 'default'}
              className={`hidden items-center gap-2 md:inline-flex ${!isManageRoute ? 'bg-[#5D62E1] text-white hover:bg-[#5055c9]' : 'text-[#5D62E1] border-[#5D62E1] hover:bg-[#5D62E1]/10'}`}
            >
              {isManageRoute ? <Plus className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
              {isManageRoute ? 'New Course' : 'Manage Space'}
            </Button>
          </Link>
        ) : null}
        <div className="hidden flex-col items-end text-xs font-medium text-muted-foreground md:flex">
          <span className="text-sm font-semibold text-foreground">{profile.points} pts</span>
          <span>Streak: {profile.streakCount}</span>
        </div>
        <UserButton appearance={{ elements: { avatarBox: 'h-10 w-10 border border-muted-foreground/20' } }} />
      </div>
    </>
  )
}
