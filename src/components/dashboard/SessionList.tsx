import { useState, useEffect } from 'react'

interface Meeting {
  id: number
  title: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
}

interface TranscriptLine {
  id: number
  speaker: string
  text: string
  timestamp: string
}

interface AIResponse {
  id: number
  query: string
  response: string
  provider: string
  model: string
  timestamp: string
}

export default function SessionList() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])
  const [responses, setResponses] = useState<AIResponse[]>([])
  const [detailTab, setDetailTab] = useState<'summary' | 'transcript' | 'usage'>('summary')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadMeetings()
  }, [])

  const loadMeetings = async () => {
    try {
      const data = await window.api?.invoke('meetings:list')
      if (data) setMeetings(data)
    } catch {}
  }

  const selectMeeting = async (id: number) => {
    setSelected(id)
    setDetailTab('summary')
    try {
      const [t, r] = await Promise.all([
        window.api?.invoke('meetings:transcripts', id),
        window.api?.invoke('meetings:responses', id),
      ])
      setTranscripts(t || [])
      setResponses(r || [])
    } catch {}
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return ''
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m} min`
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  // Group meetings by date
  const groupByDate = (meetings: Meeting[]) => {
    const groups: { [key: string]: Meeting[] } = {}
    const today = new Date().toDateString()

    meetings.forEach(m => {
      const d = new Date(m.started_at)
      const dateKey = d.toDateString()
      let label = dateKey
      if (dateKey === today) label = 'Today'
      else {
        label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      }
      if (!groups[label]) groups[label] = []
      groups[label].push(m)
    })
    return groups
  }

  // MODERATE-6 fix: Clipboard error handling
  const copyFullSummary = async () => {
    const meeting = meetings.find(m => m.id === selected)
    const lines = [
      `# ${meeting?.title || 'Untitled session'}`,
      `Date: ${meeting?.started_at ? formatDate(meeting.started_at) : ''}`,
      '',
      '## Transcript',
      ...transcripts.map(t => `[${formatTime(t.timestamp)}] ${t.speaker}: ${t.text}`),
      '',
      '## AI Responses',
      ...responses.map(r => `Q: ${r.query}\nA: ${r.response}\n`),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(lines)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may fail in some contexts
    }
  }

  // MAJOR-5 fix: Resume session handler
  const resumeSession = async () => {
    if (!window.api) return
    try {
      await window.api.invoke('toggle-recording')
    } catch {}
  }

  // MAJOR-5 fix: Ask about meeting handler
  const [meetingQuery, setMeetingQuery] = useState('')
  const askAboutMeeting = async () => {
    if (!window.api || !meetingQuery.trim()) return
    const context = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n')
    const fullQuery = `Given this meeting transcript:\n${context}\n\nQuestion: ${meetingQuery}`
    try {
      await window.api.invoke('trigger-ai', {
        transcript: context,
        query: fullQuery,
        provider: undefined,
        useScreen: false,
        activeMode: 'General',
      })
      setMeetingQuery('')
    } catch {}
  }

  // Meeting detail view (matches Cluely image 12)
  if (selected !== null) {
    const meeting = meetings.find(m => m.id === selected)
    return (
      <div className="animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sm text-g-8 hover:text-g-11 transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>

        {/* Meeting header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-g-8 mb-1">
              {meeting?.started_at ? formatDate(meeting.started_at) : ''}
            </p>
            <h2 className="text-2xl font-semibold text-g-12">
              {meeting?.title || 'Untitled session'}
            </h2>
          </div>
          <button
            onClick={copyFullSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-g-8 hover:text-g-11 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            {copied ? 'Copied!' : 'Copy full summary'}
          </button>
        </div>

        {/* Tabs: Summary | Transcript | Usage */}
        <div className="flex gap-0 mb-6 bg-g-3 rounded-lg p-0.5 w-fit">
          {(['summary', 'transcript', 'usage'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setDetailTab(tab)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                detailTab === tab ? 'bg-g-5 text-g-12' : 'text-g-8 hover:text-g-11'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {detailTab === 'summary' && (
          <div className="space-y-4">
            <div className="text-sm text-g-8 italic">Write your notes here...</div>
            {responses.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium text-g-11">AI Responses</h3>
                {responses.map(r => (
                  <div key={r.id} className="p-3 bg-g-3 rounded-xl border border-g-5">
                    {r.query && (
                      <div className="text-xs text-blue-screen mb-2">Q: {r.query}</div>
                    )}
                    <div className="text-sm text-g-11 whitespace-pre-wrap">{r.response}</div>
                    <div className="text-2xs text-g-7 mt-2">{formatTime(r.timestamp)} · {r.provider}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {detailTab === 'transcript' && (
          <div className="space-y-1">
            {transcripts.length === 0 ? (
              <div className="text-center py-12 text-g-8 text-sm">No transcript recorded</div>
            ) : (
              transcripts.map(t => (
                <div key={t.id} className="flex gap-3 py-1.5 hover:bg-g-3 rounded px-2 -mx-2">
                  <div className="text-2xs text-g-7 w-12 shrink-0 pt-0.5 font-mono">
                    {formatTime(t.timestamp)}
                  </div>
                  <div className="flex-1 text-sm text-g-11">
                    <span className="font-medium text-blue-screen">{t.speaker}</span>: {t.text}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === 'usage' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-g-3 rounded-xl border border-g-5 text-center">
                <div className="text-2xl font-semibold text-g-12">{transcripts.length}</div>
                <div className="text-xs text-g-8 mt-1">Transcript lines</div>
              </div>
              <div className="p-4 bg-g-3 rounded-xl border border-g-5 text-center">
                <div className="text-2xl font-semibold text-g-12">{responses.length}</div>
                <div className="text-xs text-g-8 mt-1">AI responses</div>
              </div>
              <div className="p-4 bg-g-3 rounded-xl border border-g-5 text-center">
                <div className="text-2xl font-semibold text-g-12">{formatDuration(meeting?.duration_seconds ?? null) || '--'}</div>
                <div className="text-xs text-g-8 mt-1">Duration</div>
              </div>
            </div>
            {responses.length > 0 && (
              <div className="p-4 bg-g-3 rounded-xl border border-g-5">
                <div className="text-xs text-g-8 mb-2">Providers used</div>
                <div className="flex gap-2 flex-wrap">
                  {[...new Set(responses.map(r => r.provider))].map(p => (
                    <span key={p} className="px-2 py-1 bg-g-4 rounded text-xs text-g-11">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom bar: Resume Session + Ask about meeting — MAJOR-5 fix: wired handlers */}
        <div className="flex items-center gap-3 mt-8 pt-4 border-t border-g-5">
          <button
            onClick={resumeSession}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-g-3 border border-g-5 text-sm text-g-11 hover:text-g-12 hover:bg-g-4 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Resume Session
          </button>
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-g-3 border border-g-5">
            <input
              type="text"
              value={meetingQuery}
              onChange={e => setMeetingQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && meetingQuery.trim()) askAboutMeeting() }}
              placeholder="Ask about this meeting..."
              className="flex-1 bg-transparent text-sm text-g-12 placeholder-g-8 outline-none"
            />
            <button
              onClick={askAboutMeeting}
              disabled={!meetingQuery.trim()}
              className="w-6 h-6 rounded-full btn-send flex items-center justify-center shrink-0"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Meeting list view (matches Cluely image 8)
  const grouped = groupByDate(meetings)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-g-12">AskToto</h1>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start Toto
        </button>
      </div>

      <p className="text-sm text-g-8 mb-6">
        {meetings.length === 0
          ? 'You have no upcoming meetings.'
          : `${meetings.length} session${meetings.length !== 1 ? 's' : ''} recorded`
        }
      </p>

      {meetings.length === 0 ? (
        <div className="text-center py-16">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-g-6 mb-4">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <div className="text-sm text-g-8 mb-1">No sessions yet</div>
          <div className="text-xs text-g-6">Start a recording to create your first session</div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="text-xs font-medium text-g-8 mb-2 px-1">{dateLabel}</div>
              <div className="space-y-0.5">
                {items.map(m => (
                  <button
                    key={m.id}
                    onClick={() => selectMeeting(m.id)}
                    className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-g-3 transition-colors group"
                  >
                    <div className="text-sm text-g-11 group-hover:text-g-12 transition-colors">
                      {m.title || `Untitled session`}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-g-7">
                      {m.started_at && <span>{formatTime(m.started_at)}</span>}
                      {m.duration_seconds && <span>{formatDuration(m.duration_seconds)}</span>}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
