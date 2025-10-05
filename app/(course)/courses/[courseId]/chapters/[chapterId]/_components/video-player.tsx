'use client'

import axios from 'axios'
import { Loader2, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'

import { useConfettiStore } from '@/hooks/use-confetti'

interface VideoPlayerProps {
  courseId: string
  chapterId: string
  nextChapterId?: string
  isLocked: boolean
  completeOnEnd: boolean
  title: string
  videoUrl?: string | null
}

type Provider = 'youtube' | 'vimeo' | 'hls' | 'file' | 'unknown'

function detectProvider(url: string): Provider {
  const u = url.trim()
  if (!u) return 'unknown'
  // YouTube patterns
  if (/youtu\.be\//i.test(u) || /youtube\.com\/(watch\?v=|embed\/)\/?.*/i.test(u)) {
    return 'youtube'
  }
  // Vimeo patterns
  if (/vimeo\.com\//i.test(u) || /player\.vimeo\.com\/video\//i.test(u)) {
    return 'vimeo'
  }
  // HLS manifest
  if (/\.m3u8(\?|$)/i.test(u)) {
    return 'hls'
  }
  // Common file extensions
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) {
    return 'file'
  }
  return 'unknown'
}

function toYouTubeEmbed(url: string): string | null {
  try {
    const ytShort = url.match(/youtu\.be\/([\w-]{6,})/i)
    if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}?rel=0&modestbranding=1&playsinline=1`
    const ytWatch = url.match(/[?&]v=([\w-]{6,})/i)
    if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}?rel=0&modestbranding=1&playsinline=1`
    const ytEmbed = url.match(/youtube\.com\/embed\/([\w-]{6,})/i)
    if (ytEmbed) return `https://www.youtube.com/embed/${ytEmbed[1]}?rel=0&modestbranding=1&playsinline=1`
    return null
  } catch {
    return null
  }
}

function toVimeoEmbed(url: string): string | null {
  try {
    const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1]
    if (id) return `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`
    return null
  } catch {
    return null
  }
}

export const VideoPlayer = ({
  courseId,
  chapterId,
  nextChapterId,
  isLocked,
  completeOnEnd,
  title,
  videoUrl,
}: VideoPlayerProps) => {
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()
  const confetti = useConfettiStore()

  const provider = useMemo<Provider>(() => (videoUrl ? detectProvider(videoUrl) : 'unknown'), [videoUrl])
  const videoEl = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<unknown>(null)

  const onEnd = useCallback(async () => {
    try {
      if (completeOnEnd) {
        await axios.put(`/api/courses/${courseId}/chapters/${chapterId}/progress`, {
          isCompleted: true,
        })

        if (!nextChapterId) {
          confetti.onOpen()
        }

        toast.success('Progress updated')
        router.refresh()

        if (nextChapterId) {
          router.push(`/courses/${courseId}/chapters/${nextChapterId}`)
        }
      }
    } catch {
      toast.error('Something went wrong')
    }
  }, [chapterId, completeOnEnd, confetti, courseId, nextChapterId, router])

  useEffect(() => {
    // Setup HLS if needed
    if (!videoUrl) return
    if (provider !== 'hls') return
    const el = videoEl.current
    let cancelled = false

    async function setupHls() {
      try {
        const mod = await import('hls.js')
        const Hls = mod.default
        if (Hls?.isSupported && Hls.isSupported()) {
          const hls = new Hls()
          hlsRef.current = hls
          hls.loadSource(videoUrl)
          if (el) {
            hls.attachMedia(el)
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (!cancelled) setIsReady(true)
            })
          }
        } else if (el && el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = videoUrl
          const onLoaded = () => setIsReady(true)
          el.addEventListener('loadedmetadata', onLoaded, { once: true })
        } else {
          // Fallback: show as regular video (may not play on this browser)
          if (el) el.src = videoUrl
          setIsReady(true)
        }
      } catch {
        // hls.js not available or failed – fallback
        if (el) el.src = videoUrl
        setIsReady(true)
      }
    }

    setupHls()

    return () => {
      cancelled = true
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy()
        } catch {}
        hlsRef.current = null
      }
    }
  }, [provider, videoUrl])

  const renderPlayer = () => {
    if (!videoUrl || isLocked) return null

    if (provider === 'youtube') {
      const src = toYouTubeEmbed(videoUrl)
      return src ? (
        <iframe
          title={title}
          className="h-full w-full rounded-xl shadow-lg ring-1 ring-white/20"
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => setIsReady(true)}
        />
      ) : null
    }

    if (provider === 'vimeo') {
      const src = toVimeoEmbed(videoUrl)
      return src ? (
        <iframe
          title={title}
          className="h-full w-full rounded-xl shadow-lg ring-1 ring-white/20"
          src={src}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          onLoad={() => setIsReady(true)}
        />
      ) : null
    }

    if (provider === 'hls') {
      return (
        <video
          ref={videoEl}
          title={title}
          className="h-full w-full rounded-xl shadow-lg ring-1 ring-white/20"
          controls
          playsInline
          autoPlay
          onEnded={onEnd}
        />
      )
    }

    // file or unknown – let the browser try
    return (
      <video
        title={title}
        className="h-full w-full rounded-xl shadow-lg ring-1 ring-white/20"
        controls
        playsInline
        autoPlay
        onLoadedData={() => setIsReady(true)}
        onEnded={onEnd}
        src={videoUrl}
      />
    )
  }

  return (
    <div className="relative aspect-video">
      {!isReady && !isLocked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/80">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-y-2 rounded-xl bg-black/80 text-white">
          <Lock className="h-8 w-8" />
          <p className="text-sm">This chapter is locked</p>
        </div>
      )}
      {renderPlayer()}
      {!isLocked && !videoUrl ? (
        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/30 bg-white/40 text-sm text-muted-foreground backdrop-blur-md supports-[backdrop-filter]:bg-white/30">
          Lesson video will appear here once uploaded.
        </div>
      ) : null}
    </div>
  )
}
