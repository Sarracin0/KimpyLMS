import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Award,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  Play,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  ArrowUpRight,
  Circle,
} from 'lucide-react'
import { format, startOfWeek, addDays, isToday } from 'date-fns'
import { it } from 'date-fns/locale'

import { getDashboardCourses } from '@/actions/get-dashboard-courses'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { db } from '@/lib/db'
import { requireAuthContext } from '@/lib/current-profile'
import { cn } from '@/lib/utils'

// Utility functions
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buongiorno'
  if (hour < 17) return 'Buon pomeriggio'
  return 'Buonasera'
}

function getStreakEmoji(count: number) {
  if (count >= 30) return '🔥'
  if (count >= 14) return '⚡'
  if (count >= 7) return '💪'
  if (count >= 3) return '🌟'
  return '✨'
}

// Sophisticated Stats Card Component
interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    label: string
  }
}

function StatsCard({ title, value, subtitle, icon: Icon, trend }: StatsCardProps) {
  return (
    <Card className={cn(
      "group relative overflow-hidden",
      "border border-white/20 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50",
      "hover:bg-white/70 hover:shadow-md",
      "transition-all duration-200"
    )}>
      <CardContent className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div className="rounded-lg bg-[#5D62E1] p-2">
            <Icon className="h-4 w-4 text-white" />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-[#5D62E1]">
              <TrendingUp className="h-3 w-3" />
              <span className="text-xs font-semibold">
                +{trend.value}
              </span>
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// Minimalist Course Card Component
interface CourseCardProps {
  course: {
    id: string
    title: string
    description?: string | null
    imageUrl?: string | null
    category?: { name: string } | null
    progress?: number
    enrollmentStatus?: string
    estimatedDurationMinutes?: number | null
  }
  isEnrolled?: boolean
}

function CourseCard({ course, isEnrolled = false }: CourseCardProps) {
  const href = isEnrolled ? `/courses/${course.id}` : `/library/courses/${course.id}`
  
  return (
    <Link href={href} className="group block">
      <div className={cn(
        "relative p-6",
        "border border-white/30 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50",
        "transition-all duration-200 hover:bg-white/70 hover:shadow-sm"
      )}>
        {/* Progress indicator bar - only for enrolled courses */}
        {isEnrolled && typeof course.progress === 'number' && (
          <div className="absolute left-0 right-0 top-0 h-1 bg-white/30">
            <div 
              className="h-full bg-[#5D62E1] transition-all duration-300" 
              style={{ width: `${course.progress}%` }}
            />
          </div>
        )}
        
        <div className="space-y-4">
          {/* Meta and Category */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {course.category && (
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                  {course.category.name}
                </span>
              )}
              {course.category && course.estimatedDurationMinutes && (
                <span className="text-gray-300">•</span>
              )}
              {course.estimatedDurationMinutes && (
                <span className="text-xs text-gray-500">
                  {Math.round(course.estimatedDurationMinutes / 60)}h
                </span>
              )}
            </div>
            
            <ArrowUpRight className="h-4 w-4 text-gray-400 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#5D62E1]" />
          </div>
          
          {/* Title */}
          <h3 className="leading-tight text-lg font-semibold text-gray-900 group-hover:text-[#5D62E1]">
            {course.title}
          </h3>
          
          {/* Description */}
          {course.description && (
            <p className="line-clamp-2 leading-relaxed text-sm text-gray-600">
              {course.description}
            </p>
          )}
          
          {/* Progress for enrolled courses */}
          {isEnrolled && typeof course.progress === 'number' && (
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-gray-900">{course.progress}%</span>
                  <span className="text-xs text-gray-500">completato</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Status indicator */}
          {!isEnrolled && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Circle className="h-2 w-2 fill-[#5D62E1] text-[#5D62E1]" />
              <span>Disponibile</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
// Minimalist Calendar Component
interface CalendarProps {
  upcomingCount: number
}

function MinimalCalendar({ upcomingCount }: CalendarProps) {
  const today = new Date()
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i))
  
  const monthYear = format(today, 'MMMM yyyy', { locale: it })
  const dayNames = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

return (
    <Card className="border border-white/20 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900 capitalize">
            {monthYear}
          </CardTitle>
          {upcomingCount > 0 && (
            <Badge variant="secondary" className="bg-[#5D62E1] text-white hover:bg-[#5055c9]">
              {upcomingCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Week View */}
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((day, i) => (
            <div key={day} className="text-center space-y-2">
              <div className="text-xs font-medium text-gray-500">{day}</div>
              <div
                className={cn(
                  "w-8 h-8 flex items-center justify-center text-sm font-medium",
                  "transition-colors duration-200",
isToday(weekDays[i])
                    ? "rounded-md bg-[#5D62E1] text-white"
                    : "rounded-md text-gray-600 hover:bg-white/50"
                )}
              >
                {format(weekDays[i], 'd')}
              </div>
            </div>
          ))}
        </div>
        
        {/* Upcoming sessions */}
        {upcomingCount > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Sessioni in programma</span>
                <span className="font-semibold text-gray-900">{upcomingCount}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Minimalist Achievement Card Component
interface AchievementCardProps {
  badges: Array<{
    id: string
    badge: {
      name: string
      description?: string | null
    }
    awardedAt: Date
  }>
}

function MinimalAchievementCard({ badges }: AchievementCardProps) {
return (
    <Card className="border border-white/20 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-gray-900">
          Achievement recenti
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badges.length > 0 ? (
          <div className="space-y-3">
            {badges.slice(0, 4).map((userBadge, index) => (
              <div 
                key={userBadge.id} 
                className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
              >
<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-[#5D62E1]">
                  <Trophy className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{userBadge.badge.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {format(userBadge.awardedAt, 'd MMM yyyy', { locale: it })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
              <Trophy className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">Nessun achievement</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Minimalist Quick Actions Component
function QuickActions() {
  const actions = [
    {
      label: 'Libreria corsi',
      icon: BookOpen,
      href: '/library',
    },
    {
      label: 'I miei corsi',
      icon: GraduationCap,
      href: '/courses',
    },
    {
      label: 'Live Sessions',
      icon: Users,
      href: '/live-sessions',
    },
    {
      label: 'Gamification',
      icon: Trophy,
      href: '/gamification',
    },
  ]

return (
    <Card className="border border-white/20 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
      <CardContent className="p-4">
        <div className="space-y-2">
          {actions.map((action) => {
            const Icon = action.icon
            return (
<Link key={action.href} href={action.href}>
                <div className="group flex items-center justify-between rounded-md p-3 transition-colors hover:bg-white/50">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">{action.label}</span>
                  </div>
<ArrowUpRight className="h-4 w-4 text-gray-400 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#5D62E1]" />
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function Dashboard() {
  const { profile, company, organizationId } = await requireAuthContext()

  if (!organizationId) {
    return redirect('/onboarding')
  }

  // Fetch all data
  const [
    { coursesInProgress, completedCourses },
    availableCourses,
    upcomingSessions,
    earnedBadges,
  ] = await Promise.all([
    getDashboardCourses(profile.id),
    db.course.findMany({
      where: {
        companyId: company.id,
        isPublished: true,
        enrollments: {
          none: {
            userProfileId: profile.id,
          },
        },
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    db.liveSession.findMany({
      where: { companyId: company.id, scheduledFor: { gte: new Date() } },
      include: {
        course: { select: { title: true } },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 3,
    }),
    db.userBadge.findMany({
      where: { userProfileId: profile.id },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
      take: 6,
    }),
  ])

  const inProgressCourses = coursesInProgress.map((enrollment) => ({
    ...enrollment.course,
    progress: enrollment.progress,
    enrollmentStatus: enrollment.status,
  }))

  const completedCoursesData = completedCourses.map((enrollment) => ({
    ...enrollment.course,
    progress: enrollment.progress,
    enrollmentStatus: enrollment.status,
  }))

  const userName = profile.userId.includes('_') 
    ? profile.userId.split('_')[1] 
    : profile.userId.split('@')[0] || 'Utente'

  // Calculate dynamic stats
  const totalActiveCourses = coursesInProgress.length
  const totalCompleted = completedCourses.length
  const totalBadges = earnedBadges.length
  const streakDays = profile.streakCount
  
  // Calculate trends (using real data)
  const recentCompletions = completedCourses.filter(
    (c) => c.completedAt && new Date(c.completedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
  ).length
  
  const recentBadges = earnedBadges.filter(
    (b) => new Date(b.awardedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
  ).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
        
        {/* Minimalist Hero Section */}
        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              {getGreeting()}, {userName}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <p className="text-base text-gray-600 capitalize">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: it })}
            </p>
            {streakDays > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-900">{streakDays} giorni consecutivi</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats Grid with dynamic data */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Corsi Attivi"
            value={totalActiveCourses}
            subtitle={totalActiveCourses === 1 ? "corso in progresso" : "corsi in progresso"}
            icon={BookOpen}
          />
          <StatsCard
            title="Completati"
            value={totalCompleted}
            subtitle={totalCompleted === 1 ? "corso completato" : "corsi completati"}
            icon={GraduationCap}
            trend={recentCompletions > 0 ? { value: recentCompletions, label: "questo mese" } : undefined}
          />
          <StatsCard
            title="Achievement"
            value={totalBadges}
            subtitle={totalBadges === 1 ? "badge sbloccato" : "badge sbloccati"}
            icon={Award}
            trend={recentBadges > 0 ? { value: recentBadges, label: "questo mese" } : undefined}
          />
          <StatsCard
            title="Streak"
            value={`${streakDays}`}
            subtitle={streakDays === 1 ? "giorno consecutivo" : "giorni consecutivi"}
            icon={Flame}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Innovative View Switcher - Disruptive Navigation */}
            <div className="space-y-8">
              {/* Dynamic section header based on active courses */}
              {inProgressCourses.length > 0 ? (
                <section className="space-y-6">
                  <div className="flex items-end justify-between border-b border-gray-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
<div className="h-4 w-1 bg-[#5D62E1]" />
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">In Corso</h2>
                      </div>
                      <p className="text-sm text-gray-600">
                        {inProgressCourses.length} {inProgressCourses.length === 1 ? 'corso attivo' : 'corsi attivi'}
                      </p>
                    </div>
                    <Link 
                      href="/courses"
                      className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors flex items-center gap-1"
                    >
                      Vedi tutti
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    {inProgressCourses.slice(0, 4).map((course) => (
                      <CourseCard key={course.id} course={course} isEnrolled={true} />
                    ))}
                  </div>
                </section>
              ) : null}
              
              {/* Available Courses Section */}
              <section className="space-y-6">
                <div className="flex items-end justify-between border-b border-gray-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
<div className="h-4 w-1 bg-[#5D62E1]" />
                      <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {inProgressCourses.length > 0 ? 'Esplora Catalogo' : 'Inizia Ora'}
                      </h2>
                    </div>
                    <p className="text-sm text-gray-600">
                      {availableCourses.length} {availableCourses.length === 1 ? 'corso disponibile' : 'corsi disponibili'}
                    </p>
                  </div>
                  <Link 
                    href="/library"
                    className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors flex items-center gap-1"
                  >
                    Catalogo completo
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
                
                {availableCourses.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {availableCourses.slice(0, inProgressCourses.length > 0 ? 4 : 6).map((course) => (
                      <CourseCard key={course.id} course={course} isEnrolled={false} />
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun corso disponibile</h3>
                    <p className="text-sm text-gray-600 max-w-sm mx-auto">
                      Non ci sono nuovi corsi al momento. Controlla più tardi.
                    </p>
                  </div>
                )}
              </section>
              
              {/* Completed Courses - Collapsed View */}
              {completedCoursesData.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-end justify-between border-b border-gray-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
<div className="h-4 w-1 bg-[#5D62E1]/50" />
                        <h2 className="text-xl font-semibold tracking-tight text-gray-900">Completati</h2>
                      </div>
                      <p className="text-sm text-gray-600">
                        {completedCoursesData.length} {completedCoursesData.length === 1 ? 'corso completato' : 'corsi completati'}
                      </p>
                    </div>
                    <Link 
                      href="/courses"
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
                    >
                      Mostra tutti
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                  
                  <div className="space-y-3">
                    {completedCoursesData.slice(0, 3).map((course) => (
                      <Link key={course.id} href={`/courses/${course.id}`}>
                        <div className="flex items-center justify-between p-4 border border-gray-200 hover:border-gray-900/40 hover:bg-gray-50 transition-all group">
                          <div className="flex items-center gap-3 min-w-0">
<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[#5D62E1]">
                              <GraduationCap className="h-4 w-4 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
                              {course.category && (
                                <p className="text-xs text-gray-500 uppercase tracking-wider">{course.category.name}</p>
                              )}
                            </div>
                          </div>
<ArrowUpRight className="ml-2 h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-[#5D62E1]" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            
            {/* Profile Card */}
<Card className="border border-white/20 bg-white/60 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
<Avatar className="h-14 w-14 ring-2 ring-[#5D62E1]/20">
                    <AvatarImage src={profile.avatarUrl || undefined} />
<AvatarFallback className="bg-[#5D62E1] text-white font-semibold text-base">
                      {userName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-base text-gray-900">{userName}</h3>
                    {profile.jobTitle && (
                      <p className="text-sm text-gray-600">{profile.jobTitle}</p>
                    )}
                    {profile.department && (
                      <p className="text-xs text-gray-500 uppercase tracking-wider">{profile.department}</p>
                    )}
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Punti totali</span>
                  <div className="flex items-center gap-1.5">
<Star className="h-4 w-4 text-[#5D62E1] fill-[#5D62E1]" />
                    <span className="text-sm font-semibold text-gray-900">{profile.points}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <QuickActions />

            {/* Calendar */}
            <MinimalCalendar upcomingCount={upcomingSessions.length} />

            {/* Achievements */}
            <MinimalAchievementCard badges={earnedBadges} />

          </div>
        </div>
      </div>
    </div>
  )
}
