import { useState, useEffect, useCallback, useRef } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PptxRenderer } from 'pptx-browser'
import { supabase, generateSessionCode, getStorageUrl, STORAGE_BUCKET } from '../lib/supabase'
import { isImageFile, isPdfFile, isPowerPointFile, isLegacyPowerPointFile } from '../lib/slideUtils'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface Slide {
  id: string
  session_id: string
  url: string
  name: string
  slide_order: number
}

export interface StrokePoint {
  x: number
  y: number
}

export interface StrokeData {
  strokeId: string
  points: StrokePoint[]
  color: string
  width: number
  mode?: 'permanent' | 'temp' | 'hold' | 'highlighter' | 'laser'
}

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error'

export interface WhiteboardSession {
  role: 'presenter' | 'joiner' | null
  sessionCode: string | null
  sessionId: string | null
  connectionState: ConnectionState
  error: string | null
  slides: Slide[]
  currentSlideIndex: number
  strokes: Map<string, StrokeData>
  joinerConnected: boolean
  createSession: () => Promise<void>
  joinSession: (code: string) => Promise<void>
  sendStrokePoint: (
    strokeId: string,
    x: number,
    y: number,
    color: string,
    width: number,
    type: 'start' | 'move' | 'end',
    options?: { mode?: 'permanent' | 'temp' | 'hold'; ttlMs?: number }
  ) => void
  saveStroke: (stroke: StrokeData) => Promise<void>
  eraseStroke: (strokeId: string) => Promise<void>
  clearAll: () => Promise<void>
  deleteAllSlides: () => Promise<void>
  changeSlide: (index: number) => Promise<void>
  uploadSlide: (file: File, onProgress?: (progress: number, message: string) => void) => Promise<Slide[]>
  deleteSlide: (slideId: string) => Promise<void>
  saveCanvasImage: () => Promise<string | null>
  disconnect: () => void
  setDrawPointCallback: (cb: ((payload: {
    strokeId: string
    x: number
    y: number
    color: string
    width: number
    type: 'start' | 'move' | 'end'
    mode?: string
  }) => void) | null) => void
}

function isStorageBucketMissing(error: any) {
  const message = String(error?.message || '').toLowerCase()
  const status = String(error?.statusCode || error?.status || '')
  return (
    status === '404' ||
    (status === '400' && message.includes('bucket')) ||
    message.includes('bucket not found') ||
    message.includes('the resource was not found') ||
    message.includes('resource was not found')
  )
}

function isStoragePermissionError(error: any) {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('policy') ||
    message.includes('security') ||
    message.includes('permission') ||
    message.includes('row-level security')
  )
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create slide image.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

async function uploadSlideImage(
  blob: Blob,
  sessionId: string,
  slideOrder: number,
  sourceName: string,
  contentType = 'image/png',
  extension = 'png'
) {
  const safeName = sourceName.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 40)
  const path = `${sessionId}/${String(slideOrder).padStart(4, '0')}-${Date.now()}-${safeName || 'slide'}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, {
      contentType,
      upsert: true,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) {
    throw new Error('Unable to resolve uploaded slide URL.')
  }
  return data.publicUrl
}

function createPlaceholderSlideDataUrl(title: string, subtitle: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')
  if (!ctx) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#1a1a2e"/></svg>`)

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#0f172a')
  gradient.addColorStop(1, '#1e293b')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = 'rgba(99,102,241,0.14)'
  ctx.beginPath()
  ctx.arc(canvas.width * 0.5, canvas.height * 0.36, 160, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f8fafc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 52px Arial'
  ctx.fillText(title, canvas.width * 0.5, canvas.height * 0.48)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '28px Arial'
  ctx.fillText(subtitle, canvas.width * 0.5, canvas.height * 0.58)

  return canvas.toDataURL('image/png')
}

