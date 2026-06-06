import { useState, useEffect, useCallback, useRef } from 'react'
import { useWhiteboardSession } from './hooks/useWhiteboardSession'
import { LandingScreen } from './components/LandingScreen'
import { LoginScreen } from './components/LoginScreen'
import { ConnectDesktop } from './components/ConnectDesktop'
import { ConnectMobile } from './components/ConnectMobile'
import { DesktopView } from './components/DesktopView'
import { MobileView } from './components/MobileView'
import { supabase } from './lib/supabase'

type View =
  | 'login'
  | 'landing'
  | 'desktop-connect'
  | 'mobile-connect'

export default function App() {
  const [userAuthed, setUserAuthed] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const sessionWs = useWhiteboardSession()
  const [view, setView] = useState<View>('landing')
  const hadSessionRef = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserAuthed(!!session)
      setUserEmail(session?.user?.email ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserAuthed(!!session)
      setUserEmail(session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (sessionWs.role) hadSessionRef.current = true
    if (!sessionWs.role && hadSessionRef.current) {
      hadSessionRef.current = false
      setView('landing')
    }
  }, [sessionWs.role])

  const handlePresent = useCallback(() => {
    void sessionWs.createSession()
    setView('desktop-connect')
  }, [sessionWs])

  const handleJoin = useCallback(() => {
    setView('mobile-connect')
  }, [])

  const handleJoinSubmit = useCallback(async (code: string) => {
    await sessionWs.joinSession(code)
  }, [sessionWs])

  const handleLoginClick = useCallback(() => {
    setView('login')
  }, [])

  const handleLoginDone = useCallback(() => {
    setView('landing')
  }, [])

  const handleLogout = useCallback(async () => {
    sessionWs.disconnect()
    await supabase.auth.signOut()
  }, [sessionWs])

  const handleGoHome = useCallback(() => {
    sessionWs.disconnect()
    setView('landing')
  }, [sessionWs])

  if (view === 'login') {
    return <LoginScreen onLogin={handleLoginDone} />
  }

  if (sessionWs.role === 'presenter') {
    if (sessionWs.connectionState === 'connected') {
      return <DesktopView session={sessionWs} onGoHome={handleGoHome} />
    }
    return (
      <ConnectDesktop
        code={sessionWs.sessionCode || ''}
        joinerConnected={sessionWs.joinerConnected}
      />
    )
  }

  if (sessionWs.role === 'joiner') {
    if (sessionWs.connectionState === 'connected') {
      return <MobileView session={sessionWs} />
    }
    return (
      <ConnectMobile
        onJoin={handleJoinSubmit}
        error={sessionWs.error}
        connecting={sessionWs.connectionState === 'connecting'}
      />
    )
  }

  if (view === 'desktop-connect') {
    return (
      <ConnectDesktop
        code={sessionWs.sessionCode || ''}
        joinerConnected={sessionWs.joinerConnected}
      />
    )
  }

  if (view === 'mobile-connect') {
    return (
      <ConnectMobile
        onJoin={handleJoinSubmit}
        error={sessionWs.error}
        connecting={sessionWs.connectionState === 'connecting'}
      />
    )
  }

  return (
    <LandingScreen
      onPresent={handlePresent}
      onJoin={handleJoin}
      onLoginClick={handleLoginClick}
      onLogout={handleLogout}
      userEmail={userEmail}
    />
  )
}
