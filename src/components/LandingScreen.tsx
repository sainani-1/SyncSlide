import { useCallback } from 'react'
import { useWhiteboardSession } from '../hooks/useWhiteboardSession'

interface LandingScreenProps {
  onPresent: () => void
  onJoin: () => void
}

export function LandingScreen({ onPresent, onJoin }: LandingScreenProps) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 30%, #1a1a3e 0%, #0f0f1a 70%)',
      padding: 24,
      gap: 48,
    }}>
      <div style={{ textAlign: 'center', animation: 'fadeIn 0.6s ease-out' }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: 'linear-gradient(135deg, var(--accent), #a855f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
          animation: 'float 3s ease-in-out infinite',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h1 style={{
          fontSize: 36,
          fontWeight: 800,
          background: 'linear-gradient(135deg, var(--accent-light), #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: -1,
        }}>
          SyncSlide
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 16 }}>
          Real-time collaborative whiteboard
        </p>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
        maxWidth: 320,
        animation: 'slideUp 0.6s ease-out 0.2s both',
      }}>
        <button
          onClick={onPresent}
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent), #4f46e5)',
            color: 'white',
            fontSize: 18,
            fontWeight: 700,
            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(99,102,241,0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            I'm Presenting
          </div>
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.7, marginTop: 4 }}>
            Share your screen and present slides
          </div>
        </button>

        <button
          onClick={onJoin}
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: 18,
            fontWeight: 700,
            border: '2px solid var(--border)',
            transition: 'border-color 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            I'm Joining
          </div>
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.7, marginTop: 4 }}>
            Connect to a presentation
          </div>
        </button>
      </div>

      <div style={{
        color: 'var(--text-muted)',
        fontSize: 12,
        animation: 'fadeIn 0.6s ease-out 0.4s both',
      }}>
        No account needed
      </div>
    </div>
  )
}
