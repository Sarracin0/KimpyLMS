'use client'

import { useState, useEffect } from 'react'
import { UserRole, CourseEnrollmentStatus } from '@prisma/client'
import { Users, Search, Calendar, Loader2, CheckCircle2, AlertCircle, UserMinus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'

type AvailableMember = {
  id: string
  userId: string
  role: UserRole
  jobTitle: string | null
  department: string | null
  avatarUrl: string | null
  points: number
  streakCount: number
  teams?: { id: string; name: string }[]
}

type MembersByRole = {
  HR_ADMIN: AvailableMember[]
  TRAINER: AvailableMember[]
  LEARNER: AvailableMember[]
}

type EnrolledParticipant = {
  id: string
  status: CourseEnrollmentStatus
  enrolledAt: string
  dueDate: string | null
  completedAt: string | null
  userProfile: {
    id: string
    userId: string
    role: UserRole
    jobTitle: string | null
    department: string | null
    avatarUrl: string | null
    points: number
    streakCount: number
  }
  progress: {
    completedChapters: number
    totalChapters: number
    percentage: number
  }
}

interface AddParticipantsModalProps {
  courseId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const roleLabels = {
  HR_ADMIN: 'HR Admin',
  TRAINER: 'Trainer',
  LEARNER: 'Learner',
}

const roleBadgeVariants = {
  HR_ADMIN: 'destructive' as const,
  TRAINER: 'default' as const,
  LEARNER: 'secondary' as const,
}

export function AddParticipantsModal({ courseId, isOpen, onClose, onSuccess }: AddParticipantsModalProps) {
  const [activeTab, setActiveTab] = useState('add')
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([])
  const [membersByRole, setMembersByRole] = useState<MembersByRole>({
    HR_ADMIN: [],
    TRAINER: [],
    LEARNER: [],
  })
  const [enrolledParticipants, setEnrolledParticipants] = useState<EnrolledParticipant[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [enrolledSearchQuery, setEnrolledSearchQuery] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Teams tab state
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [teams, setTeams] = useState<{ id: string; name: string; description?: string | null; memberCount: number; totalPoints: number }[]>([])

  // Carica i dati quando il modal si apre o cambia tab
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'add') {
        loadAvailableMembers()
      } else if (activeTab === 'enrolled') {
        loadEnrolledParticipants()
      } else if (activeTab === 'teams') {
        loadTeams()
      }
    }
  }, [isOpen, activeTab, courseId])

  // Reset quando il modal si chiude
  useEffect(() => {
    if (!isOpen) {
      setSelectedMembers(new Set())
      setSearchQuery('')
      setDueDate('')
    }
  }, [isOpen])

  const loadAvailableMembers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/courses/${courseId}/available-members`)
      if (!response.ok) throw new Error('Errore nel caricamento dei membri')
      
      const data = await response.json()
      setAvailableMembers(data.availableMembers)
      setMembersByRole(data.membersByRole)
    } catch (error) {
      console.error('Errore nel caricamento dei membri:', error)
      toast.error('Errore nel caricamento dei membri disponibili')
    } finally {
      setIsLoading(false)
    }
  }

  const loadEnrolledParticipants = async () => {
    setIsLoadingEnrolled(true)
    try {
      const response = await fetch(`/api/courses/${courseId}/participants`)
      if (!response.ok) throw new Error('Errore nel caricamento dei partecipanti')
      
      const data = await response.json()
      setEnrolledParticipants(data.enrollments || [])
    } catch (error) {
      console.error('Errore nel caricamento dei partecipanti:', error)
      toast.error('Errore nel caricamento dei partecipanti iscritti')
      setEnrolledParticipants([]) // Imposta array vuoto in caso di errore
    } finally {
      setIsLoadingEnrolled(false)
    }
  }

  const loadTeams = async () => {
    setIsLoadingTeams(true)
    try {
      const response = await fetch('/api/teams')
      if (!response.ok) throw new Error('Errore nel caricamento dei team')
      const data = await response.json()
      // Prepara statistiche rapide lato client (count membri e somma punti)
      const mapped = (data || []).map((t: any) => {
        const memberCount = t.memberships?.length || 0
        const totalPoints = (t.memberships || []).reduce((acc: number, m: any) => acc + (m.userProfile?.points || 0), 0)
        return { id: t.id, name: t.name, description: t.description, memberCount, totalPoints }
      })
      setTeams(mapped)
    } catch (error) {
      console.error('Errore nel caricamento dei team:', error)
      toast.error('Errore nel caricamento dei team')
    } finally {
      setIsLoadingTeams(false)
    }
  }

  const handleMemberToggle = (memberId: string) => {
    const newSelected = new Set(selectedMembers)
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId)
    } else {
      newSelected.add(memberId)
    }
    setSelectedMembers(newSelected)
  }

  const handleSelectAll = (role: UserRole) => {
    const roleMembers = membersByRole[role]
    const filteredMembers = filterMembersBySearch(roleMembers)
    const newSelected = new Set(selectedMembers)
    
    const allSelected = filteredMembers.every(member => newSelected.has(member.id))
    
    if (allSelected) {
      // Deseleziona tutti i membri di questo ruolo
      filteredMembers.forEach(member => newSelected.delete(member.id))
    } else {
      // Seleziona tutti i membri di questo ruolo
      filteredMembers.forEach(member => newSelected.add(member.id))
    }
    
    setSelectedMembers(newSelected)
  }

  const filterMembersBySearch = (members: AvailableMember[]) => {
    if (!searchQuery) return members
    
    const query = searchQuery.toLowerCase()
    return members.filter(member => 
      member.jobTitle?.toLowerCase().includes(query) ||
      member.department?.toLowerCase().includes(query)
    )
  }

  const handleSubmit = async () => {
    if (selectedMembers.size === 0) {
      toast.error('Seleziona almeno un membro da aggiungere')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/courses/${courseId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfileIds: Array.from(selectedMembers),
          dueDate: dueDate || null,
        }),
      })

      if (!response.ok) throw new Error('Errore nell\'aggiunta dei partecipanti')
      
      const data = await response.json()
      toast.success(data.message)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Errore nell\'aggiunta dei partecipanti:', error)
      toast.error('Errore nell\'aggiunta dei partecipanti')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filterEnrolledParticipants = (participants: EnrolledParticipant[]) => {
    if (!enrolledSearchQuery) return participants
    const query = enrolledSearchQuery.toLowerCase()
    return participants.filter(participant => 
      participant.userProfile.jobTitle?.toLowerCase().includes(query) ||
      participant.userProfile.department?.toLowerCase().includes(query)
    )
  }

  const handleRemoveParticipant = async (enrollmentId: string) => {
    if (!confirm('Sei sicuro di voler rimuovere questo partecipante dal corso?')) {
      return
    }

    try {
      const response = await fetch(`/api/courses/${courseId}/enrollments/${enrollmentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Errore nella rimozione del partecipante')
      
      toast.success('Partecipante rimosso con successo')
      loadEnrolledParticipants() // Ricarica la lista
      onSuccess() // Notifica il parent component
    } catch (error) {
      console.error('Errore nella rimozione del partecipante:', error)
      toast.error('Errore nella rimozione del partecipante')
    }
  }

  const renderMemberCard = (member: AvailableMember) => {
    const isSelected = selectedMembers.has(member.id)
    const initials = member.jobTitle 
      ? member.jobTitle.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
      : member.role.slice(0, 2)

    return (
      <div
        key={member.id}
        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
          isSelected 
            ? 'border-primary bg-primary/5 shadow-sm' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50 hover:shadow-sm'
        }`}
        onClick={() => handleMemberToggle(member.id)}
      >
        <Checkbox
          checked={isSelected}
          onChange={() => handleMemberToggle(member.id)}
          className="pointer-events-none"
        />
        
        <Avatar className="h-8 w-8">
          <AvatarImage src={member.avatarUrl || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">
              {member.jobTitle || 'Nessun titolo'}
            </p>
            <Badge variant={roleBadgeVariants[member.role]} className="text-xs">
              {roleLabels[member.role]}
            </Badge>
            {(member.teams || []).map((t) => (
              <Badge key={t.id} variant="outline" className="text-[10px] text-muted-foreground">
                {t.name}
              </Badge>
            ))}
          </div>
          {member.department && (
            <p className="text-xs text-muted-foreground truncate">{member.department}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">
              {member.points} punti
            </span>
            <span className="text-xs text-muted-foreground">
              {member.streakCount} giorni streak
            </span>
          </div>
        </div>
      </div>
    )
  }

  const renderEnrolledParticipantCard = (participant: EnrolledParticipant) => {
    const { userProfile, progress, status, enrolledAt, dueDate, completedAt } = participant
    const initials = userProfile.jobTitle 
      ? userProfile.jobTitle.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)
      : userProfile.role.slice(0, 2)

    const getStatusBadge = () => {
      switch (status) {
        case 'COMPLETED':
          return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Completato</Badge>
        case 'IN_PROGRESS':
          return <Badge variant="secondary" className="text-xs">In Corso</Badge>
        case 'NOT_STARTED':
          return <Badge variant="outline" className="text-xs">Non Iniziato</Badge>
        default:
          return <Badge variant="outline" className="text-xs">{status}</Badge>
      }
    }

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }

    return (
      <div key={participant.id} className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all">
        <Avatar className="h-10 w-10">
          <AvatarImage src={userProfile.avatarUrl || undefined} />
          <AvatarFallback className="text-sm">{initials}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium truncate">
              {userProfile.jobTitle || 'Nessun titolo'}
            </p>
            <Badge variant={roleBadgeVariants[userProfile.role]} className="text-xs">
              {roleLabels[userProfile.role]}
            </Badge>
            {getStatusBadge()}
          </div>
          
          {userProfile.department && (
            <p className="text-xs text-muted-foreground truncate mb-2">{userProfile.department}</p>
          )}
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progresso</span>
              <span className="text-xs font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {progress.completedChapters} di {progress.totalChapters} capitoli completati
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Iscritto: {formatDate(enrolledAt)}</span>
            {dueDate && <span>Scadenza: {formatDate(dueDate)}</span>}
            {completedAt && <span>Completato: {formatDate(completedAt)}</span>}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRemoveParticipant(participant.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const renderRoleSection = (role: UserRole) => {
    const roleMembers = filterMembersBySearch(membersByRole[role])
    if (roleMembers.length === 0) return null

    const selectedInRole = roleMembers.filter(member => selectedMembers.has(member.id)).length
    const allSelected = selectedInRole === roleMembers.length

    return (
      <Card key={role}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant={roleBadgeVariants[role]}>{roleLabels[role]}</Badge>
              <span className="text-sm text-muted-foreground">
                ({roleMembers.length} disponibili)
              </span>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectAll(role)}
              className="text-xs"
            >
              {allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </Button>
          </div>
          {selectedInRole > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedInRole} di {roleMembers.length} selezionati
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {roleMembers.map(renderMemberCard)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-xl border bg-card shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestione Partecipanti del Corso
          </DialogTitle>
          <DialogDescription>
            Aggiungi nuovi partecipanti o gestisci quelli già iscritti al corso.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 bg-muted/40 p-1 rounded-lg">
            <TabsTrigger value="add" className="flex items-center gap-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="h-4 w-4" />
              Aggiungi Partecipanti
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="h-4 w-4" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="enrolled" className="flex items-center gap-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <UserMinus className="h-4 w-4" />
              Partecipanti Iscritti
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            {/* Barra di ricerca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per titolo o dipartimento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-md focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            {/* Data di scadenza opzionale */}
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data di scadenza (opzionale)
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full"
              />
            </div>

            <Separator />

            {/* Lista membri disponibili */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Caricamento membri...</span>
                </div>
              ) : availableMembers.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nessun membro disponibile</h3>
                  <p className="text-muted-foreground">
                    Tutti i membri dell'organizzazione sono già iscritti a questo corso.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.values(UserRole).map(renderRoleSection)}
                </div>
              )}
            </div>

            {/* Footer per tab Aggiungi */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                {selectedMembers.size} membri selezionati
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Annulla
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={selectedMembers.size === 0 || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Aggiungendo...
                    </>
                  ) : (
                    `Aggiungi ${selectedMembers.size} partecipanti`
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="teams" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            <div className="flex-1 overflow-y-auto space-y-3">
              {isLoadingTeams ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Caricamento team...</span>
                </div>
              ) : teams.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nessun team disponibile</h3>
                  <p className="text-muted-foreground">Crea un team dalla sezione Team Management.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teams.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 hover:shadow-sm transition-all">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.name}</p>
                        {t.description ? (
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        ) : null}
                        <div className="text-xs text-muted-foreground mt-1">
                          {t.memberCount} membri • {t.totalPoints} punti totali
                        </div>
                      </div>
                      <Button
                        size="sm"
                        aria-label={`Aggiungi il team ${t.name} al corso`}
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/courses/${courseId}/teams`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ teamId: t.id }),
                            })
                            if (!res.ok) throw new Error('Errore nell\'assegnazione del team')
                            toast.success('Team assegnato al corso')
                            onSuccess()
                          } catch (e) {
                            console.error(e)
                            toast.error('Errore nell\'assegnazione del team')
                          }
                        }}
                      >
                        Aggiungi team
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="enrolled" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            {/* Barra di ricerca per partecipanti iscritti */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca partecipanti iscritti..."
                value={enrolledSearchQuery}
                onChange={(e) => setEnrolledSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-md focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            <Separator />

            {/* Lista partecipanti iscritti */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {isLoadingEnrolled ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Caricamento partecipanti...</span>
                </div>
              ) : (enrolledParticipants || []).length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nessun partecipante iscritto</h3>
                  <p className="text-muted-foreground">
                    Non ci sono ancora partecipanti iscritti a questo corso.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filterEnrolledParticipants(enrolledParticipants || []).map(renderEnrolledParticipantCard)}
                </div>
              )}
            </div>

            {/* Footer per tab Iscritti */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {(enrolledParticipants || []).length} partecipanti iscritti
              </div>
              <Button variant="outline" onClick={onClose}>
                Chiudi
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}