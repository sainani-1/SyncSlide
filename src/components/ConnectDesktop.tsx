interface ConnectDesktopProps {
  code: string
  joinerConnected: boolean
}

export function ConnectDesktop({ code, joinerConnected }: ConnectDesktopProps) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 40%, #1a1a3e 0%, #0f0f1a 70%)',
      padding: 24,
      gap: 32,
      animation: 'fadeIn 0.5s ease-out',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Share this code
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Enter it on your mobile device to connect
        </p>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px 48px',
        border: '2px solid var(--border)',
        boxShadow: joinerConnected ? 'var(--shadow-glow)' : 'var(--shadow-md)',
        transition: 'box-shadow 0.3s, border-color 0.3s',
        borderColor: joinerConnected ? 'var(--accent)' : 'var(--border)',
      }}>
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: 16,
          background: 'linear-gradient(135deg, var(--accent-light), #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          userSelect: 'all',
          cursor: 'pointer',
        }}
          onClick={() => navigator.clipboard.writeText(code)}
          title="Click to copy"
        >
          {code}
        </div>
      </div>

      {joinerConnected ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--success)',
          fontSize: 15,
          fontWeight: 500,
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Device connected!
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--text-muted)',
          fontSize: 14,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--warning)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          Waiting for mobile connection...
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: 12,
        marginTop: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 500,
            border: '1px solid var(--border)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy Code
        </button>
      </div>
    </div>
  )
}