async function renderPdfPages(
  file: File,
  sessionId: string,
  startOrder: number,
  onProgress?: (progress: number, message: string) => void
) {
  const insertedSlides: Slide[] = []
  const pdfData = await file.arrayBuffer()
  const loadingTask = getDocument({ data: pdfData })
  const pdf = await loadingTask.promise

  try {
    onProgress?.(5, `Loaded ${file.name}. Rendering PDF pages...`)
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const renderScale = 1920 / baseViewport.width
      const viewport = page.getViewport({ scale: renderScale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)

      const context = canvas.getContext('2d')
      if (!context) continue

      await page.render({
        canvasContext: context,
        canvas,
        viewport,
      }).promise

      const blob = await canvasToBlob(canvas)
      const url = await uploadSlideImage(
        blob,
        sessionId,
        startOrder + insertedSlides.length,
        `${file.name}-page-${pageNumber}`
      )
      const { data: slide, error: fnError } = await supabase.rpc('insert_slide', {
        p_session_id: sessionId,
        p_url: url,
        p_name: `${file.name} - Page ${pageNumber}`,
        p_slide_order: startOrder + insertedSlides.length,
      })

      if (fnError) throw new Error(`Database error: ${fnError.message}`)
      if (slide && slide.length > 0) insertedSlides.push(slide[0])
      onProgress?.(
        Math.min(95, 5 + Math.round((pageNumber / Math.max(1, pdf.numPages)) * 90)),
        `Rendered PDF page ${pageNumber} of ${pdf.numPages}`
      )
    }
  } finally {
    await loadingTask.destroy()
  }

  return insertedSlides
}

const SESSION_STORAGE_KEY = 'syncslide.activeSession'

