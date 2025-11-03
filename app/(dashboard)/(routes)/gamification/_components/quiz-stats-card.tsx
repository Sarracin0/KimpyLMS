'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type CourseStats = {
  courseId: string
  courseTitle: string
  quizCount: number
  totalAttempts: number
  averageScore: number
  passRate: number
  learners: number
}

export function QuizStatsCard({ courseStats }: { courseStats: CourseStats[] }) {
  if (courseStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Punteggi quiz per corso</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nessun dato sui quiz disponibile.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Punteggi quiz per corso</CardTitle>
        <p className="text-xs text-muted-foreground">Aggregato di tutti i quiz pubblicati per corso.</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Corso</TableHead>
              <TableHead>Quiz</TableHead>
              <TableHead>Tentativi</TableHead>
              <TableHead>Punteggio medio</TableHead>
              <TableHead>Pass rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courseStats.map((course) => (
              <TableRow key={course.courseId}>
                <TableCell>
                  <div>
                    <p className="font-medium">{course.courseTitle}</p>
                    <p className="text-xs text-muted-foreground">{course.learners} learner</p>
                  </div>
                </TableCell>
                <TableCell>{course.quizCount}</TableCell>
                <TableCell>{course.totalAttempts}</TableCell>
                <TableCell>{course.averageScore}</TableCell>
                <TableCell>{course.passRate}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
