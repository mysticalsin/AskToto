interface TranscriptViewProps {
  transcript: string
  isRecording: boolean
}

export default function TranscriptView({ transcript, isRecording }: TranscriptViewProps) {
  if (!transcript && !isRecording) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[140px] px-6 py-8">
        <div className="w-10 h-10 rounded-xl bg-g-3 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-g-8">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <p className="text-xs text-g-10 text-center">No transcript yet</p>
        <p className="text-2xs text-g-8 mt-1 text-center">Click "Start Listening" to begin</p>
      </div>
    )
  }

  const lines = transcript ? transcript.split('\n').filter(Boolean) : []

  return (
    <div className="px-3 py-2 space-y-2">
      {lines.length > 0 ? lines.map((line, i) => (
        <div key={`t-${i}-${line.slice(0, 20)}`} className="flex gap-2 text-xs animate-fade-in">
          <span className="text-g-8 shrink-0 mt-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            </svg>
          </span>
          <span className="text-g-11 leading-relaxed">{line}</span>
        </div>
      )) : (
        <div className="flex items-center gap-2 text-xs text-g-8">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-slow" />
          Listening...
        </div>
      )}
      {isRecording && (
        <div className="flex items-center gap-2 text-2xs text-g-8 pt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-slow" />
          Recording in progress
        </div>
      )}
    </div>
  )
}
