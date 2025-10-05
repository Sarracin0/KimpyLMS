'use client'

import { useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useParams } from 'next/navigation'
import {
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Cast,
  ListChecks,
  Video,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { VideoInput } from './video-input'
import { UploadDropzone } from '@/lib/uploadthing'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GamificationStudio } from './gamification-studio'

export type VirtualClassroomConfig = {
  provider?: string
  meetingId?: string
  joinUrl?: string | null
  dialNumber?: string
  status?: string
  scheduledFor?: string
}

export type Module = {
  id: string
  title: string
  description?: string
  position: number
  isPublished: boolean
  lessons: Lesson[]
}

export type Lesson = {
  id: string
  title: string
  description?: string
  position: number
  isPublished: boolean
  blocks: LessonBlock[]
}

export type LessonBlock = {
  id: string
  type: 'VIDEO_LESSON' | 'RESOURCES' | 'LIVE_SESSION' | 'QUIZ' | 'GAMIFICATION'
  title: string
  content?: string
  videoUrl?: string
  contentUrl?: string
  position: number
  isPublished: boolean
  liveSessionConfig?: VirtualClassroomConfig | null
  attachments?: { id: string; name: string; url: string; type: string | null }[]
  quizSummary?: {
    id: string
    title: string
    questionCount: number
    pointsReward: number
  } | null
  gamification?: {
    id: string
    status: import('@prisma/client').GamificationStatus
    contentType: import('@prisma/client').GamificationContentType
    quizId: string | null
    sourceAttachmentIds: string[]
    config: Record<string, unknown> | null
    flashcardDeck: {
      id: string
      title: string
      description?: string | null
      cardCount: number
      cards: { id: string; front: string; back: string; points: number; position: number }[]
    } | null
    quizSummary: {
      id: string
      title: string
      questionCount: number
      pointsReward: number
    } | null
  } | null
}

type ResourceInputMode = 'upload' | 'link'

const gamificationStatusStyles: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  GENERATING: 'bg-amber-100 text-amber-700',
  READY: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
}

interface ModuleAccordionProps {
  module: Module
  onUpdateModule: (moduleId: string, data: Partial<Module>) => void
  onDeleteModule: (moduleId: string) => void
  onPersistModule: (moduleId: string, overrides?: Partial<Module>) => void
  onAddLesson: (moduleId: string) => void
  onUpdateLesson: (moduleId: string, lessonId: string, data: Partial<Lesson>) => void
  onDeleteLesson: (moduleId: string, lessonId: string) => void
  onPersistLesson: (moduleId: string, lessonId: string, overrides?: Partial<Lesson>) => void
  onAddBlock: (
    moduleId: string,
    lessonId: string,
    type: 'VIDEO_LESSON' | 'RESOURCES' | 'LIVE_SESSION' | 'QUIZ' | 'GAMIFICATION',
  ) => void
  onUpdateBlock: (moduleId: string, lessonId: string, blockId: string, data: Partial<LessonBlock>) => void
  onDeleteBlock: (moduleId: string, lessonId: string, blockId: string) => void
  onPersistBlock: (moduleId: string, lessonId: string, blockId: string, overrides?: Partial<LessonBlock>) => void
  onReplaceBlock: (moduleId: string, lessonId: string, blockId: string, block: LessonBlock) => void
  onCreateAttachment: (
    moduleId: string,
    lessonId: string,
    blockId: string,
    payload: { url: string; name?: string | null; type?: string | null },
  ) => Promise<void>
  onDeleteAttachment: (moduleId: string, lessonId: string, blockId: string, attachmentId: string) => Promise<void>
}

