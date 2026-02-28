import { useState, useEffect } from 'react'

interface Keybind {
  id: string
  label: string
  icon: JSX.Element
  type: 'shortcut' | 'toggle'
  shortcut?: string
  keys?: string[]
  enabled: boolean
}

// MAJOR-13/MINOR-14 fix: Removed Ctrl+R "Collapse Chat" shortcut — conflicts with browser reload
const DEFAULT_KEYBINDS: Keybind[] = [
  {
    id: 'undetectable', label: 'Undetectability', type: 'toggle', enabled: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10.01"/><line x1="10" y1="10" x2="10" y2="10.01"/><line x1="14" y1="10" x2="14" y2="10.01"/><line x1="18" y1="10" x2="18" y2="10.01"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
  },
  {
    id: 'toggle-overlay', label: 'Show/Hide Chat', type: 'shortcut', keys: ['Ctrl', '\\'], enabled: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
  },
  {
    id: 'hide-widget-too', label: 'Hide Chat Also Hides Widget', type: 'toggle', enabled: false,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  },
  {
    id: 'trigger-ai', label: 'Auto-Answer', type: 'shortcut', keys: ['Ctrl', '↵'], enabled: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
  },
  {
    id: 'move-overlay', label: 'Move AskToto', type: 'shortcut', keys: ['Ctrl', '↑', '↓', '←', '→'], enabled: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
  },
  {
    id: 'scroll-chat', label: 'Scroll Chat', type: 'shortcut', keys: ['Ctrl', 'Shift', '↑', '↓'], enabled: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
  },
  {
    id: 'toggle-recording', label: 'Toggle Recording', type: 'shortcut', keys: ['Ctrl', 'Shift', 'R'], enabled: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
  },
]

export default function SettingsKeybinds() {
  const [keybinds, setKeybinds] = useState<Keybind[]>(DEFAULT_KEYBINDS)

  // MAJOR-3 fix: Load persisted toggle states on mount
  useEffect(() => {
    window.api?.invoke('settings:get', 'keybindToggles').then((saved: Record<string, boolean> | null) => {
      if (saved && typeof saved === 'object') {
        setKeybinds(prev => prev.map(k => {
          if (k.type === 'toggle' && saved[k.id] !== undefined) {
            return { ...k, enabled: saved[k.id] }
          }
          return k
        }))
      }
    }).catch(() => {})
  }, [])

  // MAJOR-3 fix: Persist toggle states via IPC
  const toggleEnabled = (id: string) => {
    setKeybinds(prev => {
      const updated = prev.map(k => k.id === id ? { ...k, enabled: !k.enabled } : k)
      // Save toggle states to settings
      const toggles: Record<string, boolean> = {}
      updated.filter(k => k.type === 'toggle').forEach(k => { toggles[k.id] = k.enabled })
      window.api?.invoke('settings:set', 'keybindToggles', toggles).catch(() => {})
      return updated
    })
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-g-12 mb-2">Shortcuts</h2>
        <p className="text-sm text-g-10">Keyboard shortcuts and toggles</p>
      </div>

      <div className="divide-y divide-[rgba(155,155,155,0.1)]">
        {keybinds.map(k => (
          <div
            key={k.id}
            className="flex items-center gap-4 py-4 px-1"
          >
            {/* Icon */}
            <div className="text-g-11 shrink-0">
              {k.icon}
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-g-12">{k.label}</div>
            </div>

            {/* Shortcut keys or toggle */}
            {k.type === 'toggle' ? (
              <button
                onClick={() => toggleEnabled(k.id)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                  k.enabled ? 'bg-blue-primary' : 'bg-g-5'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  k.enabled ? 'left-6' : 'left-1'
                }`} />
              </button>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                {k.keys?.map((key, i) => (
                  <kbd
                    key={`${k.id}-${key}-${i}`}
                    className="min-w-[28px] h-7 flex items-center justify-center px-1.5 rounded-md bg-g-4 border border-g-6 text-xs font-mono text-g-11"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
