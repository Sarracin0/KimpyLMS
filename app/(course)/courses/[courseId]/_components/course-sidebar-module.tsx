'use client'

import { ChevronDown } from 'lucide-react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Accordion } from '@/components/ui/accordion'
import CourseSidebarLesson from './course-sidebar-lesson'
import { ModuleWithLessons } from './course-sidebar.types'

type CourseSidebarModuleProps = {
  module: ModuleWithLessons
  courseId: string
  isLocked: boolean
}

export default function CourseSidebarModule({ module, courseId, isLocked }: CourseSidebarModuleProps) {
  return (
    <AccordionItem value={module.id} className="border-b border-white/10">
      <AccordionTrigger className="group px-4 py-3 text-sm font-semibold text-foreground/90 hover:bg-white/40 hover:no-underline rounded-md transition-colors">
        <div className="flex items-center gap-2">
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          <span className="text-left">{module.title}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        {module.lessons.length > 0 ? (
          <Accordion type="multiple" className="w-full">
            {module.lessons.map((lesson) => (
              <CourseSidebarLesson
                key={lesson.id}
                lesson={lesson}
                courseId={courseId}
                isLocked={!lesson.isPreview && isLocked}
              />
            ))}
          </Accordion>
        ) : (
          <div className="px-6 py-4 text-sm text-muted-foreground">Nessuna lezione disponibile</div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
