import { useState, useEffect, useCallback, useRef } from 'react'
import Overlay from './components/overlay/Overlay'
import Onboarding from './components/onboarding/Onboarding'
import Dashboard from './components/dashboard/Dashboard'
import { setupAudioCapture } from './hooks/useAudioCapture'

export type AppView = 'onboarding' | 'overlay' | 'dashboard'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  screenshot?: string
  isAssist?: boolean
  timestamp: number
}

declare global {
  interface Window {
    api: {
      send: (channel: string, ...args: any[]) => void
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => () => void
    }
  }
}

function getInitialView(): AppView {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'onboarding') return 'onboarding'
  if (hash === 'dashboard') return 'dashboard'
  if (hash === 'overlay') return 'overlay'
  if (!window.api) return 'overlay'
  return 'overlay'
}

export default function App() {
  const [view, setView] = useState<AppView>(getInitialView)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [provider, setProvider] = useState('openai')
  const [useScreen, setUseScreen] = useState(true)
  const [smartMode, setSmartMode] = useState(false)
  const [activeMode, setActiveMode] = useState('General')
  const [undetectable, setUndetectable] = useState(true)
  const [detectedMeeting, setDetectedMeeting] = useState<{ app: string; windowTitle: string } | null>(null)
  const transcriptRef = useRef('')
  const streamingRef = useRef('')

  // CRITICAL-3 fix: Use refs for callbacks to avoid stale closures in IPC listeners
  const providerRef = useRef(provider)
  const useScreenRef = useRef(useScreen)
  const activeModeRef = useRef(activeMode)
  providerRef.current = provider
  useScreenRef.current = useScreen
  activeModeRef.current = activeMode

  // Load saved provider on mount
  useEffect(() => {
    if (!window.api) return
    window.api.invoke('get-settings').then((s: any) => {
      if (s?.activeProvider) setProvider(s.activeProvider)
    }).catch(() => {})
  }, [])

  // CRITICAL-1 fix: Setup renderer-side audio capture
  useEffect(() => {
    if (!window.api) return
    if (view !== 'overlay') return
    const cleanup = setupAudioCapture()
    return cleanup
  }, [view])

  // IPC listeners (only relevant for overlay window)
  useEffect(() => {
    if (!window.api) return
    if (view !== 'overlay') return

    const unsubs: (() => void)[] = []

    unsubs.push(window.api.on('transcript-update', (text: string) => {
      transcriptRef.current = text
      setTranscript(text)
    }))

    unsubs.push(window.api.on('llm:chunk', (chunk: string) => {
      streamingRef.current += chunk
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: streamingRef.current }]
        }
        return prev
      })
    }))

    // CRITICAL-7 fix: Don't replace with post-processed text — keeps streamed content as-is
    unsubs.push(window.api.on('llm:complete', () => {
      streamingRef.current = ''
      setIsStreaming(false)
    }))

    unsubs.push(window.api.on('llm:error', (err: string) => {
      streamingRef.current = ''
      setIsStreaming(false)
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: `Error: ${err}` }]
        }
        return [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err}`, timestamp: Date.now() }]
      })
    }))

    // Clear meeting banner when recording starts by any means
    unsubs.push(window.api.on('recording-status', (s: boolean) => {
      setIsRecording(s)
      if (s) setDetectedMeeting(null)
    }))

    // CRITICAL-3 fix: Use refs instead of capturing stale closure values
    unsubs.push(window.api.on('trigger-ai-shortcut', () => {
      sendMessageRef.current()
    }))

    unsubs.push(window.api.on('toggle-recording-shortcut', () => {
      toggleRecordingRef.current()
    }))

    // Meeting detection listeners
    unsubs.push(window.api.on('meeting-detected', (data: { app: string; windowTitle: string }) => {
      setDetectedMeeting(data)
    }))

    unsubs.push(window.api.on('meeting-ended', () => {
      setDetectedMeeting(null)
    }))

    return () => unsubs.forEach(fn => fn())
  }, [view]) // CRITICAL-3 fix: Only depend on view, use refs for everything else

  const sendMessage = useCallback(async (text?: string, isAssist?: boolean) => {
    if (!window.api) return
    const query = text || undefined

    // Add user message
    if (query) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'user',
        content: query,
        isAssist,
        timestamp: Date.now()
      }])
    }

    // Add placeholder assistant message
    streamingRef.current = ''
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }])
    setIsStreaming(true)

    try {
      // CRITICAL-2 fix: Pass useScreen to AI handler
      // CRITICAL-4 fix: Pass activeMode to AI handler
      await window.api.invoke('trigger-ai', {
        transcript: transcriptRef.current,
        provider: providerRef.current,
        query,
        useScreen: useScreenRef.current,
        activeMode: activeModeRef.current,
      })
    } catch (err: any) {
      setIsStreaming(false)
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: `Error: ${err.message}` }]
        }
        return prev
      })
    }
  }, []) // No deps needed — everything uses refs

  // CRITICAL-3 fix: Stable refs for IPC listeners
  const sendMessageRef = useRef(sendMessage)
  const toggleRecordingRef = useRef(() => {})
  sendMessageRef.current = sendMessage

  const toggleRecording = useCallback(async () => {
    if (!window.api) return
    try {
      const newStatus = await window.api.invoke('toggle-recording')
      setIsRecording(newStatus)
    } catch {}
  }, [])
  toggleRecordingRef.current = toggleRecording

  const clearChat = useCallback(() => {
    setMessages([])
    streamingRef.current = ''
  }, [])

  const onOnboardingComplete = useCallback(async () => {
    if (window.api) {
      await window.api.invoke('finish-onboarding')
    }
  }, [])

  // MAJOR-2 fix: Toggle undetectable mode in main process
  const handleToggleUndetectable = useCallback(() => {
    setUndetectable(prev => {
      const next = !prev
      window.api?.send('set-content-protection', next)
      return next
    })
  }, [])

  // Meeting detection handlers
  const handleAcceptMeetingDetection = useCallback(async () => {
    if (!window.api || !detectedMeeting) return
    try {
      const result = await window.api.invoke('meeting-detection:accept', detectedMeeting.app)
      if (result) setIsRecording(true)
    } catch {}
    setDetectedMeeting(null)
  }, [detectedMeeting])

  const handleDismissMeetingDetection = useCallback(() => {
    if (!window.api || !detectedMeeting) return
    window.api.invoke('meeting-detection:dismiss', detectedMeeting.app).catch(() => {})
    setDetectedMeeting(null)
  }, [detectedMeeting])

  // Render based on view determined by URL hash
  if (view === 'onboarding') {
    return <Onboarding onComplete={onOnboardingComplete} />
  }

  if (view === 'dashboard') {
    return <Dashboard onClose={() => window.api?.send('close-settings')} />
  }

  return (
    <Overlay
      messages={messages}
      transcript={transcript}
      isStreaming={isStreaming}
      isRecording={isRecording}
      provider={provider}
      useScreen={useScreen}
      smartMode={smartMode}
      activeMode={activeMode}
      undetectable={undetectable}
      detectedMeeting={detectedMeeting}
      onSendMessage={sendMessage}
      onToggleRecording={toggleRecording}
      onClearChat={clearChat}
      onSetProvider={setProvider}
      onToggleScreen={() => setUseScreen(p => !p)}
      onToggleSmart={() => setSmartMode(p => !p)}
      onSetMode={setActiveMode}
      onOpenDashboard={() => window.api?.send('open-dashboard')}
      onToggleUndetectable={handleToggleUndetectable}
      onAcceptMeetingDetection={handleAcceptMeetingDetection}
      onDismissMeetingDetection={handleDismissMeetingDetection}
    />
  )
}
