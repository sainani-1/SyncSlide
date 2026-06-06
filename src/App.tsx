import { useState, useEffect, useCallback, useRef } from 'react'
import { useWhiteboardSession } from './hooks/useWhiteboardSession'
import { LandingScreen } from './components/LandingScreen'
import { ConnectDesktop } from './components/ConnectDesktop'
import { ConnectMobile } from './components/ConnectMobile'
import { DesktopView } from './components/DesktopView'
import { MobileView } from './components/MobileView'

type View =
  | 'landing'
  | 'desktop-connect'
  | 'mobile-connect'

export default function App() {
  const session = useWhiteboardSession()
  const [view, setView] = useState<View>('landing')
  const hadSessionRef = useRef(false)

  useEffect(() => {
    if (session.role) hadSessionRef.current = true
    if (!session.role && hadSessionRef.current) {
      hadSessionRef.current = false
      setView('landing')
    }
  }, [session.role])

  const handlePresent = useCallback(() => {
    void session.createSession()
    setView('desktop-connect')
  }, [session])

  const handleJoin = useCallback(() => {
    setView('mobile-connect')
  }, [])

  const handleJoinSubmit = useCallback(async (code: string) => {
    await session.joinSession(code)
  }, [session])

  if (session.role === 'presenter') {
    if (session.connectionState === 'connected') {
      return <DesktopView session={session} />
    }
    return (
      <ConnectDesktop
        code={session.sessionCode || ''}
        joinerConnected={session.joinerConnected}
      />
    )
  }

  if (session.role === 'joiner') {
    if (session.connectionState === 'connected') {
      return <MobileView session={session} />
    }
    return (
      <ConnectMobile
        onJoin={handleJoinSubmit}
        error={session.error}
        connecting={session.connectionState === 'connecting'}
      />
    )
  }

  if (view === 'desktop-connect') {
    return (
      <ConnectDesktop
        code={session.sessionCode || ''}
        joinerConnected={session.joinerConnected}
      />
    )
  }

  if (view === 'mobile-connect') {
    return (
      <ConnectMobile
        onJoin={handleJoinSubmit}
        error={session.error}
        connecting={session.connectionState === 'connecting'}
      />
    )
  }

  return (
    <LandingScreen
      onPresent={handlePresent}
      onJoin={handleJoin}
    />
  )
}
