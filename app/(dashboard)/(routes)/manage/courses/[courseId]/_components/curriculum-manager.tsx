'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import type {
  CourseModule as DbCourseModule,
  Lesson as DbLesson,
  LessonBlock as DbLessonBlock,
  LessonBlockAttachment as DbLessonBlockAttachment,
  FlashcardCard as DbFlashcardCard,
  FlashcardDeck as DbFlashcardDeck,
  GamificationBlock as DbGamificationBlock,
  GamificationContentType,
  GamificationStatus,
  Quiz as DbQuiz,
  QuizOption as DbQuizOption,
  QuizQuestion as DbQuizQuestion,
} from '@prisma/client'
import { Plus, FolderOpen, BookOpen, Video, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ModuleAccordion,
  type Module,
  type Lesson,
  type LessonBlock,
  type VirtualClassroomConfig,
} from './module-accordion'

type QuizPayload = DbQuiz & { questions: (DbQuizQuestion & { options: DbQuizOption[] })[] }
type GamificationPayload = DbGamificationBlock & {
  flashcardDeck?: (DbFlashcardDeck & { cards: DbFlashcardCard[] }) | null
  quiz?: QuizPayload | null
}

type BlockPayload = DbLessonBlock & {
  attachments?: DbLessonBlockAttachment[]
  quiz?: QuizPayload | null
  gamification?: GamificationPayload | null
}

type LessonPayload = DbLesson & { blocks: BlockPayload[] }

export type ModulePayload = DbCourseModule & {
  lessons: LessonPayload[]
}

const sortByPosition = <T extends { position: number }>(items: T[]) => [...items].sort((a, b) => a.position - b.position)

const mapAttachmentFromDb = (attachment: DbLessonBlockAttachment) => ({
  id: attachment.id,
  name: attachment.name,
  url: attachment.url,
  type: attachment.type ?? null,
})

const mapQuizSummary = (quiz?: QuizPayload | null) => {
  if (!quiz) return null
  return {
    id: quiz.id,
    title: quiz.title,
    questionCount: quiz.questions.length,
    pointsReward: quiz.pointsReward,
  }
}

const mapFlashcardDeck = (deck?: (DbFlashcardDeck & { cards: DbFlashcardCard[] }) | null) => {
  if (!deck) return null
  const orderedCards = [...deck.cards].sort((a, b) => a.position - b.position)
  return {
    id: deck.id,
    title: deck.title,
    description: deck.description ?? null,
    cardCount: orderedCards.length,
    cards: orderedCards.map((card) => ({
      id: card.id,
      front: card.front,
      back: card.back,
      points: card.points,
      position: card.position,
    })),
  }
}

const mapBlockFromDb = (block: BlockPayload): LessonBlock => ({
  id: block.id,
  type: block.type,
  title: block.title,
  content: block.content ?? '',
  videoUrl: block.videoUrl ?? '',
  contentUrl: block.contentUrl ?? '',
  position: block.position,
  isPublished: block.isPublished,
  liveSessionConfig: (block.liveSessionConfig as VirtualClassroomConfig | null) ?? null,
  attachments: block.attachments?.map(mapAttachmentFromDb) ?? [],
  quizSummary: mapQuizSummary(block.quiz ?? block.gamification?.quiz ?? null),
  gamification: block.gamification
    ? {
        id: block.gamification.id,
        status: block.gamification.status,
        contentType: block.gamification.contentType,
        quizId: block.gamification.quiz?.id ?? block.quiz?.id ?? null,
        sourceAttachmentIds: block.gamification.sourceAttachmentIds,
        config: (block.gamification.config as Record<string, unknown> | null) ?? null,
        flashcardDeck: mapFlashcardDeck(block.gamification.flashcardDeck ?? null),
        quizSummary: mapQuizSummary(block.gamification.quiz ?? block.quiz ?? null),
      }
    : null,
})

const mapLessonFromDb = (lesson: LessonPayload): Lesson => ({
  id: lesson.id,
  title: lesson.title,
  description: lesson.description ?? '',
  position: lesson.position,
  isPublished: lesson.isPublished,
  blocks: sortByPosition(lesson.blocks).map(mapBlockFromDb),
})

export const mapModuleFromDb = (module: ModulePayload): Module => ({
  id: module.id,
  title: module.title,
  description: module.description ?? '',
  position: module.position,
  isPublished: module.isPublished,
  lessons: sortByPosition(module.lessons).map(mapLessonFromDb),
})

