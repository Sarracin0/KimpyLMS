'use client'

import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/button'

type CourseEnrollButtonProps = {
  courseId: string
  userProfileId: string
}

export default function CourseEnrollButton({ courseId, userProfileId }: CourseEnrollButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const onClick = async () => {
    try {
      setIsLoading(true)
      await axios.post(`/api/courses/${courseId}/enrollments`, {
        userProfileIds: [userProfileId],
      })
      toast.success('You are now enrolled in this course')
      router.refresh()
    } catch {
      toast.error('Unable to enroll right now')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      className="w-full bg-[#5D62E1] text-white hover:bg-[#5055c9] md:w-auto"
      size="sm"
      onClick={onClick}
      disabled={isLoading}
    >
      Enroll now
    </Button>
  )
}
