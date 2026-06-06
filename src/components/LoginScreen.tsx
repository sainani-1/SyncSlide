import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface LoginScreenProps {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        setError('Check your email for the confirmation link!')
        setLoading(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      onLogin()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 30%, #1a1a3e 0%, #0f0f1a 70%)',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        animation: 'fadeIn 0.5s ease-out',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--accent-light), #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: -0.5,
          }}>
            SyncSlide
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
            {isSignUp ? 'Create an account' : 'Sign in to continue'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            border: '1px solid var(--border)',
          }}
        >
          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontSize: 15,
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontSize: 15,
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: error.includes('Check your email') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: error.includes('Check your email') ? 'var(--success)' : 'var(--danger)',
              fontSize: 13,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px 24px',
              borderRadius: 'var(--radius-md)',
              background: loading ? 'var(--accent)' : 'linear-gradient(135deg, var(--accent), #4f46e5)',
              color: 'white',
              fontSize: 16,
              fontWeight: 700,
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
              transition: 'transform 0.2s, opacity 0.2s',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>

          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
            style={{
              background: 'none',
              color: 'var(--accent-light)',
              fontSize: 13,
              fontWeight: 500,
              padding: 4,
            }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  )
}
