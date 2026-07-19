import { useRef, useEffect, useState, useCallback } from 'react'
import { WhiteboardSession, StrokePoint, StrokeData } from '../hooks/useWhiteboardSession'

const COLORS = [
  '#ef4444', '#dc2626', '#b91c1c',
  '#f97316', '#ea580c',
  '#eab308', '#ca8a04',
  '#22c55e', '#16a34a', '#15803d',
  '#06b6d4', '#0891b2',
  '#6366f1', '#4f46e5', '#4338ca',
  '#a855f7', '#9333ea',
  '#ec4899', '#db2777',
  '#f43f5e', '#e11d48',
  '#ffffff', '#f1f5f9', '#94a3b8', '#64748b', '#334155', '#1e293b', '#0f172a',
]

const PEN_SIZES = [2, 4, 6, 10, 16]

interface MobileViewProps {
  session: WhiteboardSession
}

export function MobileView({ session }: MobileViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState('#ef4444')
  const [penSize, setPenSize] = useState(4)
  const [eraserMode, setEraserMode] = useState(false)
  const [highlighterMode, setHighlighterMode] = useState(false)
  const [laserMode, setLaserMode] = useState(false)
  const [holdRedActive, setHoldRedActive] = useState(false)
  const [autoEraseActive, setAutoEraseActive] = useState(false)
  const autoEraseSecondsRef = useRef(3)
  const [autoEraseSeconds, setAutoEraseSeconds] = useState(3)
  const [tempStrokes, setTempStrokes] = useState<Map<string, StrokeData>>(new Map())
  const [fullscreen, setFullscreen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMessage, setUploadMessage] = useState('')
  const isDrawingRef = useRef(false)
  const strokeIdRef = useRef('')
  const currentPointsRef = useRef<StrokePoint[]>([])
  const currentStrokeModeRef = useRef<'permanent' | 'temp' | 'hold' | 'highlighter' | 'laser'>('permanent')
  const activeTempStrokeRef = useRef<StrokeData | null>(null)
  const tempStrokeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const holdStrokeIdsRef = useRef<string[]>([])
  const renderSequenceRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideImageRef = useRef<HTMLImageElement | null>(null)
  const slideUrlRef = useRef('')
  const currentSlide = session.slides[session.currentSlideIndex]

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    }
  }, [])

  const loadSlideImage = useCallback((slideUrl: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      if (slideUrlRef.current === slideUrl && slideImageRef.current) {
        resolve(slideImageRef.current)
        return
      }
      const img = new Image()
      img.onload = () => {
        slideImageRef.current = img
        slideUrlRef.current = slideUrl
        resolve(img)
      }
      img.onerror = () => {
        slideImageRef.current = null
        slideUrlRef.current = ''
        resolve(null)
      }
      img.src = slideUrl
    })
  }, [])

  const getCanvasDims = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const container = containerRef.current
    if (!container) return null
    const contRect = container.getBoundingClientRect()
    const aspect = 16 / 9
    let w: number, h: number
    const maxW = contRect.width
    const maxH = contRect.height
    if (maxW / maxH > aspect) {
      h = maxH
      w = h * aspect
    } else {
      w = maxW
      h = w / aspect
    }
    return { w: Math.floor(w), h: Math.floor(h) }
  }, [])

  const initCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    const dims = getCanvasDims()
    if (!canvas || !dims) return null
    const { w, h } = dims
    const dpr = window.devicePixelRatio || 1
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    return dims
  }, [getCanvasDims])

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current
    const dims = initCanvasSize()
    if (!canvas || !dims) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = dims
    const dpr = window.devicePixelRatio || 1

    ctx.save()
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    if (currentSlide) {
      const img = slideUrlRef.current === currentSlide.url ? slideImageRef.current : null
      if (img) {
        ctx.drawImage(img, 0, 0, w, h)
        drawAllStrokes(ctx, w, h)
      } else {
        const loaded = await loadSlideImage(currentSlide.url)
        if (loaded) {
          ctx.drawImage(loaded, 0, 0, w, h)
        } else {
          drawPlaceholder(ctx, w, h, currentSlide.name)
        }
        drawAllStrokes(ctx, w, h)
      }
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, w, h)
      if (session.slides.length === 0) {
        ctx.fillStyle = '#64748b'
        ctx.font = '16px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('Upload a slide to begin', w / 2, h / 2)
      }
    }

    ctx.restore()
  }, [currentSlide, initCanvasSize, loadSlideImage, session.slides.length, tempStrokes, session.strokes])

  function drawAllStrokes(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save()
    const visibleStrokes = [
      ...session.strokes.values(),
      ...tempStrokes.values(),
    ]
    for (const stroke of visibleStrokes) {
      if (stroke.points.length < 2) continue
      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = (stroke.width * Math.min(w, h)) / 500
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 0; i < stroke.points.length; i++) {
        const px = stroke.points[i].x * w
        const py = stroke.points[i].y * h
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number, name: string) {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h / 2
    ctx.fillStyle = 'rgba(99,102,241,0.1)'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(w, h) * 0.12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = `${Math.min(w, h) * 0.04}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name || 'Unsupported file', cx, cy - Math.min(w, h) * 0.02)
    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.min(w, h) * 0.03}px system-ui`
    ctx.fillText('Preview not available', cx, cy + Math.min(w, h) * 0.05)
  }

  function drawLivePoint(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.lineTo(x * w, y * h)
    ctx.stroke()
  }

  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  useEffect(() => {
    const handleResize = () => renderCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [renderCanvas])

  useEffect(() => {
    setHoldRedActive(false)
    holdStrokeIdsRef.current = []
    activeTempStrokeRef.current = null
    for (const timer of tempStrokeTimersRef.current.values()) clearTimeout(timer)
    tempStrokeTimersRef.current.clear()
    setTempStrokes(new Map())
  }, [session.currentSlideIndex])

  useEffect(() => {
    return () => {
      for (const timer of tempStrokeTimersRef.current.values()) clearTimeout(timer)
      tempStrokeTimersRef.current.clear()
    }
  }, [])

  function findNearestStroke(x: number, y: number) {
    const threshold = 0.03
    let nearestId: string | null = null
    let nearestDist = threshold
    const allStrokes = [...session.strokes.values(), ...tempStrokes.values()]
    for (const stroke of allStrokes) {
      for (const pt of stroke.points) {
        const dx = pt.x - x
        const dy = pt.y - y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestId = stroke.strokeId
        }
      }
    }
    return nearestId
  }

  const syncTempStroke = useCallback((stroke: StrokeData) => {
    setTempStrokes((prev) => {
      const next = new Map(prev)
      next.set(stroke.strokeId, stroke)
      return next
    })
    activeTempStrokeRef.current = stroke
  }, [])

  const removeTempStroke = useCallback((strokeId: string) => {
    const timer = tempStrokeTimersRef.current.get(strokeId)
    if (timer) clearTimeout(timer)
    tempStrokeTimersRef.current.delete(strokeId)

    setTempStrokes((prev) => {
      const next = new Map(prev)
      next.delete(strokeId)
      return next
    })

    if (activeTempStrokeRef.current?.strokeId === strokeId) {
      activeTempStrokeRef.current = null
    }
  }, [])

  const finalizeTempStroke = useCallback((strokeId: string, ttlMs = 3000) => {
    const timer = setTimeout(() => {
      removeTempStroke(strokeId)
      void session.eraseStroke(strokeId)
      renderCanvas()
    }, ttlMs)

    tempStrokeTimersRef.current.set(strokeId, timer)
  }, [removeTempStroke, renderCanvas, session])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getCanvasCoords(e.clientX, e.clientY)
    if (coords.x < 0 || coords.x > 1 || coords.y < 0 || coords.y > 1) return

    if (eraserMode) {
      const targetId = findNearestStroke(coords.x, coords.y)
      if (targetId) {
        session.eraseStroke(targetId)
      }
      return
    }

    isDrawingRef.current = true
    strokeIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    currentPointsRef.current = [{ x: coords.x, y: coords.y }]
    currentStrokeModeRef.current = highlighterMode
      ? 'highlighter'
      : laserMode
        ? 'laser'
        : autoEraseActive
          ? 'temp'
          : color === '#22c55e'
            ? 'temp'
            : holdRedActive
              ? 'hold'
              : 'permanent'

    canvas.setPointerCapture(e.pointerId)

    const strokeColor = highlighterMode
      ? 'rgba(255, 238, 88, 0.45)'
      : laserMode
        ? 'rgba(255, 60, 60, 0.85)'
        : color === '#22c55e'
          ? '#22c55e'
          : holdRedActive
            ? '#ef4444'
            : color

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.width / dpr
    const cssH = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = highlighterMode
      ? (20 * Math.min(cssW, cssH)) / 500
      : laserMode
        ? (6 * Math.min(cssW, cssH)) / 500
        : (penSize * Math.min(cssW, cssH)) / 500
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(coords.x * cssW, coords.y * cssH)

    ctx.restore()

    if (currentStrokeModeRef.current !== 'permanent') {
      syncTempStroke({
        strokeId: strokeIdRef.current,
        points: [{ x: coords.x, y: coords.y }],
        color: strokeColor,
        width: highlighterMode ? 20 : laserMode ? 6 : penSize,
        mode: currentStrokeModeRef.current,
      })
    }

    const modeTtlMs = highlighterMode ? 5000 : laserMode ? 1500 : autoEraseActive ? autoEraseSeconds * 1000 : 3000

    session.sendStrokePoint(
      strokeIdRef.current,
      coords.x,
      coords.y,
      strokeColor,
      highlighterMode ? 20 : laserMode ? 6 : penSize,
      'start',
      currentStrokeModeRef.current === 'temp' || currentStrokeModeRef.current === 'highlighter' || currentStrokeModeRef.current === 'laser'
        ? { mode: 'temp', ttlMs: modeTtlMs }
        : currentStrokeModeRef.current === 'hold'
          ? { mode: 'hold' }
          : { mode: 'permanent' }
    )
  }, [color, penSize, getCanvasCoords, session, eraserMode, holdRedActive, syncTempStroke, highlighterMode, laserMode])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return
    e.preventDefault()

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const coords = getCanvasCoords(e.clientX, e.clientY)
    if (coords.x < 0 || coords.x > 1 || coords.y < 0 || coords.y > 1) return

    currentPointsRef.current.push({ x: coords.x, y: coords.y })

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.width / dpr
    const cssH = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.lineTo(coords.x * cssW, coords.y * cssH)
    ctx.stroke()
    ctx.restore()

    if (currentStrokeModeRef.current !== 'permanent') {
      const existing = activeTempStrokeRef.current
      if (existing) {
        syncTempStroke({
          ...existing,
          points: [...currentPointsRef.current],
        })
      }
    }

    const strokeColor = highlighterMode
      ? 'rgba(255, 238, 88, 0.45)'
      : laserMode
        ? 'rgba(255, 60, 60, 0.85)'
        : color === '#22c55e'
          ? '#22c55e'
          : holdRedActive
            ? '#ef4444'
            : color

    const modeTtlMs = highlighterMode ? 5000 : laserMode ? 1500 : autoEraseActive ? autoEraseSeconds * 1000 : 3000

    session.sendStrokePoint(
      strokeIdRef.current,
      coords.x,
      coords.y,
      strokeColor,
      highlighterMode ? 20 : laserMode ? 6 : penSize,
      'move',
      currentStrokeModeRef.current === 'temp' || currentStrokeModeRef.current === 'highlighter' || currentStrokeModeRef.current === 'laser'
        ? { mode: 'temp', ttlMs: modeTtlMs }
        : currentStrokeModeRef.current === 'hold'
          ? { mode: 'hold' }
          : { mode: 'permanent' }
    )
  }, [getCanvasCoords, session, color, penSize, holdRedActive, syncTempStroke, highlighterMode, laserMode, autoEraseActive, autoEraseSeconds])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return
    e.preventDefault()
    isDrawingRef.current = false

    const coords = getCanvasCoords(e.clientX, e.clientY)
    const strokeColor = highlighterMode
      ? 'rgba(255, 238, 88, 0.45)'
      : laserMode
        ? 'rgba(255, 60, 60, 0.85)'
        : color === '#22c55e'
          ? '#22c55e'
          : holdRedActive
            ? '#ef4444'
            : color
    const modeTtlMs = highlighterMode ? 5000 : laserMode ? 1500 : autoEraseActive ? autoEraseSeconds * 1000 : 3000

    if (coords.x >= 0 && coords.x <= 1 && coords.y >= 0 && coords.y <= 1) {
      currentPointsRef.current.push({ x: coords.x, y: coords.y })
      session.sendStrokePoint(
        strokeIdRef.current,
        coords.x,
        coords.y,
        strokeColor,
        highlighterMode ? 20 : laserMode ? 6 : penSize,
        'end',
        currentStrokeModeRef.current === 'temp' || currentStrokeModeRef.current === 'highlighter' || currentStrokeModeRef.current === 'laser'
          ? { mode: 'temp', ttlMs: modeTtlMs }
          : currentStrokeModeRef.current === 'hold'
            ? { mode: 'hold' }
            : { mode: 'permanent' }
      )
    }

    const points = currentPointsRef.current
    if (points.length > 1) {
      const stroke: StrokeData = {
        strokeId: strokeIdRef.current,
        points,
        color: strokeColor,
        width: highlighterMode ? 20 : laserMode ? 6 : penSize,
        mode: currentStrokeModeRef.current,
      }

      if (currentStrokeModeRef.current === 'permanent') {
        session.saveStroke(stroke)
      } else if (currentStrokeModeRef.current === 'temp' || currentStrokeModeRef.current === 'highlighter' || currentStrokeModeRef.current === 'laser') {
        syncTempStroke(stroke)
        finalizeTempStroke(stroke.strokeId, modeTtlMs)
      } else if (currentStrokeModeRef.current === 'hold') {
        syncTempStroke(stroke)
        holdStrokeIdsRef.current.push(stroke.strokeId)
      }
    }
  }, [getCanvasCoords, session, color, penSize, holdRedActive, syncTempStroke, finalizeTempStroke, highlighterMode, laserMode, autoEraseActive, autoEraseSeconds])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    try {
      setUploading(true)
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        const isImage = file.type.startsWith('image/')
        const isPpt = file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt')
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
        if (!isImage && !isPpt && !isPdf) {
          alert(`Skipping unsupported file: ${file.name}`)
          continue
        }
        if (file.size > 20 * 1024 * 1024) {
          alert(`Skipping ${file.name}: file too large. Maximum size is 20MB.`)
          continue
        }

        setUploadProgress(0)
        setUploadMessage(`Uploading ${index + 1} of ${files.length}: ${file.name}`)

        await session.uploadSlide(file, (progress, message) => {
          const overall = ((index + progress / 100) / files.length) * 100
          setUploadProgress(overall)
          setUploadMessage(`${index + 1} of ${files.length}: ${message}`)
        })
      }
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('row-level security') || msg.includes('Database error')) {
        alert('Upload failed: Database permission issue.\n\nRun the full migration SQL from supabase/migration.sql in Supabase Dashboard → SQL Editor.')
      } else {
        alert('Upload failed: ' + msg)
      }
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setUploadMessage('')
    }
    e.target.value = ''
  }

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      setFullscreen(true)
    } else {
      await document.exitFullscreen()
      setFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFSChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFSChange)
    return () => document.removeEventListener('fullscreenchange', handleFSChange)
  }, [])

  const handleSave = async () => {
    const dataUrl = await session.saveCanvasImage()
    if (!dataUrl) return
    const link = document.createElement('a')
    link.download = `syncslide-${Date.now()}.png`
    link.href = dataUrl
    link.click()
  }

  const activateHoldRed = () => {
    setHoldRedActive(true)
    setEraserMode(false)
    setHighlighterMode(false)
    setLaserMode(false)
    setAutoEraseActive(false)
    setColor('#ef4444')
  }

  const releaseHoldRed = async () => {
    setHoldRedActive(false)
    const ids = [...holdStrokeIdsRef.current]
    holdStrokeIdsRef.current = []

    for (const strokeId of ids) {
      removeTempStroke(strokeId)
      await session.eraseStroke(strokeId)
    }

    renderCanvas()
  }

  const handleClearAll = async () => {
    setHoldRedActive(false)
    setHighlighterMode(false)
    setLaserMode(false)
    setAutoEraseActive(false)
    holdStrokeIdsRef.current = []
    activeTempStrokeRef.current = null

    for (const timer of tempStrokeTimersRef.current.values()) clearTimeout(timer)
    tempStrokeTimersRef.current.clear()
    setTempStrokes(new Map())

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    await session.clearAll()
  }

  const handleDeleteCurrentSlide = async () => {
    const current = session.slides[session.currentSlideIndex]
    if (!current) return
    if (!window.confirm(`Delete slide "${current.name}"?`)) return
    await session.deleteSlide(current.id)
  }

  const handleDeleteAllSlides = async () => {
    if (!session.slides.length) return
    if (!window.confirm('Delete all uploaded slides?')) return
    await session.deleteAllSlides()
  }

  const goPrevSlide = async () => {
    if (session.currentSlideIndex <= 0) return
    await session.changeSlide(session.currentSlideIndex - 1)
  }

  const goNextSlide = async () => {
    if (session.currentSlideIndex >= session.slides.length - 1) return
    await session.changeSlide(session.currentSlideIndex + 1)
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#0f0f1a',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)' }}>
            SyncSlide
          </span>
          <span style={{
            fontSize: 11,
            fontFamily: "'Courier New', monospace",
            color: 'var(--text-muted)',
            background: 'var(--bg-primary)',
            padding: '2px 8px',
            borderRadius: 4,
            letterSpacing: 1,
          }}>
            {session.sessionCode}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={toggleFullscreen}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {fullscreen
                ? <><rect x="8" y="2" width="8" height="4" /><rect x="2" y="8" width="4" height="8" /><rect x="8" y="18" width="8" height="4" /><rect x="18" y="8" width="4" height="8" /></>
                : <><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></>
              }
            </svg>
            {fullscreen ? 'Exit FS' : 'Fullscreen'}
          </button>
          <button
            onClick={session.disconnect}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239,68,68,0.15)',
              color: 'var(--danger)',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Disconnect
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
          minHeight: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          className="main-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            display: 'block',
            borderRadius: 4,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            touchAction: 'none',
            cursor: eraserMode ? 'crosshair' : 'default',
          }}
        />
      </div>

      <div style={{
        flexShrink: 0,
        padding: '8px 12px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                setEraserMode(false)
                setHighlighterMode(false)
                setLaserMode(false)
                setAutoEraseActive(false)
                if (c !== '#ef4444') {
                  setHoldRedActive(false)
                  holdStrokeIdsRef.current = []
                }
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: c === '#22c55e'
                  ? 'radial-gradient(circle at 30% 30%, #dcfce7 0%, #22c55e 42%, #166534 100%)'
                  : c === '#ef4444'
                    ? 'radial-gradient(circle at 30% 30%, #fee2e2 0%, #ef4444 45%, #991b1b 100%)'
                    : c,
                border: `3px solid ${color === c ? 'white' : 'transparent'}`,
                boxShadow: color === c ? '0 0 12px rgba(255,255,255,0.3)' : 'none',
                flexShrink: 0,
                transition: 'transform 0.15s',
                transform: color === c ? 'scale(1.15)' : 'scale(1)',
                position: 'relative',
              }}
            />
          ))}
          <label style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px dashed var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value)
                setEraserMode(false)
                setHighlighterMode(false)
                setLaserMode(false)
                setHoldRedActive(false)
                holdStrokeIdsRef.current = []
              }}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {PEN_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setPenSize(s)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-sm)',
                  background: penSize === s ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border: `1px solid ${penSize === s ? 'var(--accent)' : 'transparent'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: s,
                  height: s,
                  borderRadius: '50%',
                  background: color,
                }} />
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => void goPrevSlide()}
              disabled={session.currentSlideIndex <= 0}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: session.currentSlideIndex <= 0 ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.15)',
                color: session.currentSlideIndex <= 0 ? 'var(--text-muted)' : 'var(--accent-light)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: session.currentSlideIndex <= 0 ? 0.6 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Prev
            </button>

            <button
              onClick={() => void goNextSlide()}
              disabled={session.currentSlideIndex >= session.slides.length - 1}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: session.currentSlideIndex >= session.slides.length - 1 ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.15)',
                color: session.currentSlideIndex >= session.slides.length - 1 ? 'var(--text-muted)' : 'var(--accent-light)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: session.currentSlideIndex >= session.slides.length - 1 ? 0.6 : 1,
              }}
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button
              onClick={() => void handleClearAll()}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--danger)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Clear
            </button>

            <button
              onClick={handleSave}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(34,197,94,0.1)',
                color: 'var(--success)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              Save
            </button>

            <button
              onClick={() => {
                setHighlighterMode((p) => !p)
                if (!highlighterMode) { setEraserMode(false); setLaserMode(false); setAutoEraseActive(false) }
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: highlighterMode ? 'rgba(255,238,88,0.25)' : 'rgba(255,238,88,0.06)',
                color: highlighterMode ? '#ffe658' : '#b5a84e',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: highlighterMode ? '1px solid rgba(255,238,88,0.5)' : '1px solid transparent',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Highlight
            </button>

            <button
              onClick={() => {
                setLaserMode((p) => !p)
                if (!laserMode) { setEraserMode(false); setHighlighterMode(false); setAutoEraseActive(false) }
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: laserMode ? 'rgba(255,60,60,0.25)' : 'rgba(255,60,60,0.06)',
                color: laserMode ? '#ff6b6b' : '#b54545',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: laserMode ? '1px solid rgba(255,60,60,0.5)' : '1px solid transparent',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2" /><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.07-6.07l-1.41 1.41M7.34 16.66l-1.41 1.41M19.07 19.07l-1.41-1.41M7.34 7.34L5.93 5.93" />
              </svg>
              Laser
            </button>

            <button
              onClick={() => {
                setAutoEraseActive((p) => {
                  if (!p) { setHighlighterMode(false); setLaserMode(false); setEraserMode(false) }
                  return !p
                })
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: autoEraseActive ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.06)',
                color: autoEraseActive ? '#cbd5e1' : '#64748b',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: autoEraseActive ? '1px solid rgba(148,163,184,0.5)' : '1px solid transparent',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {autoEraseActive ? `${autoEraseSeconds}s` : 'Auto'}
            </button>

            <button
              onClick={() => {
                setEraserMode((p) => !p)
                if (!eraserMode) { setHighlighterMode(false); setLaserMode(false); setAutoEraseActive(false) }
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: eraserMode ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                color: eraserMode ? 'var(--accent-light)' : 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: eraserMode ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l8.5-8.5a2 2 0 012.8 0l5.7 5.7a2 2 0 010 2.8L16 17" /><path d="M8 12l4 4" />
              </svg>
              Erase
            </button>

            <button
              onPointerDown={(e) => {
                e.preventDefault()
                activateHoldRed()
              }}
              onPointerUp={(e) => {
                e.preventDefault()
                void releaseHoldRed()
              }}
              onPointerCancel={() => { void releaseHoldRed() }}
              onPointerLeave={() => {
                if (holdRedActive) void releaseHoldRed()
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: holdRedActive ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.08)',
                color: holdRedActive ? '#fecaca' : '#fca5a5',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: holdRedActive ? '1px solid rgba(239,68,68,0.6)' : '1px solid transparent',
                boxShadow: holdRedActive ? '0 0 14px rgba(239,68,68,0.25)' : 'none',
                transform: holdRedActive ? 'translateY(-1px)' : 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l8.5-8.5a2 2 0 012.8 0l5.7 5.7a2 2 0 010 2.8L16 17" />
                <path d="M8 12l4 4" />
              </svg>
              Hold Red
            </button>

            <button
              onClick={() => void handleDeleteCurrentSlide()}
              disabled={session.slides.length === 0}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: session.slides.length === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.12)',
                color: session.slides.length === 0 ? 'var(--text-muted)' : 'var(--danger)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: session.slides.length === 0 ? 0.6 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete
            </button>

            <button
              onClick={() => void handleDeleteAllSlides()}
              disabled={session.slides.length === 0}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: session.slides.length === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(244,114,182,0.12)',
                color: session.slides.length === 0 ? 'var(--text-muted)' : '#f9a8d4',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: session.slides.length === 0 ? 0.6 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" /><path d="M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" /><path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
              Delete All
            </button>

            <button
              onClick={async () => {
                try {
                  await session.createBlankSlide()
                } catch (err: any) {
                  alert('Failed to create blank slide: ' + (err.message || ''))
                }
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              </svg>
              Blank Page
            </button>

            <label style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99,102,241,0.15)',
              color: 'var(--accent-light)',
              fontSize: 11,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.ppt,.pptx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {autoEraseActive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Fade after
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={autoEraseSeconds}
              onChange={(e) => {
                const val = Number(e.target.value)
                setAutoEraseSeconds(val)
                autoEraseSecondsRef.current = val
              }}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                appearance: 'none',
                background: `linear-gradient(90deg, var(--accent) ${((autoEraseSeconds - 1) / 9) * 100}%, var(--border) ${((autoEraseSeconds - 1) / 9) * 100}%)`,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 28, textAlign: 'right', fontFamily: "'Courier New', monospace" }}>
              {autoEraseSeconds}s
            </span>
          </div>
        )}

        {session.slides.length > 1 && (
          <div style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            paddingBottom: 2,
          }}>
            {session.slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => session.changeSlide(i)}
                style={{
                  width: 48,
                  height: 32,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: i === session.currentSlideIndex ? '2px solid var(--accent)' : '2px solid transparent',
                  opacity: i === session.currentSlideIndex ? 1 : 0.5,
                  padding: 0,
                  flexShrink: 0,
                  transition: 'opacity 0.15s',
                }}
              >
                <img
                  src={slide.url}
                  alt={slide.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {session.slides.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '2px 0',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 32, textAlign: 'center' }}>
              {session.currentSlideIndex + 1}/{session.slides.length}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, session.slides.length - 1)}
              value={session.currentSlideIndex}
              onChange={(e) => session.changeSlide(Number(e.target.value))}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                appearance: 'none',
                background: `linear-gradient(90deg, var(--accent) ${(session.currentSlideIndex / Math.max(1, session.slides.length - 1)) * 100}%, var(--border) ${(session.currentSlideIndex / Math.max(1, session.slides.length - 1)) * 100}%)`,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>
        )}

      {uploading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(2,6,23,0.72)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 80,
          padding: 20,
        }}>
          <div style={{
            width: 'min(92vw, 420px)',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: 24,
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>Uploading</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{uploadMessage}</div>
              </div>
              <div style={{
                minWidth: 64,
                textAlign: 'right',
                color: 'var(--accent-light)',
                fontSize: 20,
                fontWeight: 800,
              }}>
                {Math.round(uploadProgress)}%
              </div>
            </div>
            <div style={{
              height: 12,
              borderRadius: 999,
              background: 'rgba(148,163,184,0.15)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max(3, Math.min(100, uploadProgress))}%`,
                borderRadius: 999,
                background: 'linear-gradient(90deg, #22c55e, #60a5fa, #a855f7)',
                transition: 'width 0.15s ease',
              }} />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