export const ModuleAccordion = ({
  module,
  onUpdateModule,
  onDeleteModule,
  onPersistModule,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onPersistLesson,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  onPersistBlock,
  onReplaceBlock,
  onCreateAttachment,
  onDeleteAttachment,
}: ModuleAccordionProps) => {
  const params = useParams() as { courseId?: string }
  const courseId = params?.courseId ?? ''
  // Stati di editing
  const [editingModule, setEditingModule] = useState<{ field: 'title' | 'description' | null }>({ field: null })
  const [editingLesson, setEditingLesson] = useState<{ id: string; field: 'title' | 'description' } | null>(null)
  const [editingBlock, setEditingBlock] = useState<{
    lessonId: string
    id: string
    field: 'title' | 'content' | 'videoUrl' | 'contentUrl'
  } | null>(null)

  const [pendingAttachmentBlockId, setPendingAttachmentBlockId] = useState<string | null>(null)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)

  // Stati degli accordion - sempre aperti di default per evitare problemi
  const [moduleOpen, setModuleOpen] = useState(true)
  const [openLessons, setOpenLessons] = useState<Set<string>>(new Set())

  // Refs per focus management
  const moduleInputRef = useRef<HTMLInputElement>(null)
  const moduleTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Helper per gestire apertura lezioni
  const toggleLesson = useCallback((lessonId: string) => {
    setOpenLessons(prev => {
      const newSet = new Set(prev)
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId)
      } else {
        newSet.add(lessonId)
      }
      return newSet
    })
  }, [])

  const ensureLessonOpen = useCallback((lessonId: string) => {
    setOpenLessons(prev => new Set(prev).add(lessonId))
  }, [])

  // Handlers per module
  const handleModuleEdit = useCallback((field: 'title' | 'description') => {
    setEditingModule({ field })
    setModuleOpen(true)

    // Focus dopo il re-render
    requestAnimationFrame(() => {
      if (field === 'title') {
        moduleInputRef.current?.focus()
      } else {
        moduleTextareaRef.current?.focus()
      }
    })
  }, [])

  const handleModuleUpdate = useCallback((field: keyof Module, value: string | boolean) => {
    onUpdateModule(module.id, { [field]: value })
  }, [module.id, onUpdateModule])

  const handleModuleSave = useCallback(() => {
    if (editingModule.field) {
      onPersistModule(module.id)
    }
    setEditingModule({ field: null })
  }, [editingModule.field, module.id, onPersistModule])

  const handleModulePublishToggle = useCallback(() => {
    const nextStatus = !module.isPublished
    onUpdateModule(module.id, { isPublished: nextStatus })
    onPersistModule(module.id, { isPublished: nextStatus })
  }, [module.id, module.isPublished, onPersistModule, onUpdateModule])

  // Handlers per lesson
  const handleLessonEdit = useCallback((lessonId: string, field: 'title' | 'description') => {
    setEditingLesson({ id: lessonId, field })
    ensureLessonOpen(lessonId)
    setModuleOpen(true)
  }, [ensureLessonOpen])

  const handleLessonUpdate = useCallback((lessonId: string, field: keyof Lesson, value: string | boolean) => {
    onUpdateLesson(module.id, lessonId, { [field]: value })
  }, [module.id, onUpdateLesson])

  const handleLessonSave = useCallback(() => {
    if (editingLesson) {
      onPersistLesson(module.id, editingLesson.id)
    }
    setEditingLesson(null)
  }, [editingLesson, module.id, onPersistLesson])

  const handleLessonTogglePublish = useCallback(
    (lessonId: string, nextStatus: boolean) => {
      onUpdateLesson(module.id, lessonId, { isPublished: nextStatus })
      onPersistLesson(module.id, lessonId, { isPublished: nextStatus })
    },
    [module.id, onPersistLesson, onUpdateLesson],
  )

  // Handlers per block
  const handleBlockEdit = useCallback(
    (lessonId: string, blockId: string, field: 'title' | 'content' | 'videoUrl' | 'contentUrl') => {
      setEditingBlock({ lessonId, id: blockId, field })
    },
    []
  )

  const handleBlockUpdate = useCallback((lessonId: string, blockId: string, field: keyof LessonBlock, value: string | boolean) => {
    onUpdateBlock(module.id, lessonId, blockId, { [field]: value })
  }, [module.id, onUpdateBlock])

  const handleBlockSave = useCallback(() => {
    if (editingBlock) {
      onPersistBlock(module.id, editingBlock.lessonId, editingBlock.id)
    }
    setEditingBlock(null)
  }, [editingBlock, module.id, onPersistBlock])

  const handleBlockTogglePublish = useCallback(
    (lessonId: string, blockId: string, nextStatus: boolean) => {
      onUpdateBlock(module.id, lessonId, blockId, { isPublished: nextStatus })
      onPersistBlock(module.id, lessonId, blockId, { isPublished: nextStatus })
    },
    [module.id, onPersistBlock, onUpdateBlock],
  )

  const handleBlockAttachmentUpload = useCallback(
    async (
      lessonId: string,
      blockId: string,
      file?: { url?: string | null; ufsUrl?: string | null; appUrl?: string | null; name?: string | null; type?: string | null },
    ) => {
      if (!file) return
      const url = (file.ufsUrl ?? file.url ?? file.appUrl)?.toString()
      if (!url) {
        toast.error('Upload failed, missing file URL')
        return
      }

      setPendingAttachmentBlockId(blockId)
      try {
        await onCreateAttachment(module.id, lessonId, blockId, {
          url,
          name: file.name ?? null,
          type: file.type ?? null,
        })
      } catch {
        // Error feedback handled upstream
      } finally {
        setPendingAttachmentBlockId((current) => (current === blockId ? null : current))
      }
    },
    [module.id, onCreateAttachment],
  )

  const handleBlockAttachmentDelete = useCallback(
    async (lessonId: string, blockId: string, attachmentId: string) => {
      setDeletingAttachmentId(attachmentId)
      try {
        await onDeleteAttachment(module.id, lessonId, blockId, attachmentId)
      } catch {
        // Error feedback handled upstream
      } finally {
        setDeletingAttachmentId((current) => (current === attachmentId ? null : current))
      }
    },
    [module.id, onDeleteAttachment],
  )

  // Gestione keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent, saveHandler: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveHandler()
    } else if (e.key === 'Escape') {
      saveHandler()
    }
  }, [])

  return (
    <div className="border border-border/60 rounded-lg">
      {/* Module Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModuleOpen(!moduleOpen)}
            className="h-auto p-1"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${moduleOpen ? '' : '-rotate-90'}`} />
          </Button>

          <div className="flex items-center gap-2">
            {editingModule.field === 'title' ? (
              <Input
                ref={moduleInputRef}
                value={module.title}
                onChange={(e) => handleModuleUpdate('title', e.target.value)}
                onBlur={handleModuleSave}
                onKeyDown={(e) => handleKeyDown(e, handleModuleSave)}
                className="h-8 font-semibold"
                autoFocus
              />
            ) : (
              <h3
                className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleModuleEdit('title')}
              >
                {module.title}
              </h3>
            )}
          </div>

          <Badge variant={module.isPublished ? 'default' : 'secondary'} className="text-xs">
            {module.isPublished ? 'Published' : 'Draft'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleModulePublishToggle}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
            title={module.isPublished ? 'Unpublish module' : 'Publish module'}
            aria-label={module.isPublished ? 'Unpublish module' : 'Publish module'}
          >
            {module.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => onAddLesson(module.id)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleModuleEdit('title')}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDeleteModule(module.id)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Module Content */}
      {moduleOpen && (
        <div className="p-4 space-y-4">
          {/* Module Description */}
          <div>
            {editingModule.field === 'description' ? (
              <Textarea
                ref={moduleTextareaRef}
                value={module.description || ''}
                onChange={(e) => handleModuleUpdate('description', e.target.value)}
                onBlur={handleModuleSave}
                onKeyDown={(e) => handleKeyDown(e, handleModuleSave)}
                placeholder="Module description..."
                className="min-h-[60px] text-sm"
                autoFocus
              />
            ) : (
              <p
                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleModuleEdit('description')}
              >
                {module.description || 'Click to add description...'}
              </p>
            )}
          </div>

          {/* Lessons */}
          <div className="space-y-2">
            {module.lessons.map((lesson) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              moduleId={module.id}
              isOpen={openLessons.has(lesson.id)}
              editingLesson={editingLesson}
              editingBlock={editingBlock}
              pendingAttachmentBlockId={pendingAttachmentBlockId}
              deletingAttachmentId={deletingAttachmentId}
              onToggle={() => toggleLesson(lesson.id)}
              onLessonEdit={handleLessonEdit}
              onLessonUpdate={handleLessonUpdate}
              onLessonSave={handleLessonSave}
              onLessonTogglePublish={handleLessonTogglePublish}
              onBlockEdit={handleBlockEdit}
              onBlockUpdate={handleBlockUpdate}
              onBlockSave={handleBlockSave}
              onBlockTogglePublish={handleBlockTogglePublish}
              onAddBlock={onAddBlock}
              onReplaceBlock={onReplaceBlock}
              onDeleteLesson={onDeleteLesson}
              onDeleteBlock={onDeleteBlock}
              handleBlockAttachmentUpload={handleBlockAttachmentUpload}
              handleBlockAttachmentDelete={handleBlockAttachmentDelete}
              handleKeyDown={handleKeyDown}
              courseId={courseId}
            />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Componente separato per le lezioni per migliorare performance e isolation
interface LessonItemProps {
  lesson: Lesson
  moduleId: string
  isOpen: boolean
  editingLesson: { id: string; field: 'title' | 'description' } | null
  editingBlock: {
    lessonId: string
    id: string
    field: 'title' | 'content' | 'videoUrl' | 'contentUrl'
  } | null
  pendingAttachmentBlockId: string | null
  deletingAttachmentId: string | null
  onToggle: () => void
  onLessonEdit: (lessonId: string, field: 'title' | 'description') => void
  onLessonUpdate: (lessonId: string, field: keyof Lesson, value: string | boolean) => void
  onLessonSave: () => void
  onLessonTogglePublish: (lessonId: string, nextStatus: boolean) => void
  onBlockEdit: (lessonId: string, blockId: string, field: 'title' | 'content' | 'videoUrl' | 'contentUrl') => void
  onBlockUpdate: (lessonId: string, blockId: string, field: keyof LessonBlock, value: string | boolean) => void
  onBlockSave: () => void
  onBlockTogglePublish: (lessonId: string, blockId: string, nextStatus: boolean) => void
  onAddBlock: (
    moduleId: string,
    lessonId: string,
    type: 'VIDEO_LESSON' | 'RESOURCES' | 'LIVE_SESSION' | 'QUIZ' | 'GAMIFICATION',
  ) => void
  onReplaceBlock: (moduleId: string, lessonId: string, blockId: string, block: LessonBlock) => void
  onDeleteLesson: (moduleId: string, lessonId: string) => void
  onDeleteBlock: (moduleId: string, lessonId: string, blockId: string) => void
  handleBlockAttachmentUpload: (
    lessonId: string,
    blockId: string,
    file?: { url?: string | null; ufsUrl?: string | null; appUrl?: string | null; name?: string | null; type?: string | null },
  ) => Promise<void>
  handleBlockAttachmentDelete: (lessonId: string, blockId: string, attachmentId: string) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent, saveHandler: () => void) => void
  courseId?: string
}

const LessonItem = (props: LessonItemProps) => {
  const {
    lesson,
    moduleId,
    isOpen,
    editingLesson,
    editingBlock,
    onToggle,
    onLessonEdit,
    onLessonUpdate,
    onLessonSave,
    onLessonTogglePublish,
    onBlockEdit,
    onBlockUpdate,
    onBlockSave,
    onBlockTogglePublish,
  onAddBlock,
  onReplaceBlock,
  onDeleteLesson,
    onDeleteBlock,
    handleBlockAttachmentUpload,
    handleBlockAttachmentDelete,
    handleKeyDown,
    courseId,
  } = props

  const pendingAttachmentBlockId = props.pendingAttachmentBlockId ?? null
  const deletingAttachmentId = props.deletingAttachmentId ?? null
  const lessonInputRef = useRef<HTMLInputElement>(null)
  const lessonTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [resourceModeByBlock, setResourceModeByBlock] = useState<Record<string, ResourceInputMode>>({})

  const handleLessonPublishToggle = () => {
    onLessonTogglePublish(lesson.id, !lesson.isPublished)
  }

  const handleBlockPublishToggle = (blockId: string, currentStatus: boolean) => {
    onBlockTogglePublish(lesson.id, blockId, !currentStatus)
  }

  return (
    <div className="border border-border/40 rounded-lg">
      {/* Lesson Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-auto p-1"
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </Button>

          <div className="flex items-center gap-2">
            {editingLesson?.id === lesson.id && editingLesson.field === 'title' ? (
              <Input
                ref={lessonInputRef}
                value={lesson.title}
                onChange={(e) => onLessonUpdate(lesson.id, 'title', e.target.value)}
                onBlur={onLessonSave}
                onKeyDown={(e) => handleKeyDown(e, onLessonSave)}
                className="h-6 text-sm font-medium"
                autoFocus
              />
            ) : (
              <span
                className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                onClick={() => onLessonEdit(lesson.id, 'title')}
              >
                {lesson.title}
              </span>
            )}
          </div>

          <Badge variant={lesson.isPublished ? 'default' : 'secondary'} className="text-xs">
            {lesson.isPublished ? 'Published' : 'Draft'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {lesson.blocks.length} block{lesson.blocks.length !== 1 ? 's' : ''}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLessonPublishToggle}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
            title={lesson.isPublished ? 'Unpublish lesson' : 'Publish lesson'}
            aria-label={lesson.isPublished ? 'Unpublish lesson' : 'Publish lesson'}
          >
            {lesson.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                title="Aggiungi blocco"
                aria-label="Aggiungi blocco"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onAddBlock(moduleId, lesson.id, 'VIDEO_LESSON')}>
                <Video className="mr-2 h-3.5 w-3.5 text-[#5D62E1]" />
                <span>Video lesson</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddBlock(moduleId, lesson.id, 'RESOURCES')}>
                <FileText className="mr-2 h-3.5 w-3.5 text-[#5D62E1]" />
                <span>Resources</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddBlock(moduleId, lesson.id, 'LIVE_SESSION')}>
                <Cast className="mr-2 h-3.5 w-3.5 text-[#5D62E1]" />
                <span>Virtual classroom</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddBlock(moduleId, lesson.id, 'QUIZ')}>
                <ListChecks className="mr-2 h-3.5 w-3.5 text-[#5D62E1]" />
                <span>Quiz</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddBlock(moduleId, lesson.id, 'GAMIFICATION')}>
                <Sparkles className="mr-2 h-3.5 w-3.5 text-[#5D62E1]" />
                <span>Gamification</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onLessonEdit(lesson.id, 'title')}
            className="h-6 w-6 p-0"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDeleteLesson(moduleId, lesson.id)}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Lesson Content */}
      {isOpen && (
        <div className="p-3 space-y-3">
          {/* Lesson Description */}
          <div>
            {editingLesson?.id === lesson.id && editingLesson.field === 'description' ? (
              <Textarea
                ref={lessonTextareaRef}
                value={lesson.description || ''}
                onChange={(e) => onLessonUpdate(lesson.id, 'description', e.target.value)}
                onBlur={onLessonSave}
                onKeyDown={(e) => handleKeyDown(e, onLessonSave)}
                placeholder="Lesson description..."
                className="min-h-[40px] text-xs"
                autoFocus
              />
            ) : (
              <p
                className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => onLessonEdit(lesson.id, 'description')}
              >
                {lesson.description || 'Click to add description...'}
              </p>
            )}
          </div>

          {/* Blocks */}
          <div className="space-y-2">
            {lesson.blocks.map((block) => {
              const BlockIcon =
                block.type === 'VIDEO_LESSON'
                  ? Video
                  : block.type === 'RESOURCES'
                    ? FileText
                    : block.type === 'QUIZ'
                      ? ListChecks
                      : block.type === 'GAMIFICATION'
                        ? Sparkles
                        : Cast
              const blockLabel =
                block.type === 'VIDEO_LESSON'
                  ? 'Video'
                  : block.type === 'RESOURCES'
                    ? 'Resources'
                    : block.type === 'QUIZ'
                      ? 'Quiz'
                      : block.type === 'GAMIFICATION'
                        ? 'Gamification'
                        : 'Virtual classroom'
              const attachments = block.attachments ?? []
              const resourceMode = resourceModeByBlock[block.id] ?? (attachments.length > 0 ? 'upload' : block.contentUrl ? 'link' : 'upload')
              return (
              <div key={block.id} className="group relative rounded-xl border border-border/50 bg-card/60 p-3 transition hover:bg-muted/30">
                <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded-l-md bg-[#5D62E1] opacity-70" />
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#5D62E1]/10 text-[#5D62E1] ring-1 ring-[#5D62E1]/20">
                      <BlockIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{blockLabel}</span>

                    {editingBlock?.lessonId === lesson.id && editingBlock.id === block.id && editingBlock.field === 'title' ? (
                      <Input
                        value={block.title}
                        onChange={(e) => onBlockUpdate(lesson.id, block.id, 'title', e.target.value)}
                        onBlur={onBlockSave}
                        onKeyDown={(e) => handleKeyDown(e, onBlockSave)}
                        className="h-6 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer text-sm font-medium transition-colors hover:text-primary"
                        onClick={() => onBlockEdit(lesson.id, block.id, 'title')}
                      >
                        {block.title}
                      </span>
                    )}

                    <Badge variant={block.isPublished ? 'default' : 'secondary'} className="text-xs">
                      {block.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                    {block.type === 'GAMIFICATION' && block.gamification ? (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${gamificationStatusStyles[block.gamification.status] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {block.gamification.status.toLowerCase()}
                      </Badge>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBlockPublishToggle(block.id, block.isPublished)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                      title={block.isPublished ? 'Unpublish block' : 'Publish block'}
                      aria-label={block.isPublished ? 'Unpublish block' : 'Publish block'}
                    >
                      {block.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onBlockEdit(lesson.id, block.id, 'title')}
                      className="h-6 w-6 p-0"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteBlock(moduleId, lesson.id, block.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Block Content based on type */}
                {block.type === 'VIDEO_LESSON' ? (
                  <div className="space-y-2">
                    <VideoInput
                      value={block.videoUrl || ''}
                      onChange={(url) => onBlockUpdate(lesson.id, block.id, 'videoUrl', url)}
                      className="text-xs"
                    />
                    {editingBlock?.lessonId === lesson.id && editingBlock.id === block.id && editingBlock.field === 'content' ? (
                      <Textarea
                        value={block.content || ''}
                        onChange={(e) => onBlockUpdate(lesson.id, block.id, 'content', e.target.value)}
                        onBlur={onBlockSave}
                        onKeyDown={(e) => handleKeyDown(e, onBlockSave)}
                        placeholder="Video description or notes..."
                        className="min-h-[60px] text-xs"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => onBlockEdit(lesson.id, block.id, 'content')}
                      >
                        {block.content || 'Click to add description...'}
                      </p>
                    )}
                  </div>
                ) : block.type === 'RESOURCES' ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {editingBlock?.lessonId === lesson.id && editingBlock.id === block.id && editingBlock.field === 'content' ? (
                        <Textarea
                          value={block.content || ''}
                          onChange={(e) => onBlockUpdate(lesson.id, block.id, 'content', e.target.value)}
                          onBlur={onBlockSave}
                          onKeyDown={(e) => handleKeyDown(e, onBlockSave)}
                          placeholder="Resource description..."
                          className="min-h-[60px] text-xs"
                          autoFocus
                        />
                      ) : (
                        <p
                          className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => onBlockEdit(lesson.id, block.id, 'content')}
                        >
                          {block.content || 'Click to add description...'}
                        </p>
                      )}
                    </div>

                    <Tabs
                      value={resourceMode}
                      onValueChange={(value) =>
                        setResourceModeByBlock((prev) => ({ ...prev, [block.id]: value as ResourceInputMode }))
                      }
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-2 gap-1 rounded-md bg-muted/40 p-1 text-xs">
                        <TabsTrigger value="upload">Documento</TabsTrigger>
                        <TabsTrigger value="link">Link esterno</TabsTrigger>
                      </TabsList>
                      <TabsContent value="upload" className="mt-3 space-y-2 focus-visible:outline-none focus-visible:ring-0">
                        <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3">
                          <p className="text-xs font-semibold text-foreground">Carica documento</p>
                          <p className="text-xs text-muted-foreground">Carica PDF, slide o dispense da allegare alla lezione.</p>
                          <div className="mt-2">
                            <UploadDropzone
                              endpoint="courseAttachment"
                              onClientUploadComplete={async (res) => {
                                const file = res?.[0] as {
                                  url?: string | null
                                  ufsUrl?: string | null
                                  appUrl?: string | null
                                  name?: string | null
                                  type?: string | null
                                } | undefined
                                if (!file) return
                                await handleBlockAttachmentUpload(lesson.id, block.id, file)
                              }}
                              onUploadError={(error) => toast.error(error.message)}
                            />
                          </div>
                          {pendingAttachmentBlockId === block.id ? (
                            <p className="mt-2 text-xs text-muted-foreground">Saving attachment…</p>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          {attachments.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No files uploaded for this block yet.</p>
                          ) : (
                            attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-xs"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground">{attachment.name}</span>
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-primary hover:underline"
                                  >
                                    Apri risorsa
                                  </a>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={deletingAttachmentId === attachment.id}
                                  onClick={() => handleBlockAttachmentDelete(lesson.id, block.id, attachment.id)}
                                >
                                  {deletingAttachmentId === attachment.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </TabsContent>
                      <TabsContent value="link" className="mt-3 space-y-1 focus-visible:outline-none focus-visible:ring-0">
                        {editingBlock?.lessonId === lesson.id &&
                        editingBlock.id === block.id &&
                        editingBlock.field === 'contentUrl' ? (
                          <Input
                            value={block.contentUrl || ''}
                            onChange={(e) => onBlockUpdate(lesson.id, block.id, 'contentUrl', e.target.value)}
                            onBlur={onBlockSave}
                            onKeyDown={(e) => handleKeyDown(e, onBlockSave)}
                            placeholder="https://"
                            className="text-xs"
                            autoFocus
                          />
                        ) : (
                          <p
                            className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => onBlockEdit(lesson.id, block.id, 'contentUrl')}
                          >
                            {block.contentUrl || 'Click to add resource URL...'}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          Incolla un link a una risorsa esterna (Drive, Vimeo, Notion, ecc.).
                        </p>
                      </TabsContent>
                    </Tabs>
                  </div>

                ) : block.type === 'QUIZ' ? (
                  <div className="space-y-2">
                    <div className="rounded-md border border-dashed border-border/40 bg-background/70 p-3 text-xs space-y-1">
                      <p className="text-xs font-semibold">Quiz configurabile</p>
                      <p className="text-xs text-muted-foreground">
                        Aggiungi domande, risposte e punteggi. Puoi scegliere un template base (Multiple choice, Vero/Falso, Mixed) e personalizzarlo.
                      </p>
                    </div>
                    {editingBlock?.lessonId === lesson.id && editingBlock.id === block.id && editingBlock.field === 'content' ? (
                      <Textarea
                        value={block.content || ''}
                        onChange={(e) => onBlockUpdate(lesson.id, block.id, 'content', e.target.value)}
                        onBlur={onBlockSave}
                        onKeyDown={(e) => handleKeyDown(e, onBlockSave)}
                        placeholder="Note o istruzioni per il quiz (opzionale)"
                        className="min-h-[60px] text-xs"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => onBlockEdit(lesson.id, block.id, 'content')}
                      >
                        {block.content || 'Click to add notes/instructions...'}
                      </p>
                    )}
                    <a
                      href={courseId ? `/manage/courses/${courseId}/quizzes/${block.id}` : `/manage/courses/quizzes/${block.id}`}
                      className="inline-flex items-center text-xs text-primary hover:underline"
                    >
                      Apri editor quiz
                    </a>
                  </div>
                ) : block.type === 'GAMIFICATION' ? (
                  <GamificationStudio
                    courseId={courseId ?? ''}
                    moduleId={moduleId}
                    lessonId={lesson.id}
                    block={block}
                    onReplaceBlock={onReplaceBlock}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-md border border-border/40 bg-background/70 p-3 text-xs space-y-1">
                      <p className="text-xs font-semibold"></p>
                      <p className="text-xs text-muted-foreground">
                        Meeting ID: {block.liveSessionConfig?.meetingId ?? 'Da generare'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Stato: {block.liveSessionConfig?.status ?? 'offline'}
                      </p>
                    {block.liveSessionConfig?.scheduledFor ? (
                        <p className="text-xs text-muted-foreground">
                          Programmata per{' '}
                          {new Date(block.liveSessionConfig.scheduledFor).toLocaleString()}
                        </p>
                      ) : null}
                    </div>

                    {editingBlock?.lessonId === lesson.id && editingBlock.id === block.id && editingBlock.field === 'contentUrl' ? (
                      <Input
                        value={block.contentUrl || ''}
                        onChange={(e) => onBlockUpdate(lesson.id, block.id, 'contentUrl', e.target.value)}
                        onBlur={onBlockSave}
                        onKeyDown={(e) => handleKeyDown(e, onBlockSave)}
                        placeholder="Virtual classroom join URL"
                        className="text-xs"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => onBlockEdit(lesson.id, block.id, 'contentUrl')}
                      >
                        {block.contentUrl || 'Click per configurare la Join URL...'}
                      </p>
                    )}

                    {editingBlock?.lessonId === lesson.id && editingBlock.id === block.id && editingBlock.field === 'content' ? (
                      <Textarea
                        value={block.content || ''}
                        onChange={(e) => onBlockUpdate(lesson.id, block.id, 'content', e.target.value)}
                        onBlur={onBlockSave}
                        onKeyDown={(e) => handleKeyDown(e, onBlockSave)}
                        placeholder="Note per il facilitatore o i partecipanti..."
                        className="min-h-[60px] text-xs"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => onBlockEdit(lesson.id, block.id, 'content')}
                      >
                        {block.content || 'Click to add virtual classroom notes...'}
                      </p>
                    )}
                  </div>
                )}
              </div>
              )})}
          </div>
        </div>
      )}
    </div>
  )
}
