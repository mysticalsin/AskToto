import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '../../App'
import ChatView from './ChatView'
import TranscriptView from './TranscriptView'
import ChatInput from './ChatInput'
import QuickActions from './QuickActions'
import MeetingDetectedBanner from './MeetingDetectedBanner'

interface OverlayProps {
  messages: ChatMessage[]
  transcript: string
  isStreaming: boolean
  isRecording: boolean
  provider: string
  useScreen: boolean
  smartMode: boolean
  activeMode: string
  undetectable: boolean
  detectedMeeting: { app: string; windowTitle: string } | null
  onSendMessage: (text?: string, isAssist?: boolean) => void
  onToggleRecording: () => void
  onClearChat: () => void
  onSetProvider: (p: string) => void
  onToggleScreen: () => void
  onToggleSmart: () => void
  onSetMode: (m: string) => void
  onOpenDashboard: () => void
  onToggleUndetectable: () => void
  onAcceptMeetingDetection: () => void
  onDismissMeetingDetection: () => void
}

export default function Overlay({
  messages, transcript, isStreaming, isRecording, provider,
  useScreen, smartMode, activeMode, undetectable, detectedMeeting,
  onSendMessage, onToggleRecording, onClearChat, onSetProvider,
  onToggleScreen, onToggleSmart, onSetMode, onOpenDashboard,
  onToggleUndetectable, onAcceptMeetingDetection, onDismissMeetingDetection
}: OverlayProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'transcript'>('chat')
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const didDrag = useRef(false)
  const panelOffsetRef = useRef(panelOffset)
  panelOffsetRef.current = panelOffset

  useEffect(() => {
    if (!window.api) return
    if (isDragging) return
    window.api.send('set-mouse-passthrough', !isHovered)
  }, [isHovered, isDragging])

  // Listen for scroll shortcut
  useEffect(() => {
    if (!window.api) return
    const unsub = window.api.on('scroll-response', (dir: string) => {
      const el = document.getElementById('chat-scroll-area')
      if (el) el.scrollBy({ top: dir === 'down' ? 100 : -100, behavior: 'smooth' })
    })
    return unsub
  }, [])

  // Listen for move-overlay shortcut
  useEffect(() => {
    if (!window.api) return
    const unsub = window.api.on('move-overlay', (direction: string, step: number) => {
      setPanelOffset(prev => {
        switch (direction) {
          case 'up':    return { ...prev, y: prev.y - step }
          case 'down':  return { ...prev, y: prev.y + step }
          case 'left':  return { ...prev, x: prev.x - step }
          case 'right': return { ...prev, x: prev.x + step }
          default: return prev
        }
      })
    })
    return unsub
  }, [])

  // ── Mouse drag — works from anywhere on the widget ──────────
  const handleWidgetDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    didDrag.current = false
    setIsDragging(true)
    const start = { mx: e.clientX, my: e.clientY, ox: panelOffsetRef.current.x, oy: panelOffsetRef.current.y }
    dragStart.current = start

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.mx
      const dy = ev.clientY - start.my
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        didDrag.current = true
      }
      if (didDrag.current) {
        setPanelOffset({ x: start.ox + dx, y: start.oy + dy })
      }
    }

    const handleUp = () => {
      setIsDragging(false)
      dragStart.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [])

  return (
    <div
      className="fixed z-50 flex flex-col items-center"
      style={{ top: 12 + panelOffset.y, right: 12 - panelOffset.x }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ═══════ MEETING DETECTED BANNER (above widget bar) ═══════ */}
      {detectedMeeting && !isRecording && (
        <MeetingDetectedBanner
          app={detectedMeeting.app}
          windowTitle={detectedMeeting.windowTitle}
          onAccept={onAcceptMeetingDetection}
          onDismiss={onDismissMeetingDetection}
        />
      )}

      {/* ═══════ TOP WIDGET BAR (always visible, fully draggable) ═══════ */}
      <div
        className="flex items-center gap-1.5 select-none mb-2"
        onMouseDown={handleWidgetDragStart}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Left pill — recording controls */}
        <div className="overlay-panel flex items-center gap-0 px-1 py-1">
          {/* Recording indicator dot */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (!didDrag.current) setChatOpen(prev => !prev) }}
            onKeyDown={e => { if (e.key === 'Enter') setChatOpen(prev => !prev) }}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer"
            title={chatOpen ? 'Hide chat' : 'Show chat'}
            aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-pulse-slow' : 'bg-blue-screen'}`} />
          </div>

          {/* Undetectable toggle — MAJOR-2 fix: toggles content protection */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (!didDrag.current) onToggleUndetectable() }}
            onKeyDown={e => { if (e.key === 'Enter') onToggleUndetectable() }}
            className={`w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer ${undetectable ? 'text-g-12' : 'text-g-7'}`}
            title={undetectable ? 'Undetectable: ON' : 'Undetectable: OFF'}
            aria-label={undetectable ? 'Disable undetectable mode' : 'Enable undetectable mode'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="6" width="20" height="12" rx="2"/>
              <circle cx="8" cy="12" r="2"/>
              <circle cx="16" cy="12" r="2"/>
            </svg>
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-[rgba(155,155,155,0.2)] mx-0.5" />

          {/* Pause / Stop / Play */}
          {isRecording ? (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { if (!didDrag.current) { /* pause placeholder */ } }}
                onKeyDown={() => {}}
                className="w-7 h-7 rounded-full flex items-center justify-center text-g-11 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer"
                title="Pause"
                aria-label="Pause recording"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { if (!didDrag.current) onToggleRecording() }}
                onKeyDown={e => { if (e.key === 'Enter') onToggleRecording() }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-g-11 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer"
                title="Stop listening"
                aria-label="Stop recording"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </div>
            </>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => { if (!didDrag.current) onToggleRecording() }}
              onKeyDown={e => { if (e.key === 'Enter') onToggleRecording() }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-g-11 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer"
              title="Start listening"
              aria-label="Start recording"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          )}

          {/* Chevron (toggle chat open) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (!didDrag.current) setChatOpen(prev => !prev) }}
            onKeyDown={e => { if (e.key === 'Enter') setChatOpen(prev => !prev) }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-g-8 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer"
            title={chatOpen ? 'Collapse chat' : 'Expand chat'}
            aria-label={chatOpen ? 'Collapse chat' : 'Expand chat'}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d={chatOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
            </svg>
          </div>
        </div>

        {/* Right group — dashboard + close */}
        <div className="overlay-panel flex items-center gap-0 px-1 py-1">
          {/* Dashboard */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (!didDrag.current) onOpenDashboard() }}
            onKeyDown={e => { if (e.key === 'Enter') onOpenDashboard() }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-g-11 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer"
            title="Dashboard"
            aria-label="Open dashboard"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </div>

          {/* Close (hide chat) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (!didDrag.current) setChatOpen(false) }}
            onKeyDown={e => { if (e.key === 'Enter') setChatOpen(false) }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-g-8 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer"
            title="Close"
            aria-label="Close chat panel"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ═══════ CHAT PANEL (drops down below widget) ═══════ */}
      {chatOpen && (
        <div className="w-[520px] animate-fade-in">
          <div className="overlay-panel flex flex-col max-h-[80vh]">
            {/* Header — Home icon + Chat/Transcript tabs */}
            <div className="flex items-center px-3 py-2 border-b border-[rgba(155,155,155,0.15)]">
              <button
                onClick={() => onOpenDashboard()}
                className="no-drag p-1 rounded-md text-g-11 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors"
                title="Home"
                aria-label="Open home"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </button>

              <div className="flex-1" />

              {/* Chat / Transcript tabs */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeTab === 'chat' ? 'text-white bg-g-5' : 'text-g-8 hover:text-g-11'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeTab === 'transcript' ? 'text-white bg-g-5' : 'text-g-8 hover:text-g-11'
                  }`}
                >
                  Transcript
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div id="chat-scroll-area" className="flex-1 overflow-y-auto min-h-[100px] max-h-[50vh]">
              {activeTab === 'chat' ? (
                <ChatView messages={messages} isStreaming={isStreaming} />
              ) : (
                <TranscriptView transcript={transcript} isRecording={isRecording} />
              )}
            </div>

            {/* Footer — Quick Actions + Input */}
            <div className="chat-footer rounded-b-[16px]">
              <QuickActions onSendMessage={onSendMessage} isStreaming={isStreaming} />
              <div className="border-t border-[rgba(155,155,155,0.1)] mx-3" />
              <ChatInput
                smartMode={smartMode}
                isStreaming={isStreaming}
                onSendMessage={onSendMessage}
                onToggleSmart={onToggleSmart}
                onClearChat={onClearChat}
                onOpenDashboard={onOpenDashboard}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
