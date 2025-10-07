'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  NotebookPen,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { logError, logWarn } from '@/lib/logger'
import { cn } from '@/lib/utils'

const PDF_JS_CDN_BASE = 'https://unpkg.com/pdfjs-dist@4.8.69/build'

type PdfRenderTask = {
  promise: Promise<void>
  cancel: () => void
}

type PdfViewport = {
  width: number
  height: number
}

type PdfPage = {
  getViewport: (options: { scale: number; rotation?: number }) => PdfViewport
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => PdfRenderTask
}

type PdfDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPage>
}

type PdfJsModule = {
  version?: string
  GlobalWorkerOptions: { workerSrc?: string }
  getDocument: (src: string | { url: string }) => { promise: Promise<PdfDocument> }
}

const MIN_ZOOM = 0.6
const MAX_ZOOM = 3.4
const ZOOM_STEP = 0.2

let pdfjsLibPromise: Promise<PdfJsModule> | null = null

const loadPdfJs = async (): Promise<PdfJsModule> => {
  if (pdfjsLibPromise) return pdfjsLibPromise

  pdfjsLibPromise = (async () => {
    const pdfModule = (await import(/* webpackIgnore: true */ `${PDF_JS_CDN_BASE}/pdf.mjs`)) as PdfJsModule
    if (!pdfModule.GlobalWorkerOptions.workerSrc) {
      pdfModule.GlobalWorkerOptions.workerSrc = `${PDF_JS_CDN_BASE}/pdf.worker.min.mjs`
    }
    return pdfModule
  })()

  return pdfjsLibPromise
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

type PdfViewerProps = {
  src: string
  title?: string
  attachmentId?: string
  onLoad?: (meta: { pageCount: number }) => void
  className?: string
}

export const PdfViewer = ({ src, title, attachmentId, onLoad, className }: PdfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const renderTaskRef = useRef<PdfRenderTask | null>(null)
  const pdfDocRef = useRef<PdfDocument | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [scale, setScale] = useState(1.1)
  const [fitMode, setFitMode] = useState<'manual' | 'width'>('width')
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSynced, setNotesSynced] = useState(false)
  const [reloadCounter, setReloadCounter] = useState(0)

  const storageKey = useMemo(() => {
    const base = attachmentId ?? src
    return typeof window !== 'undefined' ? `kimpylms:pdf-notes:${base}` : null
  }, [attachmentId, src])

  const pageProgress = useMemo(() => (pageCount > 0 ? Math.round((pageNumber / pageCount) * 100) : 0), [pageCount, pageNumber])

  const syncNotesFromStorage = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored && stored !== notes) {
        setNotes(stored)
      }
    } catch (caughtError) {
      logError('PDF_NOTES_LOAD_FAILED', caughtError)
    }
  }, [storageKey, notes])

  useEffect(() => {
    syncNotesFromStorage()
    setNotesSynced(true)
  }, [syncNotesFromStorage])

  useEffect(() => {
    if (!storageKey || !notesSynced || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, notes)
    } catch (caughtError) {
      logError('PDF_NOTES_SAVE_FAILED', caughtError)
    }
  }, [notes, notesSynced, storageKey])

  const enterFullscreen = useCallback(() => {
    const target = frameRef.current
    if (!target) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    void target.requestFullscreen()
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    return () => {
      try {
        renderTaskRef.current?.cancel()
      } catch (caughtError) {
        logWarn('PDF_RENDER_CANCEL_ON_UNMOUNT', 'Unable to cancel render on unmount', caughtError)
      }
      renderTaskRef.current = null
      pdfDocRef.current = null
    }
  }, [])

  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current
    if (!pdf || !canvasRef.current) return

    setIsRendering(true)
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch (renderCancelError) {
        logWarn('PDF_RENDER_CANCEL_FAILED', 'Previous render cancellation failed', renderCancelError)
      }
    }

    try {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale, rotation })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('Unable to acquire canvas context')

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      const renderTask = page.render({ canvasContext: context, viewport })
      renderTaskRef.current = renderTask
      await renderTask.promise
    } catch (caughtError) {
      if ((caughtError as { name?: string } | undefined)?.name !== 'RenderingCancelledException') {
        logError('PDF_PAGE_RENDER_FAILED', caughtError)
        setError('Impossibile renderizzare questa pagina del PDF.')
      }
    } finally {
      setIsRendering(false)
    }
  }, [pageNumber, rotation, scale])

  const applyFitWidth = useCallback(async () => {
    if (!pdfDocRef.current || !containerRef.current) return
    try {
      const page = await pdfDocRef.current.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1, rotation })
      const containerWidth = containerRef.current.clientWidth - 24
      if (containerWidth <= 0) return
      const nextScale = clamp(containerWidth / viewport.width, MIN_ZOOM, MAX_ZOOM)
      setScale((prev) => (Math.abs(prev - nextScale) > 0.05 ? nextScale : prev))
    } catch (caughtError) {
      logWarn('PDF_FIT_WIDTH', 'Unable to compute width-fit scale', caughtError)
    }
  }, [pageNumber, rotation])

  useEffect(() => {
    if (fitMode === 'width') {
      void applyFitWidth()
    }
  }, [applyFitWidth, fitMode, pageNumber, rotation])

  useEffect(() => {
    if (fitMode !== 'width') return
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => {
      void applyFitWidth()
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [applyFitWidth, fitMode])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const pdfjs = await loadPdfJs()
        const task = pdfjs.getDocument({ url: src })
        const doc = await task.promise
        if (cancelled) return
        pdfDocRef.current = doc
        renderTaskRef.current = null
        setPageCount(doc.numPages)
        setPageNumber(1)
        setPageInput('1')
        onLoad?.({ pageCount: doc.numPages })
        setIsLoading(false)
      } catch (caughtError) {
        logError('PDF_DOCUMENT_LOAD_FAILED', caughtError)
        if (!cancelled) {
          setError('Non riusciamo a caricare il PDF. Verifica il link o riprova più tardi.')
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [onLoad, reloadCounter, src])

  useEffect(() => {
    if (isLoading || error) return
    void renderPage()
  }, [error, isLoading, renderPage])

  useEffect(() => {
    setPageInput(String(pageNumber))
  }, [pageNumber])

  const handlePageChange = useCallback(
    (delta: number) => {
      setPageNumber((prev) => clamp(prev + delta, 1, pageCount || 1))
    },
    [pageCount],
  )

  const handlePageInputSubmit = useCallback(() => {
    const next = Number.parseInt(pageInput, 10)
    if (Number.isFinite(next)) {
      setPageNumber(clamp(next, 1, pageCount || 1))
    }
  }, [pageCount, pageInput])

  const toggleFitMode = useCallback(() => {
    setFitMode((prev) => (prev === 'width' ? 'manual' : 'width'))
  }, [])

  const zoomIn = useCallback(() => {
    setFitMode('manual')
    setScale((prev) => clamp(prev + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))
  }, [])

  const zoomOut = useCallback(() => {
    setFitMode('manual')
    setScale((prev) => clamp(prev - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))
  }, [])

  const resetView = useCallback(() => {
    setRotation(0)
    setScale(1.1)
    setFitMode('width')
  }, [])

  const rotateLeft = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360)
  }, [])

  const rotateRight = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const notePlaceholder = pageCount
    ? `Annota i takeaway principali o le azioni da condividere con il tuo team. Le note restano visibili solo a te.`
    : 'Le note personali saranno disponibili una volta caricato il PDF.'

  return (
    <div ref={frameRef} className={cn('flex h-full flex-col gap-4', className)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">{title ?? 'Documento PDF'}</h2>
              <p className="text-xs text-muted-foreground">
                {pageCount > 0 ? `Pagina ${pageNumber} di ${pageCount}` : 'Caricamento in corso…'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={resetView} title="Reimposta visualizzazione">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={rotateLeft} title="Ruota a sinistra">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={rotateRight} title="Ruota a destra">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={enterFullscreen} title={isFullscreen ? 'Esci da full screen' : 'Full screen'}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="default" size="sm" className="gap-2" asChild>
              <a href={src} target="_blank" rel="noreferrer" download>
                <Download className="h-4 w-4" />
                Scarica
              </a>
            </Button>
          </div>
        </div>
        <Progress value={pageProgress} className="h-1.5" />
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 p-3" ref={containerRef}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => handlePageChange(-1)} disabled={pageNumber <= 1 || isLoading}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <Input
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={handlePageInputSubmit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handlePageInputSubmit()
                  }
                }}
                inputMode="numeric"
                className="h-8 w-16 text-center"
              />
              <span className="text-muted-foreground">/ {pageCount || '—'}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(1)}
              disabled={pageNumber >= pageCount || isLoading || pageCount === 0}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1">
              <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= MIN_ZOOM + 0.01}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="w-16 text-center text-xs font-medium">{Math.round(scale * 100)}%</div>
              <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= MAX_ZOOM - 0.01}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant={fitMode === 'width' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={toggleFitMode}
            >
              {fitMode === 'width' ? 'Adatta larghezza' : 'Adatta automaticamente'}
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <a href={src} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Apri in nuova scheda
              </a>
            </Button>
          </div>
        </div>

        <div className="relative mt-4 flex min-h-[480px] items-center justify-center overflow-auto rounded-lg border border-border/40 bg-background">
          <canvas ref={canvasRef} className="max-h-full max-w-full" />
          {(isLoading || isRendering) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                {isLoading ? 'Caricamento del documento…' : 'Elaboro la pagina corrente…'}
              </span>
            </div>
          )}
          {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm font-semibold text-destructive">{error}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setReloadCounter((prev) => prev + 1)}>
                  Ricarica
                </Button>
                <Button variant="ghost" size="sm" onClick={resetView}>
                  Reimposta vista
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Appunti personali</p>
            <p className="text-xs text-muted-foreground">Ottimizza il follow-up: le note restano salvate solo sul tuo dispositivo.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pdf-notes" className="sr-only">
            Appunti sul documento
          </Label>
          <Textarea
            id="pdf-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={notePlaceholder}
            rows={5}
            className="resize-none"
            disabled={!pageCount}
          />
          <p className="text-xs text-muted-foreground">
            Suggerimento: sintetizza le tre azioni da assegnare alla tua squadra una volta terminata la lettura.
          </p>
        </div>
      </div>

      <Separator className="bg-border/70" />

      <div className="grid gap-2 text-xs text-muted-foreground">
        <p>
          Questa anteprima è ottimizzata per i materiali caricati tramite UploadThing. Per garantire la miglior resa, verifica che il documento originale sia impostato in formato orizzontale 16:9 o 4:3.
        </p>
        <p>
          Il viewer utilizza PDF.js da CDN pubblico. Assicurati che la rete aziendale consenta la connessione a <code>unpkg.com</code>.
        </p>
      </div>
    </div>
  )
}

export default PdfViewer
