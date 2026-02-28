import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../../App'

interface ChatViewProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-g-8 hover:text-white hover:bg-[var(--surface-action-hover)]"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      )}
    </button>
  )
}

export default function ChatView({ messages, isStreaming }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[140px] px-6 py-8">
        <div className="w-10 h-10 rounded-xl bg-g-3 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-g-8">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <p className="text-xs text-g-12 text-center">
          Ask about your screen or conversation
        </p>
        <p className="text-2xs text-g-11 mt-1 text-center">
          Press <kbd className="px-1 py-0.5 bg-g-4 rounded text-2xs text-g-11 font-mono">Ctrl+Enter</kbd> for Assist
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
          {msg.role === 'user' ? (
            <div className={msg.isAssist ? 'msg-user bg-gradient-to-b from-[#497ee9] to-[#648bec]' : 'msg-user'}>
              {msg.isAssist && (
                <div className="flex items-center gap-1 mb-1 text-white/70 text-2xs">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                  Assist
                </div>
              )}
              {msg.content}
            </div>
          ) : (
            <div className="msg-assist w-full group">
              {msg.content ? (
                <div className="relative">
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {/* Copy button - shows on hover */}
                  <div className="absolute top-0 right-0">
                    <CopyButton text={msg.content} />
                  </div>
                </div>
              ) : isStreaming ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-g-8 animate-pulse-slow" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-g-8 animate-pulse-slow" style={{ animationDelay: '200ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-g-8 animate-pulse-slow" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              ) : null}
              {isStreaming && msg === messages[messages.length - 1] && msg.content && (
                <span className="inline-block w-[3px] h-[14px] bg-blue-screen ml-0.5 animate-pulse-slow rounded-sm align-text-bottom" />
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
