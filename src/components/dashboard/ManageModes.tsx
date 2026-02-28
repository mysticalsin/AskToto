import { useState, useEffect } from 'react'

interface Mode {
  id: string
  name: string
  prompt: string
  notesTemplate: string
  isActive: boolean
}

const DEFAULT_MODES: Mode[] = [
  {
    id: 'default',
    name: 'Default',
    prompt: `You're a real-time assistant that gives the user info during meetings and other workflows. Your goal is to answer the user's query directly.

Responses must be EXTREMELY short and terse

- Aim for 1-2 sentences, and if longer, use bullet points for structure
- Get straight to the point and NEVER add filler, preamble, or meta-comments
- Never give the user a direct script or word track to say, your responses must be natural sounding suggestions`,
    notesTemplate: '',
    isActive: true,
  },
  {
    id: 'meetings',
    name: 'Meetings',
    prompt: `You are a meeting assistant. Listen to the conversation and help the user participate effectively.

- Suggest talking points and responses
- Track action items and decisions
- Provide relevant context from earlier in the meeting
- Keep responses brief and actionable`,
    notesTemplate: '## Action Items\n\n## Key Decisions\n\n## Follow-ups\n',
    isActive: false,
  },
  {
    id: 'sales',
    name: 'Sales',
    prompt: `You are a sales call assistant. Help the user close deals and handle objections.

- Suggest responses to objections
- Identify buying signals
- Track key requirements and pain points
- Recommend next steps and follow-up actions`,
    notesTemplate: '## Prospect Info\n\n## Pain Points\n\n## Next Steps\n',
    isActive: false,
  },
]

