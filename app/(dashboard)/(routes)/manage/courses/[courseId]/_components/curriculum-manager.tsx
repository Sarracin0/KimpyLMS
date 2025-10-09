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
import { extractScenarioPayload, summarizeScenario } from '@/lib/gamification/scenario'
import { extractArenaPayload, summarizeArena } from '@/lib/gamification/arena'
import { parseVideoCheckpoints } from '@/lib/video/checkpoints'

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

const mapBlockFromDb = (block: BlockPayload): LessonBlock => {
  const scenarioPayload = extractScenarioPayload(block.gamification?.result ?? null)
  const scenarioSummary = scenarioPayload ? summarizeScenario(scenarioPayload) : null

  const arenaPayload = extractArenaPayload(block.gamification?.result ?? null)
  const arenaSummary = arenaPayload ? summarizeArena(arenaPayload) : null

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[CurriculumManager] mapBlockFromDb', {
      blockId: block.id,
      originalContentType: block.gamification?.contentType,
      scenarioSummary,
      arenaSummary,
    })
  }

  return {
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
    videoCheckpoints: parseVideoCheckpoints(block.videoCheckpoints ?? null),
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
          scenarioSummary,
          arenaSummary,
        }
      : null,
  }
}

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

const formatCountLabel = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`

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
      toast.success('Modulo creato')
      setNewModuleTitle('')
      setIsAddingModule(false)
    } catch {
      toast.error('Impossibile creare il modulo')
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
      toast.error('Impossibile salvare le modifiche al modulo')
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    try {
      await axios.delete(`/api/courses/${courseId}/modules/${moduleId}`)
      removeModuleState(moduleId)
      toast.success('Modulo eliminato')
    } catch {
      toast.error('Impossibile eliminare il modulo')
    }
  }

  const handleAddLesson = async (moduleId: string) => {
    try {
      const response = await axios.post<LessonPayload>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons`,
        {
          title: 'Nuova lezione',
        },
      )
      const lesson = mapLessonFromDb(response.data)
      appendLessonState(moduleId, lesson)
      toast.success('Lezione aggiunta')
    } catch {
      toast.error('Impossibile creare la lezione')
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
      toast.error('Impossibile salvare le modifiche alla lezione')
    }
  }

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    try {
      await axios.delete(`/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`)
      removeLessonState(moduleId, lessonId)
      toast.success('Lezione eliminata')
    } catch {
      toast.error('Impossibile eliminare la lezione')
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
              ? 'Nuova lezione video'
              : type === 'RESOURCES'
                ? 'Nuovo blocco risorse'
                : type === 'QUIZ'
                  ? 'Nuovo quiz'
                  : type === 'GAMIFICATION'
                    ? 'Nuovo blocco gamification'
                    : 'Aula virtuale BigBlueButton',
        },
      )
      const block = mapBlockFromDb(response.data)
      appendBlockState(moduleId, lessonId, block)
      toast.success('Blocco di contenuto aggiunto')
    } catch {
      toast.error('Impossibile aggiungere il blocco di contenuto')
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
      toast.success('Risorsa aggiunta')
    } catch {
      toast.error('Impossibile aggiungere il file')
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
      toast.success('Risorsa rimossa')
    } catch {
      toast.error('Impossibile eliminare la risorsa')
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
      toast.error('Impossibile salvare le modifiche al blocco')
    }
  }

  const handleDeleteBlock = async (moduleId: string, lessonId: string, blockId: string) => {
    try {
      await axios.delete(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/blocks/${blockId}`,
      )
      removeBlockState(moduleId, lessonId, blockId)
      toast.success('Blocco eliminato')
    } catch {
      toast.error('Impossibile eliminare il blocco')
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
          <h2 className="text-xl font-semibold text-foreground">Struttura del corso</h2>
          <p className="text-sm text-muted-foreground">
            Organizza i contenuti in moduli e lezioni con tipologie differenti.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatCountLabel(modules.length, 'modulo', 'moduli')}</span>
          <span>•</span>
          <span>{formatCountLabel(totalLessons, 'lezione', 'lezioni')}</span>
          <span>•</span>
          <span>{formatCountLabel(totalBlocks, 'blocco', 'blocchi')}</span>
        </div>
      </div>

      {/* Add Module Section */}
      <Card className="border-dashed border-2 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Aggiungi un nuovo modulo
          </CardTitle>
          <CardDescription>
            I moduli raggruppano lezioni correlate. Inizia creando il primo modulo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAddingModule ? (
            <div className="flex items-center gap-2">
              <Input
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Titolo del modulo..."
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
                {isCreatingModule ? 'Aggiunta in corso…' : 'Aggiungi'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddingModule(false)
                  setNewModuleTitle('')
                }}
                disabled={isCreatingModule}
              >
                Annulla
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsAddingModule(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Crea modulo
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
              <h3 className="text-lg font-semibold text-foreground mb-2">Ancora nessun modulo</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Crea il primo modulo per iniziare a organizzare i contenuti del corso.
              </p>
              <Button onClick={() => setIsAddingModule(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crea il primo modulo
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
          <CardTitle className="text-base">Come funziona</CardTitle>
          <CardDescription>
            Costruisci la struttura del corso passo dopo passo con questa interfaccia intuitiva.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <FolderOpen className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Moduli</p>
              <p>Raggruppa lezioni correlate, come fossero capitoli del tuo corso.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <BookOpen className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Lezioni</p>
              <p>Unità formative all'interno di ogni modulo, ognuna con più blocchi di contenuto.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Video className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Lezioni video</p>
              <p>Carica video o aggiungi link di streaming: perfetto per presentazioni, tutorial e demo.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Risorse</p>
              <p>Aggiungi documenti, PDF, link e altri materiali di supporto.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CurriculumManager
