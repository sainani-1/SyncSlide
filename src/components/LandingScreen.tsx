interface LandingScreenProps {
  onPresent: () => void
  onJoin: () => void
  onLoginClick: () => void
  onLogout: () => void
  userEmail: string | null
}

export function LandingScreen({ onPresent, onJoin, onLoginClick, onLogout, userEmail }: LandingScreenProps) {
  return (
    <div style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at 50% 20%, #1a1a3e 0%, #0f0f1a 70%)',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>SyncSlide</span>
        </div>

        {userEmail ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{userEmail}</span>
            <button
              onClick={onLogout}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                border: '1px solid var(--border)',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99,102,241,0.15)',
              color: 'var(--accent-light)',
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid rgba(99,102,241,0.25)',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Login
            </div>
          </button>
        )}
      </div>

      {/* Hero */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 24px 48px',
        gap: 32,
        minHeight: 0,
      }}>
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.6s ease-out' }}>
          <h1 style={{
            fontSize: 40,
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--accent-light), #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: -1,
            lineHeight: 1.1,
          }}>
            Present Slides.<br />Control from Anywhere.
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 16, fontSize: 16, maxWidth: 400, lineHeight: 1.6 }}>
            SyncSlide turns your phone into a remote control for your presentations. 
            Upload slides, draw in real-time, and let your audience follow along live.
          </p>
        </div>

        {/* How it works */}
        <div style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          justifyContent: 'center',
          animation: 'slideUp 0.6s ease-out 0.15s both',
        }}>
          {[
            { icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z', title: 'Upload Slides', desc: 'Images, PDF, or PowerPoint — drag & drop or send from your phone.' },
            { icon: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z', title: 'Call-in Joiner', desc: 'Join from any device with a 6-letter code — no app install needed.' },
            { icon: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m3.5-1h3a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5zM12 11h.01M12 16h.01', title: 'Draw & Annotate', desc: 'Sketch over slides in real-time. Annotations sync instantly.' },
          ].map((feature, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              width: 240,
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(99,102,241,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={feature.icon} />
                </svg>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{feature.title}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: '100%',
          maxWidth: 320,
          animation: 'slideUp 0.6s ease-out 0.3s both',
        }}>
          <button
            onClick={onPresent}
            style={{
              padding: '18px 24px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent), #4f46e5)',
              color: 'white',
              fontSize: 17,
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              I'm Presenting
            </div>
            <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>
              Share your screen and control slides
            </div>
          </button>

          <button
            onClick={onJoin}
            style={{
              padding: '18px 24px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 17,
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              I'm Joining
            </div>
            <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>
              Connect to a presentation with a code
            </div>
          </button>
        </div>

        {/* Footer */}
        <div style={{
          color: 'var(--text-muted)',
          fontSize: 12,
          animation: 'fadeIn 0.6s ease-out 0.4s both',
          paddingBottom: 16,
        }}>
          No account needed to present or join
        </div>
      </div>
    </div>
  )
}
