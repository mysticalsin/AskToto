import { useState, useEffect } from 'react'

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
  { code: 'fi', name: 'Finnish', native: 'Suomi' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
]

export default function SettingsLanguage() {
  const [selected, setSelected] = useState('auto')
  const [responseLanguage, setResponseLanguage] = useState('auto')
  const [search, setSearch] = useState('')

  // MAJOR-7 fix: Load saved language settings on mount
  useEffect(() => {
    window.api?.invoke('settings:get', 'transcriptionLanguage').then((v: string | null) => {
      if (v) setSelected(v)
    }).catch(() => {})
    window.api?.invoke('settings:get', 'responseLanguage').then((v: string | null) => {
      if (v) setResponseLanguage(v)
    }).catch(() => {})
  }, [])

  const filtered = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.native.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (code: string) => {
    setSelected(code)
    window.api?.invoke('settings:set', 'transcriptionLanguage', code).catch(() => {})
  }

  const handleResponseLang = (code: string) => {
    setResponseLanguage(code)
    window.api?.invoke('settings:set', 'responseLanguage', code).catch(() => {})
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold text-g-12 mb-2">Language</h2>
      <p className="text-sm text-g-10 mb-6">Set language preferences for transcription and AI responses</p>

      {/* Transcription Language */}
      <div className="mb-6">
        <div className="text-xs font-medium text-g-8 uppercase tracking-wider mb-3">Transcription Language</div>
        <p className="text-xs text-g-8 mb-3">The language spoken in your meetings</p>

        {/* Auto-detect (Multi-language) card */}
        <button
          onClick={() => handleSelect('auto')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors mb-3 ${
            selected === 'auto'
              ? 'bg-blue-primary/10 border border-blue-primary text-g-12'
              : 'bg-g-3 border border-transparent text-g-10 hover:bg-g-4 hover:text-g-12'
          }`}
        >
          {/* Globe icon */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            selected === 'auto' ? 'bg-blue-primary/20 text-blue-screen' : 'bg-g-4 text-g-8'
          }`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Auto-detect (Multi-language)</div>
            <div className="text-xs text-g-8 mt-0.5">English, French, Spanish, Italian, Portuguese & 90+ more</div>
          </div>
          {selected === 'auto' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-screen shrink-0">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>

        {/* Divider with hint */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-g-5" />
          <span className="text-2xs text-g-7">or pick a single language for higher accuracy</span>
          <div className="flex-1 h-px bg-g-5" />
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search languages..."
          className="input-field w-full mb-3 text-sm"
        />

        <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
          {filtered.map(l => (
            <button
              key={l.code}
              onClick={() => handleSelect(l.code)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                selected === l.code
                  ? 'bg-blue-primary/10 border border-blue-primary text-g-12'
                  : 'bg-g-3 border border-transparent text-g-10 hover:bg-g-4 hover:text-g-12'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.name}</div>
                <div className="text-xs text-g-8">{l.native}</div>
              </div>
              {selected === l.code && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-screen shrink-0">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Response Language */}
      <div className="p-4 bg-g-3 rounded-xl border border-g-5">
        <div className="text-xs font-medium text-g-8 uppercase tracking-wider mb-3">AI Response Language</div>
        <p className="text-xs text-g-8 mb-3">The language the AI should respond in</p>
        <select
          value={responseLanguage}
          onChange={e => handleResponseLang(e.target.value)}
          className="bg-g-4 border border-g-5 rounded-lg px-3 py-2 text-sm text-g-12 outline-none w-full"
        >
          <option value="auto">Same as transcription</option>
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.name} ({l.native})</option>
          ))}
        </select>
      </div>
    </div>
  )
}
