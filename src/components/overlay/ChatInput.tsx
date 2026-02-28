import { useState, useRef, useEffect } from 'react'

interface ChatInputProps {
  smartMode: boolean
  isStreaming: boolean
  onSendMessage: (text?: string) => void
  onToggleSmart: () => void
  onClearChat: () => void
  onOpenDashboard: () => void
}

export default function ChatInput({
  smartMode, isStreaming,
  onSendMessage, onToggleSmart, onClearChat, onOpenDashboard
}: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '20px'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 60) + 'px'
    }
  }, [text])

  const handleSubmit = () => {
    if (isStreaming) return
    const msg = text.trim()
    setText('')
    onSendMessage(msg || undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="px-3 pb-2.5 pt-0">
      {/* Input Row */}
      <div className="flex items-end gap-2 mb-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your screen or conversation, or Ctrl+Enter for Assist"
          rows={1}
          className="flex-1 bg-transparent text-xs text-g-12 placeholder-g-8 outline-none resize-none leading-5"
          style={{ minHeight: '20px', maxHeight: '60px' }}
        />
      </div>

      {/* Bottom Row: Smart + Settings ... Send */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleSmart}
          className={`toggle-pill ${smartMode ? 'active-smart' : ''}`}
          title="Better for coding, reasoning, and complex tasks"
        >
          Smart
        </button>

        <button
          onClick={onOpenDashboard}
          className="p-1 rounded-md text-g-8 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors"
          title="Settings"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>

        <div className="flex-1" />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={isStreaming}
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            isStreaming ? 'bg-g-5 text-g-8' : 'btn-send'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
