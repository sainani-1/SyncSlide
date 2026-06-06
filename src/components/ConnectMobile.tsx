import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface ConnectMobileProps {
  onJoin: (code: string) => void
  error: string | null
  connecting: boolean
}

export function ConnectMobile({ onJoin, error, connecting }: ConnectMobileProps) {
  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleCodeChange = (index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1)
    if (!char && value.length === 0) {
      const newCode = [...code]
      newCode[index] = ''
      setCode(newCode)
      return
    }
    const newCode = [...code]
    newCode[index] = char
    setCode(newCode)

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (index === 5 && char) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        onJoin(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    const newCode = [...code]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    const nextIndex = Math.min(pasted.length, 5)
    inputRefs.current[nextIndex]?.focus()
    if (pasted.length === 6) {
      onJoin(pasted)
    }
  }

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const fullCode = code.join('')

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 30%, #1a1a3e 0%, #0f0f1a 70%)',
      padding: 24,
      gap: 32,
      animation: 'fadeIn 0.5s ease-out',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #a855f7, var(--accent))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Join Session</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Enter the 6-character code from the presenter
        </p>
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        animation: 'scaleIn 0.4s ease-out 0.2s both',
      }}
        onPaste={handlePaste}
      >
        {code.map((char, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={1}
            value={char}
            onChange={(e) => handleCodeChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            style={{
              width: 44,
              height: 52,
              textAlign: 'center',
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              letterSpacing: 2,
              background: 'var(--bg-card)',
              border: `2px solid ${char ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              transition: 'border-color 0.15s, transform 0.15s',
              caretColor: 'var(--accent)',
            }}
          />
        ))}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--danger)',
          fontSize: 13,
          textAlign: 'center',
          maxWidth: 300,
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={() => fullCode.length === 6 && onJoin(fullCode)}
        disabled={fullCode.length !== 6 || connecting}
        style={{
          padding: '14px 48px',
          borderRadius: 'var(--radius-md)',
          background: fullCode.length === 6 && !connecting
            ? 'linear-gradient(135deg, var(--accent), #4f46e5)'
            : 'var(--bg-card)',
          color: fullCode.length === 6 && !connecting ? 'white' : 'var(--text-muted)',
          fontSize: 16,
          fontWeight: 600,
          boxShadow: fullCode.length === 6 ? '0 4px 20px rgba(99,102,241,0.4)' : 'none',
          transition: 'all 0.2s',
          opacity: connecting ? 0.7 : 1,
          width: '100%',
          maxWidth: 320,
        }}
      >
        {connecting ? 'Connecting...' : 'Connect'}
      </button>
    </div>
  )
}