type CurriculumManagerProps = {
  courseId: string
  modules: Module[]
  onModulesChange: Dispatch<SetStateAction<Module[]>>
}

const normalizeNullable = (value?: string) => {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export const CurriculumManager = ({ courseId, modules, onModulesChange }: CurriculumManagerProps) => {
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [isAddingModule, setIsAddingModule] = useState(false)
  const [isCreatingModule, setIsCreatingModule] = useState(false)

  const updateModuleState = (moduleId: string, updater: (module: Module) => Module) => {
    onModulesChange((prev) => prev.map((module) => (module.id === moduleId ? updater(module) : module)))
  }

  const updateLessonState = (
    moduleId: string,
    lessonId: string,
    updater: (lesson: Lesson) => Lesson,
  ) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id === lessonId ? updater(lesson) : lesson,
              ),
            },
      ),
    )
  }

  const updateBlockState = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    updater: (block: LessonBlock) => LessonBlock,
  ) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id !== lessonId
                  ? lesson
                  : {
                      ...lesson,
                      blocks: lesson.blocks.map((block) =>
                        block.id === blockId ? updater(block) : block,
                      ),
                    },
              ),
            },
      ),
    )
  }

  const appendLessonState = (moduleId: string, lesson: Lesson) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id === moduleId ? { ...module, lessons: [...module.lessons, lesson] } : module,
      ),
    )
  }

  const appendBlockState = (moduleId: string, lessonId: string, block: LessonBlock) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id === lessonId
                  ? { ...lesson, blocks: [...lesson.blocks, block] }
                  : lesson,
              ),
            },
      ),
    )
  }

  const replaceBlockState = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    nextBlock: LessonBlock,
  ) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id !== lessonId
                  ? lesson
                  : {
                      ...lesson,
                      blocks: lesson.blocks.map((block) => (block.id === blockId ? nextBlock : block)),
                    },
              ),
            },
      ),
    )
  }

  const appendBlockAttachmentState = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    attachment: LessonBlock['attachments'][number],
  ) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id !== lessonId
                  ? lesson
                  : {
                      ...lesson,
                      blocks: lesson.blocks.map((block) =>
                        block.id !== blockId
                          ? block
                          : {
                              ...block,
                              attachments: [...(block.attachments ?? []), attachment],
                            },
                      ),
                    },
              ),
            },
      ),
    )
  }

  const handleReplaceBlock = (moduleId: string, lessonId: string, blockId: string, nextBlock: LessonBlock) => {
    replaceBlockState(moduleId, lessonId, blockId, nextBlock)
  }

  const removeBlockAttachmentState = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    attachmentId: string,
  ) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id !== lessonId
                  ? lesson
                  : {
                      ...lesson,
                      blocks: lesson.blocks.map((block) =>
                        block.id !== blockId
                          ? block
                          : {
                              ...block,
                              attachments: (block.attachments ?? []).filter((item) => item.id !== attachmentId),
                            },
                      ),
                    },
              ),
            },
      ),
    )
  }

  const removeModuleState = (moduleId: string) => {
    onModulesChange((prev) => prev.filter((module) => module.id !== moduleId))
  }

  const removeLessonState = (moduleId: string, lessonId: string) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              lessons: module.lessons.filter((lesson) => lesson.id !== lessonId),
            },
      ),
    )
  }

  const removeBlockState = (moduleId: string, lessonId: string, blockId: string) => {
    onModulesChange((prev) =>
      prev.map((module) =>
        module.id !== moduleId
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson) =>
                lesson.id !== lessonId
                  ? lesson
                  : {
                      ...lesson,
                      blocks: lesson.blocks.filter((block) => block.id !== blockId),
                    },
              ),
            },
      ),
    )
  }

  const handleAddModule = async () => {
    const title = newModuleTitle.trim()
    if (!title || isCreatingModule) {
      return
    }

    setIsCreatingModule(true)
    try {
      const response = await axios.post<ModulePayload>(`/api/courses/${courseId}/modules`, {
        title,
      })
      const newModule = mapModuleFromDb(response.data)
      onModulesChange((prev) => [...prev, newModule])
      toast.success('Module created')
      setNewModuleTitle('')
      setIsAddingModule(false)
    } catch {
      toast.error('Unable to create module')
    } finally {
      setIsCreatingModule(false)
    }
  }

  const handleUpdateModule = (moduleId: string, data: Partial<Module>) => {
    updateModuleState(moduleId, (module) => ({ ...module, ...data }))
  }

  const handlePersistModule = async (moduleId: string, overrides?: Partial<Module>) => {
    const module = modules.find((item) => item.id === moduleId)
    if (!module) return

    const payload = overrides ? { ...module, ...overrides } : module

    try {
      await axios.patch(`/api/courses/${courseId}/modules/${moduleId}`, {
        title: payload.title.trim(),
        description: normalizeNullable(payload.description),
        isPublished: payload.isPublished,
      })
    } catch {
      toast.error('Unable to save module changes')
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    try {
      await axios.delete(`/api/courses/${courseId}/modules/${moduleId}`)
      removeModuleState(moduleId)
      toast.success('Module deleted')
    } catch {
      toast.error('Unable to delete module')
    }
  }

  const handleAddLesson = async (moduleId: string) => {
    try {
      const response = await axios.post<LessonPayload>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons`,
        {
          title: 'New Lesson',
        },
      )
      const lesson = mapLessonFromDb(response.data)
      appendLessonState(moduleId, lesson)
      toast.success('Lesson added')
    } catch {
      toast.error('Unable to create lesson')
    }
  }

  const handleUpdateLesson = (
    moduleId: string,
    lessonId: string,
    data: Partial<Lesson>,
  ) => {
    updateLessonState(moduleId, lessonId, (lesson) => ({ ...lesson, ...data }))
  }

  const handlePersistLesson = async (moduleId: string, lessonId: string, overrides?: Partial<Lesson>) => {
    const module = modules.find((item) => item.id === moduleId)
    const lesson = module?.lessons.find((item) => item.id === lessonId)
    if (!lesson) return

    const payload = overrides ? { ...lesson, ...overrides } : lesson

    try {
      await axios.patch(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
        title: payload.title.trim(),
        description: normalizeNullable(payload.description),
        isPublished: payload.isPublished,
      })
    } catch {
      toast.error('Unable to save lesson changes')
    }
  }

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    try {
      await axios.delete(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`)
      removeLessonState(moduleId, lessonId)
      toast.success('Lesson deleted')
    } catch {
      toast.error('Unable to delete lesson')
    }
  }

  const handleAddBlock = async (
    moduleId: string,
    lessonId: string,
    type: 'VIDEO_LESSON' | 'RESOURCES' | 'LIVE_SESSION' | 'QUIZ' | 'GAMIFICATION',
  ) => {
    try {
      const response = await axios.post<DbLessonBlock>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/blocks`,
        {
          type,
          title:
            type === 'VIDEO_LESSON'
              ? 'New Video Lesson'
              : type === 'RESOURCES'
                ? 'New Resources'
                : type === 'QUIZ'
                  ? 'New Quiz'
                  : type === 'GAMIFICATION'
                    ? 'New Gamification'
                    : 'Aula virtuale BigBlueButton',
        },
      )
      const block = mapBlockFromDb(response.data)
      appendBlockState(moduleId, lessonId, block)
      toast.success('Content block added')
    } catch {
      toast.error('Unable to add content block')
    }
  }

  const handleCreateBlockAttachment = async (
    moduleId: string,
    lessonId: string,
    blockId: string,
    payload: { url: string; name?: string | null; type?: string | null },
  ) => {
    const url = payload.url?.trim()
    if (!url) {
      return
    }

    try {
      const response = await axios.post<DbLessonBlockAttachment>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/blocks/${blockId}/attachments`,
        {
          url,
          name: payload.name,
          type: payload.type,
        },
      )
      const attachment = mapAttachmentFromDb(response.data)
      appendBlockAttachmentState(moduleId, lessonId, blockId, attachment)
      toast.success('Resource added')
    } catch {
      toast.error('Unable to add file')
    }
  }

  const handleDeleteBlockAttachment = async (
    moduleId: string,
    lessonId: string,
    blockId: string,
    attachmentId: string,
  ) => {
    try {
      await axios.delete(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/blocks/${blockId}/attachments/${attachmentId}`
      )
      removeBlockAttachmentState(moduleId, lessonId, blockId, attachmentId)
      toast.success('Resource removed')
    } catch {
      toast.error('Unable to delete resource')
    }
  }

  const handleUpdateBlock = (
    moduleId: string,
    lessonId: string,
    blockId: string,
    data: Partial<LessonBlock>,
  ) => {
    updateBlockState(moduleId, lessonId, blockId, (block) => ({ ...block, ...data }))

    if (
      Object.prototype.hasOwnProperty.call(data, 'videoUrl') ||
      Object.prototype.hasOwnProperty.call(data, 'contentUrl')
    ) {
      void handlePersistBlock(moduleId, lessonId, blockId, data)
    }
  }

  const handlePersistBlock = async (
    moduleId: string,
    lessonId: string,
    blockId: string,
    overrides?: Partial<LessonBlock>,
  ) => {
    const module = modules.find((item) => item.id === moduleId)
    const lesson = module?.lessons.find((item) => item.id === lessonId)
    const block = lesson?.blocks.find((item) => item.id === blockId)
    if (!block) return

    const payload = overrides ? { ...block, ...overrides } : block

    try {
      await axios.patch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/blocks/${blockId}`,
        {
          title: payload.title.trim(),
          content: normalizeNullable(payload.content),
          videoUrl: normalizeNullable(payload.videoUrl),
          contentUrl: normalizeNullable(payload.contentUrl),
          isPublished: payload.isPublished,
        },
      )
    } catch {
      toast.error('Unable to save block changes')
    }
  }

  const handleDeleteBlock = async (moduleId: string, lessonId: string, blockId: string) => {
    try {
      await axios.delete(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/blocks/${blockId}`,
      )
      removeBlockState(moduleId, lessonId, blockId)
      toast.success('Block deleted')
    } catch {
      toast.error('Unable to delete block')
    }
  }

  const totalLessons = modules.reduce((acc, module) => acc + module.lessons.length, 0)
  const totalBlocks = modules.reduce(
    (acc, module) =>
      acc + module.lessons.reduce((lessonAcc, lesson) => lessonAcc + lesson.blocks.length, 0),
    0,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Course Structure</h2>
          <p className="text-sm text-muted-foreground">
            Organize your content into modules and lessons with different content types.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{modules.length} modules</span>
          <span>•</span>
          <span>{totalLessons} lessons</span>
          <span>•</span>
          <span>{totalBlocks} blocks</span>
        </div>
      </div>

      {/* Add Module Section */}
      <Card className="border-dashed border-2 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Add New Module
          </CardTitle>
          <CardDescription>
            Modules group related lessons together. Start by creating your first module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAddingModule ? (
            <div className="flex items-center gap-2">
              <Input
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Module title..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleAddModule()
                  } else if (e.key === 'Escape') {
                    setIsAddingModule(false)
                    setNewModuleTitle('')
                  }
                }}
                autoFocus
                disabled={isCreatingModule}
              />
              <Button onClick={handleAddModule} disabled={!newModuleTitle.trim() || isCreatingModule}>
                {isCreatingModule ? 'Adding…' : 'Add'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddingModule(false)
                  setNewModuleTitle('')
                }}
                disabled={isCreatingModule}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsAddingModule(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Module
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Modules List */}
      <div className="space-y-4">
        {modules.length === 0 ? (
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No modules yet</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Create your first module to start organizing your course content.
              </p>
              <Button onClick={() => setIsAddingModule(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Module
              </Button>
            </CardContent>
          </Card>
        ) : (
          modules.map((module) => (
            <ModuleAccordion
              key={module.id}
              module={module}
              onUpdateModule={handleUpdateModule}
              onDeleteModule={handleDeleteModule}
              onPersistModule={handlePersistModule}
              onAddLesson={handleAddLesson}
              onUpdateLesson={handleUpdateLesson}
              onDeleteLesson={handleDeleteLesson}
              onPersistLesson={handlePersistLesson}
              onAddBlock={handleAddBlock}
              onUpdateBlock={handleUpdateBlock}
              onDeleteBlock={handleDeleteBlock}
              onPersistBlock={handlePersistBlock}
              onReplaceBlock={handleReplaceBlock}
              onCreateAttachment={handleCreateBlockAttachment}
              onDeleteAttachment={handleDeleteBlockAttachment}
            />
          ))
        )}
      </div>

      {/* Help Card */}
      <Card className="border-border/60 bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How it works</CardTitle>
          <CardDescription>
            Build your course structure step by step with this intuitive interface.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <FolderOpen className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Modules</p>
              <p>Group related lessons together. Think of them as chapters in your course.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <BookOpen className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Lessons</p>
              <p>Individual learning units within each module. Each lesson can contain multiple content blocks.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Video className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Video Lessons</p>
              <p>Upload videos or add streaming links. Perfect for presentations, tutorials, and demonstrations.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Resources</p>
              <p>Add documents, PDFs, links, and other supplementary materials to support learning.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CurriculumManager
