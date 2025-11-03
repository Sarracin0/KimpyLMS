'use client'

import { ChevronDown } from 'lucide-react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import CourseSidebarBlock from './course-sidebar-block'
import { LessonWithBlocks } from './course-sidebar.types'

type CourseSidebarLessonProps = {
  lesson: LessonWithBlocks
  courseId: string
  isLocked: boolean
}

export default function CourseSidebarLesson({ lesson, courseId, isLocked }: CourseSidebarLessonProps) {
  const isCompleted = lesson.progress?.[0]?.isCompleted || false

  return (
    <AccordionItem value={lesson.id} className="border-none">
      <AccordionTrigger className="px-8 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-700 hover:no-underline data-[state=open]:bg-slate-50">
        <div className="flex items-center gap-2">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
          <span className="text-left">{lesson.title}</span>
          {isCompleted && (
            <span className="ml-2 text-xs text-emerald-600">✓</span>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        {lesson.blocks.length > 0 ? (
          <div className="flex flex-col">
            {lesson.blocks.map((block) => (
                <CourseSidebarBlock key={block.id} block={block} courseId={courseId} isLocked={isLocked} />
            ))}
          </div>
        ) : (
          <div className="px-10 py-3 text-xs text-slate-400">Nessun contenuto disponibile</div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
