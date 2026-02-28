interface QuickActionsProps {
  onSendMessage: (text?: string, isAssist?: boolean) => void
  isStreaming: boolean
}

const actions = [
  {
    label: 'Assist',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/>
      </svg>
    ),
    action: (send: Function) => send(undefined, true),
    accent: true,
  },
  {
    label: 'What should I say?',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
      </svg>
    ),
    action: (send: Function) => send('What should I say right now? Suggest the best response based on the conversation.'),
  },
  {
    label: 'Follow-up questions',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
    action: (send: Function) => send('Suggest 2-3 strategic follow-up questions I should ask based on the conversation so far.'),
  },
  {
    label: 'Recap',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
      </svg>
    ),
    action: (send: Function) => send('Give me a neutral recap of the conversation so far. Be concise and factual.'),
  },
]

export default function QuickActions({ onSendMessage, isStreaming }: QuickActionsProps) {
  return (
    <div className={`flex items-center gap-0 px-3 py-1.5 overflow-x-auto ${isStreaming ? 'opacity-40 pointer-events-none' : ''}`}>
      {actions.map((a, i) => (
        <span key={a.label} className="flex items-center shrink-0">
          <button
            onClick={() => !isStreaming && a.action(onSendMessage)}
            disabled={isStreaming}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium transition-all hover:bg-[var(--surface-action-hover)] ${
              a.accent
                ? 'text-blue-screen'
                : 'text-g-12 hover:text-white'
            }`}
          >
            {a.icon}
            {a.label}
          </button>
          {i < actions.length - 1 && (
            <span className="text-g-7 text-2xs mx-0.5 select-none">·</span>
          )}
        </span>
      ))}
    </div>
  )
}