export function useWhiteboardSession(): WhiteboardSession {
  const [role, setRole] = useState<'presenter' | 'joiner' | null>(null)
  const [sessionCode, setSessionCode] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [strokes, setStrokes] = useState<Map<string, StrokeData>>(new Map())
  const [joinerConnected, setJoinerConnected] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const strokesRef = useRef<Map<string, StrokeData>>(new Map())
  const slidesRef = useRef<Slide[]>([])
  const currentSlideIndexRef = useRef(0)
  const tempStrokeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const restoringRef = useRef(false)
  const renderSequenceRef = useRef(0)
  const slideLoadTokenRef = useRef(0)
  const strokeLoadTokenRef = useRef(0)
  const drawPointCallbackRef = useRef<((payload: {
    strokeId: string
    x: number
    y: number
    color: string
    width: number
    type: 'start' | 'move' | 'end'
    mode?: string
  }) => void) | null>(null)

  useEffect(() => { strokesRef.current = strokes }, [strokes])
  useEffect(() => { slidesRef.current = slides }, [slides])
  useEffect(() => { currentSlideIndexRef.current = currentSlideIndex }, [currentSlideIndex])

  useEffect(() => {
    if (role && sessionCode && sessionId && connectionState === 'connected') {
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ role, sessionCode, sessionId, currentSlideIndex })
      )
    }
  }, [role, sessionCode, sessionId, connectionState, currentSlideIndex])

  const clearTempStrokeTimer = useCallback((strokeId: string) => {
    const timer = tempStrokeTimersRef.current.get(strokeId)
    if (timer) clearTimeout(timer)
    tempStrokeTimersRef.current.delete(strokeId)
  }, [])

  const syncJoinerPresence = useCallback((channel: RealtimeChannel) => {
    const state = channel.presenceState()
    const hasJoiner = Object.values(state).some((presences: any) =>
      presences.some((p: any) => p.role === 'joiner')
    )
    setJoinerConnected(hasJoiner)
  }, [])

  const loadStrokesForSlide = useCallback(async (sessId: string, slideIndex: number) => {
    const requestToken = ++strokeLoadTokenRef.current
    const { data, error: loadError } = await supabase
      .from('drawings')
      .select('stroke_data')
      .eq('session_id', sessId)
      .eq('slide_index', slideIndex)

    if (loadError) return
    if (requestToken !== strokeLoadTokenRef.current) return

    const loaded = new Map<string, StrokeData>()
    for (const row of data || []) {
      const stroke = row.stroke_data as StrokeData
      loaded.set(stroke.strokeId, stroke)
    }
    setStrokes(loaded)
    strokesRef.current = loaded
  }, [])

  const refreshSlides = useCallback(async (sessId: string) => {
    const requestToken = ++slideLoadTokenRef.current
    const { data: existingSlides } = await supabase
      .from('slides')
      .select('*')
      .eq('session_id', sessId)
      .order('slide_order')

    if (requestToken !== slideLoadTokenRef.current) return

    const orderedSlides = existingSlides || []
    setSlides(orderedSlides)
    slidesRef.current = orderedSlides
  }, [])

  const eraseStroke = useCallback(async (strokeId: string) => {
    clearTempStrokeTimer(strokeId)

    setStrokes((prev) => {
      const next = new Map(prev)
      next.delete(strokeId)
      strokesRef.current = next
      return next
    })

    channelRef.current?.send({ type: 'broadcast', event: 'stroke_erase', payload: { strokeId } })

    if (!sessionId) return

    try {
      const { data: allDrawings } = await supabase
        .from('drawings')
        .select('id, stroke_data')
        .eq('session_id', sessionId)
        .eq('slide_index', currentSlideIndexRef.current)

      if (allDrawings) {
        const target = allDrawings.find(
          (row: any) => (row.stroke_data as StrokeData).strokeId === strokeId
        )

        if (target) {
          await supabase.from('drawings').delete().eq('id', target.id)
        }
      }
    } catch {
      // Silent on purpose. Erasing should feel instant even if persistence lags.
    }
  }, [clearTempStrokeTimer, sessionId])

  const clearAll = useCallback(async () => {
    for (const timer of tempStrokeTimersRef.current.values()) clearTimeout(timer)
    tempStrokeTimersRef.current.clear()
    strokeLoadTokenRef.current += 1

    setStrokes(new Map())
    strokesRef.current = new Map()
    channelRef.current?.send({ type: 'broadcast', event: 'clear_all', payload: {} })

    if (sessionId) {
      await supabase
        .from('drawings')
        .delete()
        .eq('session_id', sessionId)
    }
  }, [sessionId])

  const deleteAllSlides = useCallback(async () => {
    if (!sessionId) return

    slideLoadTokenRef.current += 1
    strokeLoadTokenRef.current += 1

    setSlides([])
    slidesRef.current = []
    setCurrentSlideIndex(0)
    currentSlideIndexRef.current = 0
    setStrokes(new Map())
    strokesRef.current = new Map()

    await supabase
      .from('drawings')
      .delete()
      .eq('session_id', sessionId)

    await supabase
      .from('slides')
      .delete()
      .eq('session_id', sessionId)

    channelRef.current?.send({
      type: 'broadcast',
      event: 'slides_updated',
      payload: { changedAt: Date.now() },
    })
    channelRef.current?.send({
      type: 'broadcast',
      event: 'slide_changed',
      payload: { index: 0 },
    })
    channelRef.current?.send({
      type: 'broadcast',
      event: 'clear_all',
      payload: {},
    })
  }, [sessionId])

  const scheduleTempStrokeRemoval = useCallback((strokeId: string, ttlMs: number) => {
    clearTempStrokeTimer(strokeId)

    const timer = setTimeout(() => {
      tempStrokeTimersRef.current.delete(strokeId)
      void eraseStroke(strokeId)
    }, ttlMs)

    tempStrokeTimersRef.current.set(strokeId, timer)
  }, [clearTempStrokeTimer, eraseStroke])

  const setupChannel = useCallback((code: string, sessId: string, isPresenter: boolean) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase.channel(`room:${code}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        if (isPresenter) syncJoinerPresence(channel)
      })
      .on('presence', { event: 'join' }, ({ currentPresences }) => {
        if (isPresenter && currentPresences.some((p: any) => p.role === 'joiner')) {
          setJoinerConnected(true)
        }
      })
      .on('presence', { event: 'leave' }, () => {
        if (isPresenter) syncJoinerPresence(channel)
      })

    channel.on('broadcast', { event: 'draw_point' }, (payload) => {
      const { strokeId, x, y, color, width, type: moveType, mode, ttlMs } = payload.payload

      drawPointCallbackRef.current?.({
        strokeId, x, y, color, width, type: moveType, mode,
      })

      setStrokes((prev) => {
        const next = new Map(prev)
        const existing = next.get(strokeId)

        if (moveType === 'start') {
          next.set(strokeId, {
            strokeId,
            points: [{ x, y }],
            color,
            width,
            mode,
          })

          if (mode === 'temp') {
            scheduleTempStrokeRemoval(strokeId, ttlMs || 3000)
          }
        } else if (existing) {
          next.set(strokeId, {
            ...existing,
            points: [...existing.points, { x, y }],
            mode: existing.mode || mode,
          })
        }

        strokesRef.current = next
        return next
      })
    })

    channel.on('broadcast', { event: 'slides_updated' }, () => {
      void refreshSlides(sessId)
    })

    channel.on('broadcast', { event: 'slide_changed' }, (payload) => {
      const newSlideIdx = payload.payload.index
      setCurrentSlideIndex(newSlideIdx)
      currentSlideIndexRef.current = newSlideIdx
      loadStrokesForSlide(sessId, newSlideIdx)
    })

    channel.on('broadcast', { event: 'clear_all' }, () => {
      strokeLoadTokenRef.current += 1
      for (const timer of tempStrokeTimersRef.current.values()) clearTimeout(timer)
      tempStrokeTimersRef.current.clear()
      setStrokes(new Map())
      strokesRef.current = new Map()
    })

    channel.on('broadcast', { event: 'stroke_erase' }, (payload) => {
      const { strokeId } = payload.payload
      clearTempStrokeTimer(strokeId)
      setStrokes((prev) => {
        const next = new Map(prev)
        next.delete(strokeId)
        strokesRef.current = next
        return next
      })
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          role: isPresenter ? 'presenter' : 'joiner',
          joinedAt: Date.now(),
        })

        const { data: existingSlides } = await supabase
          .from('slides')
          .select('*')
          .eq('session_id', sessId)
          .order('slide_order')

        setSlides(existingSlides || [])
        slidesRef.current = existingSlides || []

        if (isPresenter) syncJoinerPresence(channel)
        loadStrokesForSlide(sessId, currentSlideIndexRef.current)
      }
    })

    channelRef.current = channel
    return channel
  }, [clearTempStrokeTimer, loadStrokesForSlide, refreshSlides, scheduleTempStrokeRemoval, syncJoinerPresence])

  useEffect(() => {
    if (restoringRef.current) return
    restoringRef.current = true

    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return

    let parsed: any = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }

    const savedRole = parsed?.role === 'joiner' ? 'joiner' : parsed?.role === 'presenter' ? 'presenter' : null
    const savedCode = typeof parsed?.sessionCode === 'string' ? parsed.sessionCode : ''
    const savedSlideIndex = Number.isFinite(parsed?.currentSlideIndex) ? Number(parsed.currentSlideIndex) : 0

    if (!savedRole || !savedCode) return

    ;(async () => {
      setConnectionState('connecting')
      setRole(savedRole)
      setSessionCode(savedCode)
      setCurrentSlideIndex(savedSlideIndex)
      currentSlideIndexRef.current = savedSlideIndex

      try {
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', savedCode.toUpperCase())
          .maybeSingle()

        if (sessionError) throw sessionError
        if (!session) {
          window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
          setRole(null)
          setSessionCode(null)
          setConnectionState('idle')
          return
        }

        setSessionId(session.id)
        setSessionCode(session.code)
        setConnectionState('connected')
        setupChannel(session.code, session.id, savedRole === 'presenter')
      } catch (err: any) {
        setError(err.message || 'Failed to restore session')
        setConnectionState('error')
        setRole(null)
      }
    })()
  }, [setupChannel])

  const createSession = useCallback(async () => {
    setConnectionState('connecting')
    setRole('presenter')
    setError(null)

    try {
      let code = generateSessionCode()
      let retries = 0

      while (retries < 5) {
        const { data: existing } = await supabase
          .from('sessions')
          .select('id')
          .eq('code', code)
          .maybeSingle()

        if (!existing) break
        code = generateSessionCode()
        retries++
      }

      setSessionCode(code)

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({ code })
        .select()
        .single()

      if (sessionError) throw sessionError

      setSessionId(session.id)
      setSessionCode(session.code)
      setConnectionState('connected')
      setupChannel(session.code, session.id, true)
    } catch (err: any) {
      setError(err.message || 'Failed to create session')
      setConnectionState('error')
      setRole(null)
      setSessionCode(null)
    }
  }, [setupChannel])

  const joinSession = useCallback(async (code: string) => {
    setConnectionState('connecting')
    setRole('joiner')
    setError(null)

    try {
      const codeUpper = code.toUpperCase()
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('code', codeUpper)
        .maybeSingle()

      if (sessionError) throw sessionError
      if (!session) throw new Error('Session not found. Check the code.')

      setSessionId(session.id)
      setSessionCode(session.code)
      setConnectionState('connected')
      setupChannel(session.code, session.id, false)
    } catch (err: any) {
      setError(err.message || 'Failed to join session')
      setConnectionState('error')
      setRole(null)
      setSessionCode(null)
    }
  }, [setupChannel])

  const sendStrokePoint = useCallback(
    (
      strokeId: string,
      x: number,
      y: number,
      color: string,
      width: number,
      type: 'start' | 'move' | 'end',
      options?: { mode?: 'permanent' | 'temp' | 'hold'; ttlMs?: number }
    ) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'draw_point',
        payload: {
          strokeId,
          x,
          y,
          color,
          width,
          type,
          mode: options?.mode || 'permanent',
          ttlMs: options?.ttlMs,
        },
      })
    },
    []
  )

  const saveStroke = useCallback(
    async (stroke: StrokeData) => {
      if (!sessionId || stroke.mode && stroke.mode !== 'permanent') return

      try {
        await supabase.from('drawings').insert({
          session_id: sessionId,
          slide_index: currentSlideIndexRef.current,
          stroke_data: stroke,
        })

        setStrokes((prev) => {
          const next = new Map(prev)
          next.set(stroke.strokeId, stroke)
          strokesRef.current = next
          return next
        })
      } catch {
        // Silent on purpose.
      }
    },
    [sessionId]
  )

  const changeSlide = useCallback(
    async (index: number) => {
      setCurrentSlideIndex(index)
      currentSlideIndexRef.current = index
      channelRef.current?.send({ type: 'broadcast', event: 'slide_changed', payload: { index } })
      if (sessionId) loadStrokesForSlide(sessionId, index)
    },
    [sessionId, loadStrokesForSlide]
  )

  const uploadSlide = useCallback(
    async (file: File, onProgress?: (progress: number, message: string) => void) => {
      if (!sessionId) throw new Error('No active session')
      const baseSlideCount = slidesRef.current.length

      const reportProgress = (progress: number, message: string) => {
        if (onProgress) onProgress(Math.max(0, Math.min(100, progress)), message)
      }

      const insertSlide = async (url: string, displayName: string, slideOrder: number) => {
        const { data: slide, error: fnError } = await supabase.rpc('insert_slide', {
          p_session_id: sessionId,
          p_url: url,
          p_name: displayName,
          p_slide_order: slideOrder,
        })

        if (fnError) throw new Error(`Database error: ${fnError.message}`)
        if (!slide || slide.length === 0) throw new Error('Slide inserted but no data returned.')
        return slide[0] as Slide
      }

      const publishSlides = (newSlides: Slide[], focusIndex?: number) => {
        setSlides(newSlides)
        slidesRef.current = newSlides
        channelRef.current?.send({
          type: 'broadcast',
          event: 'slides_updated',
          payload: { changedAt: Date.now() },
        })

        if (typeof focusIndex === 'number') {
          setCurrentSlideIndex(focusIndex)
          currentSlideIndexRef.current = focusIndex
          channelRef.current?.send({
            type: 'broadcast',
            event: 'slide_changed',
            payload: { index: focusIndex },
          })
          void loadStrokesForSlide(sessionId, focusIndex)
        }
      }

      if (isImageFile(file)) {
        reportProgress(10, `Uploading image ${file.name}...`)
        const url = await uploadSlideImage(
          file,
          sessionId,
          baseSlideCount,
          file.name,
          file.type || 'image/png',
          (file.name.split('.').pop() || 'png').toLowerCase()
        )
        reportProgress(75, `Saving image ${file.name}...`)
        const inserted = await insertSlide(url, file.name, baseSlideCount)
        const newSlides = [...slidesRef.current, inserted]
        publishSlides(newSlides, baseSlideCount)
        reportProgress(100, `Uploaded ${file.name}`)

        return [inserted]
      }

      if (isPdfFile(file)) {
        const insertedSlides = await renderPdfPages(file, sessionId, baseSlideCount, reportProgress)
        if (insertedSlides.length === 0) {
          throw new Error('Failed to render any pages from the PDF.')
        }

        const newSlides = [...slidesRef.current, ...insertedSlides]
        publishSlides(newSlides, baseSlideCount)
        reportProgress(100, `Uploaded ${file.name}`)

        return insertedSlides
      }

      if (isPowerPointFile(file)) {
        const renderer = new PptxRenderer()
        reportProgress(2, `Reading ${file.name}...`)
        await renderer.load(file, (progress, message) => {
          reportProgress(5 + Math.round(progress * 35), message || 'Reading PowerPoint...')
        })
        const slideCount = renderer.slideCount
        const insertedSlides: Slide[] = []

        try {
          for (let i = 0; i < slideCount; i++) {
            reportProgress(
              40 + Math.round((i / Math.max(1, slideCount)) * 50),
              `Rendering slide ${i + 1} of ${slideCount}...`
            )
            let blob: Blob
            try {
              blob = await renderer.toBlob(i, 2560, 'image/png')
            } catch {
              const svgText = await renderer.toSvg(i)
              const canvas = document.createElement('canvas')
              canvas.width = 2560
              canvas.height = Math.round(2560 * 9 / 16)
              const ctx = canvas.getContext('2d')!
              const img = new Image()
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve()
                img.onerror = reject
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText)
              })
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              blob = await canvasToBlob(canvas)
            }
            const url = await uploadSlideImage(
              blob,
              sessionId,
              baseSlideCount + insertedSlides.length,
              `${file.name}-slide-${i + 1}`,
              'image/png',
              'png'
            )
            const inserted = await insertSlide(
              url,
              `${file.name} - Slide ${i + 1}`,
              baseSlideCount + insertedSlides.length
            )
            insertedSlides.push(inserted)
          }
        } finally {
          renderer.destroy()
        }

        if (insertedSlides.length === 0) {
          throw new Error('No slides could be rendered from this .pptx file.')
        }

        const newSlides = [...slidesRef.current, ...insertedSlides]
        publishSlides(newSlides, baseSlideCount)
        reportProgress(100, `Uploaded ${file.name}`)

        return insertedSlides
      }

      if (isLegacyPowerPointFile(file)) {
        const inserted = await insertSlide(
          createPlaceholderSlideDataUrl(file.name, 'Legacy .ppt uploaded. Convert to .pptx to preview in presentation.'),
          `${file.name} - Legacy PPT`,
          baseSlideCount
        )

        const newSlides = [...slidesRef.current, inserted]
        publishSlides(newSlides, baseSlideCount)
        reportProgress(100, `Uploaded ${file.name}`)

        return [inserted]
      }

      throw new Error('Unsupported file type. Please upload an image, PDF, PPT, or PPTX.')
    },
    [loadStrokesForSlide, sessionId]
  )

  const deleteSlide = useCallback(async (slideId: string) => {
    if (!sessionId) return

    const slideIndex = slidesRef.current.findIndex((slide) => slide.id === slideId)
    if (slideIndex < 0) return

    const removedSlide = slidesRef.current[slideIndex]
    const remainingSlides = slidesRef.current.filter((slide) => slide.id !== slideId)

    await supabase
      .from('drawings')
      .delete()
      .eq('session_id', sessionId)
      .eq('slide_index', slideIndex)

    const { data: laterDrawings } = await supabase
      .from('drawings')
      .select('id, slide_index')
      .eq('session_id', sessionId)
      .gt('slide_index', slideIndex)
      .order('slide_index', { ascending: true })

    for (const row of laterDrawings || []) {
      await supabase
        .from('drawings')
        .update({ slide_index: row.slide_index - 1 })
        .eq('id', row.id)
    }

    await supabase
      .from('slides')
      .delete()
      .eq('id', slideId)

    const { data: laterSlides } = await supabase
      .from('slides')
      .select('id, slide_order')
      .eq('session_id', sessionId)
      .gt('slide_order', removedSlide.slide_order)
      .order('slide_order', { ascending: true })

    for (const row of laterSlides || []) {
      await supabase
        .from('slides')
        .update({ slide_order: row.slide_order - 1 })
        .eq('id', row.id)
    }

    const normalizedSlides = remainingSlides
      .map((slide, index) => ({ ...slide, slide_order: index }))
      .sort((a, b) => a.slide_order - b.slide_order)

    setSlides(normalizedSlides)
    slidesRef.current = normalizedSlides

    const nextIndex = Math.min(slideIndex, Math.max(0, normalizedSlides.length - 1))
    setCurrentSlideIndex(nextIndex)
    currentSlideIndexRef.current = nextIndex
    channelRef.current?.send({ type: 'broadcast', event: 'slides_updated', payload: { changedAt: Date.now() } })
    channelRef.current?.send({ type: 'broadcast', event: 'slide_changed', payload: { index: nextIndex } })
    if (sessionId && normalizedSlides.length > 0) {
      void loadStrokesForSlide(sessionId, nextIndex)
    } else {
      setStrokes(new Map())
      strokesRef.current = new Map()
    }
  }, [loadStrokesForSlide, sessionId])

  const saveCanvasImage = useCallback(async () => {
    const canvas = document.querySelector('canvas.main-canvas')
    if (!canvas) return null
    return (canvas as HTMLCanvasElement).toDataURL('image/png')
  }, [])

  const setDrawPointCallback = useCallback((
    cb: typeof drawPointCallbackRef.current
  ) => {
    drawPointCallbackRef.current = cb
  }, [])

  const disconnect = useCallback(() => {
    for (const timer of tempStrokeTimersRef.current.values()) clearTimeout(timer)
    tempStrokeTimersRef.current.clear()

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = null
    slideLoadTokenRef.current += 1
    strokeLoadTokenRef.current += 1
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    setRole(null)
    setSessionCode(null)
    setSessionId(null)
    setConnectionState('idle')
    setError(null)
    setSlides([])
    setCurrentSlideIndex(0)
    setStrokes(new Map())
    strokesRef.current = new Map()
    setJoinerConnected(false)
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of tempStrokeTimersRef.current.values()) clearTimeout(timer)
      tempStrokeTimersRef.current.clear()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  return {
    role,
    sessionCode,
    sessionId,
    connectionState,
    error,
    slides,
    currentSlideIndex,
    strokes,
    joinerConnected,
    createSession,
    joinSession,
    sendStrokePoint,
    saveStroke,
    eraseStroke,
    clearAll,
    deleteAllSlides,
    changeSlide,
    uploadSlide,
    deleteSlide,
    saveCanvasImage,
    disconnect,
    setDrawPointCallback,
  }
}
