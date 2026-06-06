import { useEffect, useRef, useState, useCallback } from 'react'
import { WhiteboardSession } from '../hooks/useWhiteboardSession'

interface DesktopViewProps {
  session: WhiteboardSession
}

export function DesktopView({ session }: DesktopViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showOverlay, setShowOverlay] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [connectedPopup, setConnectedPopup] = useState(false)
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const slideImageRef = useRef<HTMLImageElement | null>(null)
  const slideUrlRef = useRef('')
  const activeStrokesRef = useRef<Map<string, { strokeId: string; color: string; width: number }>>(new Map())

  useEffect(() => {
    if (session.joinerConnected) {
      setConnectedPopup(true)
    }
  }, [session.joinerConnected])

  const currentSlide = session.slides[session.currentSlideIndex]
  const goPrevSlide = async () => {
    if (session.currentSlideIndex <= 0) return
    await session.changeSlide(session.currentSlideIndex - 1)
  }
  const goNextSlide = async () => {
    if (session.currentSlideIndex >= session.slides.length - 1) return
    await session.changeSlide(session.currentSlideIndex + 1)
  }

  const getCanvasDims = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const parent = canvas.parentElement
    if (!parent) return null
    const rect = parent.getBoundingClientRect()
    return { w: rect.width, h: rect.height }
  }, [])

  const initCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    const dims = getCanvasDims()
    if (!canvas || !dims) return
    const { w, h } = dims
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    return dims
  }, [getCanvasDims])

  const drawSlideBackground = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement | null) => {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)
    if (img) {
      const imgRatio = img.width / img.height
      const canvasRatio = w / h
      let drawW: number, drawH: number, dx: number, dy: number
      if (imgRatio > canvasRatio) {
        drawW = w
        drawH = w / imgRatio
        dx = 0
        dy = (h - drawH) / 2
      } else {
        drawH = h
        drawW = h * imgRatio
        dx = (w - drawW) / 2
        dy = 0
      }
      ctx.drawImage(img, dx, dy, drawW, drawH)
    }
  }, [])

  const drawAllStrokes = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    for (const stroke of session.strokes.values()) {
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
  }, [session.strokes])

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

  const fullRender = useCallback(async () => {
    const canvas = canvasRef.current
    const dims = initCanvasSize()
    if (!canvas || !dims) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = dims

    activeStrokesRef.current.clear()
    ctx.clearRect(0, 0, w, h)

    if (currentSlide) {
      const img = await loadSlideImage(currentSlide.url)
      drawSlideBackground(ctx, w, h, img)
      ctx.save()
      drawAllStrokes(ctx, w, h)
      ctx.restore()
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, w, h)
      if (session.slides.length === 0) {
        ctx.fillStyle = '#64748b'
        ctx.font = '20px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('Upload slides from your mobile device', w / 2, h / 2)
      } else {
        ctx.fillStyle = '#64748b'
        ctx.font = '18px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('Select a slide to present', w / 2, h / 2)
      }
    }

    if (currentSlide && !slideImageRef.current) {
      drawPlaceholder(ctx, w, h, currentSlide.name)
    }
  }, [currentSlide, drawAllStrokes, drawSlideBackground, initCanvasSize, loadSlideImage, session.slides.length])

  const drawPointDirectly = useCallback((payload: {
    strokeId: string
    x: number
    y: number
    color: string
    width: number
    type: 'start' | 'move' | 'end'
  }) => {
    const canvas = canvasRef.current
    const dims = getCanvasDims()
    if (!canvas || !dims) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = dims

    const strokeWidth = (payload.width * Math.min(w, h)) / 500

    if (payload.type === 'start') {
      ctx.beginPath()
      ctx.strokeStyle = payload.color
      ctx.lineWidth = strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(payload.x * w, payload.y * h)
      activeStrokesRef.current.set(payload.strokeId, {
        strokeId: payload.strokeId,
        color: payload.color,
        width: payload.width,
      })
    } else if (payload.type === 'move' || payload.type === 'end') {
      if (!activeStrokesRef.current.has(payload.strokeId)) {
        ctx.beginPath()
        ctx.strokeStyle = payload.color
        ctx.lineWidth = strokeWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.moveTo(payload.x * w, payload.y * h)
        activeStrokesRef.current.set(payload.strokeId, {
          strokeId: payload.strokeId,
          color: payload.color,
          width: payload.width,
        })
      }
      ctx.lineTo(payload.x * w, payload.y * h)
      ctx.stroke()
      if (payload.type === 'end') {
        activeStrokesRef.current.delete(payload.strokeId)
      }
    }
  }, [getCanvasDims])

  useEffect(() => {
    session.setDrawPointCallback(drawPointDirectly)
    return () => session.setDrawPointCallback(null)
  }, [session, drawPointDirectly])

  useEffect(() => {
    fullRender()
  }, [fullRender])

  function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number, name: string) {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h / 2
    ctx.fillStyle = 'rgba(99,102,241,0.1)'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(w, h) * 0.12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'var(--accent-light)'
    ctx.font = `bold ${Math.min(w, h) * 0.04}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('📄', cx, cy - Math.min(w, h) * 0.04)
    ctx.fillStyle = '#94a3b8'
    ctx.font = `${Math.min(w, h) * 0.025}px system-ui`
    ctx.fillText(name || 'Unsupported file', cx, cy + Math.min(w, h) * 0.06)
    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.min(w, h) * 0.018}px system-ui`
    ctx.fillText('Preview not available — download to view', cx, cy + Math.min(w, h) * 0.12)
  }

  useEffect(() => {
    const handleResize = () => fullRender()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [fullRender])

  useEffect(() => {
    const handleMouseMove = () => {
      setShowOverlay(true)
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current)
      overlayTimeoutRef.current = setTimeout(() => {
        if (fullscreen) setShowOverlay(false)
      }, 3000)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [fullscreen])

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      setFullscreen(true)
      setShowOverlay(true)
      setTimeout(() => setShowOverlay(false), 3000)
    } else {
      await document.exitFullscreen()
      setFullscreen(false)
      setShowOverlay(true)
    }
  }

  useEffect(() => {
    const handleFSChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFSChange)
    return () => document.removeEventListener('fullscreenchange', handleFSChange)
  }, [])

  return (
    <div style={{
      height: '100%',
      width: '100%',
      position: 'relative',
      background: '#000',
      overflow: 'hidden',
    }}>
      <canvas
        ref={canvasRef}
        className="main-canvas"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {showOverlay && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: 16,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
          transition: 'opacity 0.3s',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={toggleFullscreen}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: 13,
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {fullscreen
                    ? <><rect x="8" y="2" width="8" height="4" /><rect x="2" y="8" width="4" height="8" /><rect x="8" y="18" width="8" height="4" /><rect x="18" y="8" width="4" height="8" /></>
                    : <><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></>
                  }
                </svg>
                {fullscreen ? 'Exit' : 'Fullscreen'}
              </button>

              {session.slides.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: 6,
                  overflowX: 'auto',
                  maxWidth: '50vw',
                  padding: '2px 0',
                }}>
                  {session.slides.map((slide, i) => (
                    <button
                      key={slide.id}
                      onClick={() => session.changeSlide(i)}
                      style={{
                        width: 48,
                        height: 36,
                        borderRadius: 4,
                        overflow: 'hidden',
                        border: i === session.currentSlideIndex ? '2px solid var(--accent)' : '2px solid transparent',
                        opacity: i === session.currentSlideIndex ? 1 : 0.5,
                        padding: 0,
                        flexShrink: 0,
                        transition: 'opacity 0.15s, border-color 0.15s',
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
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => void goPrevSlide()}
                disabled={session.currentSlideIndex <= 0}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: session.currentSlideIndex <= 0 ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.18)',
                  color: session.currentSlideIndex <= 0 ? 'var(--text-muted)' : 'var(--accent-light)',
                  fontSize: 13,
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'nowrap',
                  opacity: session.currentSlideIndex <= 0 ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Prev
              </button>
              <button
                onClick={() => void goNextSlide()}
                disabled={session.currentSlideIndex >= session.slides.length - 1}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: session.currentSlideIndex >= session.slides.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.18)',
                  color: session.currentSlideIndex >= session.slides.length - 1 ? 'var(--text-muted)' : 'var(--accent-light)',
                  fontSize: 13,
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'nowrap',
                  opacity: session.currentSlideIndex >= session.slides.length - 1 ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <div style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--accent-light)',
                background: 'rgba(255,255,255,0.1)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                letterSpacing: 2,
                backdropFilter: 'blur(10px)',
              }}>
                {session.sessionCode}
              </div>
              {session.joinerConnected && (
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  boxShadow: '0 0 8px rgba(34,197,94,0.5)',
                }} />
              )}
              <button
                onClick={async () => {
                  const current = session.slides[session.currentSlideIndex]
                  if (!current) return
                  if (!window.confirm(`Delete slide "${current.name}"?`)) return
                  await session.deleteSlide(current.id)
                }}
                disabled={session.slides.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: session.slides.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.18)',
                  color: session.slides.length === 0 ? 'var(--text-muted)' : 'var(--danger)',
                  fontSize: 13,
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'nowrap',
                  opacity: session.slides.length === 0 ? 0.6 : 1,
                }}
              >
                Delete
              </button>
              <button
                onClick={async () => {
                  if (!session.slides.length) return
                  if (!window.confirm('Delete all uploaded slides?')) return
                  await session.deleteAllSlides()
                }}
                disabled={session.slides.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: session.slides.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(244,114,182,0.16)',
                  color: session.slides.length === 0 ? 'var(--text-muted)' : '#f9a8d4',
                  fontSize: 13,
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'nowrap',
                  opacity: session.slides.length === 0 ? 0.6 : 1,
                }}
              >
                Delete All
              </button>
              <button
                onClick={session.disconnect}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239,68,68,0.2)',
                  color: 'var(--danger)',
                  fontSize: 13,
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'nowrap',
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {connectedPopup && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 40px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            animation: 'scaleIn 0.3s ease-out',
            maxWidth: 320,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Device Connected</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Your mobile device is now connected. Start presenting!
            </p>
            <button
              onClick={() => setConnectedPopup(false)}
              style={{
                padding: '10px 32px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {session.slides.length === 0 && (
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'var(--text-muted)',
          fontSize: 14,
          textAlign: 'center',
          background: 'rgba(0,0,0,0.6)',
          padding: '12px 24px',
          borderRadius: 'var(--radius-md)',
          backdropFilter: 'blur(10px)',
        }}>
          Upload slides from your connected mobile device
        </div>
      )}
    </div>
  )
}