export default function ManageModes() {
  const [modes, setModes] = useState<Mode[]>(DEFAULT_MODES)
  const [selectedId, setSelectedId] = useState<string>('default')

  // MAJOR-6 fix: Load modes from settings on mount
  useEffect(() => {
    window.api?.invoke('settings:get', 'modes').then((saved: Mode[] | null) => {
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setModes(saved)
      }
    }).catch(() => {})
  }, [])

  const selected = modes.find(m => m.id === selectedId) || modes[0]

  const setActive = (id: string) => {
    const updated = modes.map(m => ({ ...m, isActive: m.id === id }))
    setModes(updated)
    saveModes(updated)
  }

  const updatePrompt = (prompt: string) => {
    setModes(prev => prev.map(m => m.id === selectedId ? { ...m, prompt } : m))
  }

  const updateNotesTemplate = (notesTemplate: string) => {
    setModes(prev => prev.map(m => m.id === selectedId ? { ...m, notesTemplate } : m))
  }

  const addMode = () => {
    const newMode: Mode = {
      id: `custom-${Date.now()}`,
      name: `Custom ${modes.length}`,
      prompt: 'You are a helpful assistant.\n\n- Keep responses brief\n- Be direct and actionable',
      notesTemplate: '',
      isActive: false,
    }
    const updated = [...modes, newMode]
    setModes(updated)
    setSelectedId(newMode.id)
    saveModes(updated)
  }

  // MAJOR-6 fix: Duplicate actually copies selected mode's content
  const duplicateMode = () => {
    const newMode: Mode = {
      id: `custom-${Date.now()}`,
      name: `${selected.name} (Copy)`,
      prompt: selected.prompt,
      notesTemplate: selected.notesTemplate,
      isActive: false,
    }
    const updated = [...modes, newMode]
    setModes(updated)
    setSelectedId(newMode.id)
    saveModes(updated)
  }

  const deleteMode = (id: string) => {
    if (id === 'default') return
    const updated = modes.filter(m => m.id !== id)
    setModes(updated)
    if (selectedId === id) setSelectedId('default')
    saveModes(updated)
  }

  const saveModes = async (data?: Mode[]) => {
    try {
      await window.api?.invoke('settings:set', 'modes', data || modes)
    } catch {}
  }

  // MAJOR-6 fix: Copy prompt to clipboard
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(selected.prompt)
    } catch {}
  }

  // MAJOR-6 fix: Paste from clipboard into prompt
  const pastePrompt = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) updatePrompt(text)
    } catch {}
  }

  return (
    <div className="animate-fade-in flex gap-0 -m-8 h-[calc(100%+64px)]">
      {/* Left sidebar - mode list */}
      <div className="w-56 border-r border-g-5 flex flex-col bg-g-2 shrink-0">
        <div className="p-3">
          <button
            onClick={addMode}
            className="w-full py-2 px-3 rounded-lg bg-g-4 border border-g-5 text-sm font-medium text-g-12 hover:bg-g-5 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-blue-screen">+</span> New Mode
          </button>
        </div>

        <div className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                selectedId === m.id
                  ? 'bg-g-4 text-g-12'
                  : 'text-g-10 hover:bg-g-3 hover:text-g-11'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className="flex-1 truncate">{m.name}</span>
              {m.isActive && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-g-5">
          <button
            onClick={() => { setModes(DEFAULT_MODES); setSelectedId('default'); saveModes(DEFAULT_MODES) }}
            className="text-xs text-g-8 hover:text-g-11 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Right content - mode editor */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-g-12">{selected.name}</h2>
          <div className="flex items-center gap-2">
            {selected.isActive ? (
              <span className="flex items-center gap-1 text-sm text-green-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                Active
              </span>
            ) : (
              <button
                onClick={() => setActive(selected.id)}
                className="px-3 py-1 text-xs rounded-lg bg-g-3 border border-g-5 text-g-10 hover:text-g-12 hover:bg-g-4 transition-colors"
              >
                Set Active
              </button>
            )}
            {selected.id !== 'default' && (
              <button
                onClick={() => deleteMode(selected.id)}
                className="p-1.5 rounded-lg text-g-8 hover:text-red-400 hover:bg-g-3 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Real-time prompt */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-g-11 mb-2">Real-time prompt</h3>
          <textarea
            value={selected.prompt}
            onChange={e => updatePrompt(e.target.value)}
            className="w-full h-48 p-4 bg-g-3 border border-g-5 rounded-xl text-sm text-g-12 placeholder-g-8 outline-none resize-y font-sans leading-relaxed focus:border-blue-glow transition-colors"
          />
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-1">
              {/* MAJOR-6 fix: Copy, Paste, Duplicate all have working handlers */}
              <button onClick={copyPrompt} className="p-1.5 rounded bg-g-4 text-g-8 hover:text-g-11 transition-colors" title="Copy">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
              <button onClick={pastePrompt} className="p-1.5 rounded bg-g-4 text-g-8 hover:text-g-11 transition-colors" title="Paste">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
              </button>
              <button onClick={duplicateMode} className="p-1.5 rounded bg-g-4 text-g-8 hover:text-g-11 transition-colors" title="Duplicate">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => saveModes()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-g-4 border border-g-5 text-g-12 hover:bg-g-5 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* Notes template */}
        <div>
          <h3 className="text-sm font-medium text-g-11 mb-2">Notes template</h3>
          <p className="text-xs text-g-8 mb-3">Add a template for custom formatting for your notes</p>
          {selected.notesTemplate ? (
            <textarea
              value={selected.notesTemplate}
              onChange={e => updateNotesTemplate(e.target.value)}
              className="w-full h-32 p-4 bg-g-3 border border-g-5 rounded-xl text-sm text-g-12 placeholder-g-8 outline-none resize-y font-sans leading-relaxed focus:border-blue-glow transition-colors"
            />
          ) : (
            <button
              onClick={() => updateNotesTemplate('## Notes\n\n')}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-g-4 border border-g-5 text-g-12 hover:bg-g-5 transition-colors flex items-center gap-2"
            >
              Add template <span className="text-blue-screen">+</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
