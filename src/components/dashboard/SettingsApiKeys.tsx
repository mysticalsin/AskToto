import { useState, useEffect } from 'react'

interface KeyState {
  value: string
  saved: boolean
  testing: boolean
  status: 'idle' | 'valid' | 'invalid'
}

const PROVIDERS = [
  { id: 'openaiKey', label: 'OpenAI', placeholder: 'sk-...', models: 'GPT-4o, GPT-4o-mini, Whisper' },
  { id: 'anthropicKey', label: 'Anthropic', placeholder: 'sk-ant-...', models: 'Claude Sonnet, Claude Haiku' },
  { id: 'geminiKey', label: 'Google Gemini', placeholder: 'AI...', models: 'Gemini 2.0 Flash, Gemini Pro' },
  { id: 'kimiKey', label: 'Kimi (Moonshot)', placeholder: 'sk-...', models: 'Kimi K2, Kimi K2.5' },
] as const

type ProviderId = typeof PROVIDERS[number]['id']

const modelOptions: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
  gemini: ['gemini-2.0-flash', 'gemini-2.0-pro'],
  kimi: ['kimi-k2-0905-preview', 'kimi-k2.5', 'moonshot-v1-128k'],
}

const defaultModels: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  kimi: 'kimi-k2-0905-preview',
}

export default function SettingsApiKeys() {
  const [keys, setKeys] = useState<Record<ProviderId, KeyState>>({
    openaiKey: { value: '', saved: false, testing: false, status: 'idle' },
    anthropicKey: { value: '', saved: false, testing: false, status: 'idle' },
    geminiKey: { value: '', saved: false, testing: false, status: 'idle' },
    kimiKey: { value: '', saved: false, testing: false, status: 'idle' },
  })
  const [activeProvider, setActiveProvider] = useState('openai')
  const [activeModel, setActiveModel] = useState('gpt-4o')
  const [sttMode, setSttMode] = useState<'cloud' | 'local'>('cloud')

  useEffect(() => {
    // Load saved keys
    PROVIDERS.forEach(p => {
      window.api?.invoke('settings:get', p.id).then((v: string | null) => {
        if (v) {
          setKeys(prev => ({ ...prev, [p.id]: { ...prev[p.id], value: v, saved: true } }))
        }
      }).catch(() => {})
    })
    window.api?.invoke('settings:get', 'activeProvider').then((v: string | null) => {
      if (v) setActiveProvider(v)
    }).catch(() => {})
    window.api?.invoke('settings:get', 'activeModel').then((v: string | null) => {
      if (v) setActiveModel(v)
    }).catch(() => {})
    // MAJOR-3 fix: Load STT mode
    window.api?.invoke('settings:get', 'sttMode').then((v: string | null) => {
      if (v === 'cloud' || v === 'local') setSttMode(v)
    }).catch(() => {})
  }, [])

  const updateKey = (id: ProviderId, value: string) => {
    setKeys(prev => ({ ...prev, [id]: { ...prev[id], value, saved: false, status: 'idle' } }))
  }

  const saveKey = async (id: ProviderId) => {
    await window.api?.invoke('settings:set', id, keys[id].value)
    setKeys(prev => ({ ...prev, [id]: { ...prev[id], saved: true } }))
  }

  const testKey = async (id: ProviderId) => {
    setKeys(prev => ({ ...prev, [id]: { ...prev[id], testing: true, status: 'idle' } }))
    try {
      const providerMap: Record<string, string> = {
        openaiKey: 'openai',
        anthropicKey: 'anthropic',
        geminiKey: 'gemini',
        kimiKey: 'kimi',
      }
      const provider = providerMap[id]
      const result = await window.api?.invoke('llm:test', provider)
      setKeys(prev => ({ ...prev, [id]: { ...prev[id], testing: false, status: result ? 'valid' : 'invalid' } }))
    } catch {
      setKeys(prev => ({ ...prev, [id]: { ...prev[id], testing: false, status: 'invalid' } }))
    }
  }

  // MAJOR-3 fix: Reset model to default when switching providers
  const saveProvider = (provider: string) => {
    setActiveProvider(provider)
    const model = defaultModels[provider] || ''
    setActiveModel(model)
    window.api?.invoke('settings:set', 'activeProvider', provider).catch(() => {})
    window.api?.invoke('settings:set', 'activeModel', model).catch(() => {})
  }

  const saveModel = (model: string) => {
    setActiveModel(model)
    window.api?.invoke('settings:set', 'activeModel', model).catch(() => {})
  }

  // MAJOR-3 fix: STT mode handler
  const handleSttMode = (mode: 'cloud' | 'local') => {
    setSttMode(mode)
    window.api?.invoke('settings:set', 'sttMode', mode).catch(() => {})
  }

  const providerLabels: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Gemini',
    kimi: 'Kimi',
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold text-g-12 mb-2">API Keys</h2>
      <p className="text-sm text-g-10 mb-6">Manage your LLM provider API keys</p>

      {/* Active Provider */}
      <div className="mb-6 p-4 bg-g-3 rounded-xl border border-g-5">
        <div className="text-xs font-medium text-g-8 uppercase tracking-wider mb-3">Active Provider</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          {['openai', 'anthropic', 'gemini', 'kimi'].map(p => (
            <button
              key={p}
              onClick={() => saveProvider(p)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                activeProvider === p ? 'bg-blue-primary text-white' : 'bg-g-4 text-g-10 hover:bg-g-5'
              }`}
            >
              {providerLabels[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-g-8">Model:</span>
          <select
            value={activeModel}
            onChange={e => saveModel(e.target.value)}
            className="bg-g-4 border border-g-5 rounded-lg px-2 py-1 text-xs text-g-12 outline-none"
          >
            {(modelOptions[activeProvider] || []).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* API Key Inputs */}
      <div className="space-y-4">
        {PROVIDERS.map(p => {
          const k = keys[p.id]
          return (
            <div key={p.id} className="p-4 bg-g-3 rounded-xl border border-g-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-g-12">{p.label}</div>
                {k.status === 'valid' && (
                  <span className="text-xs text-accent-green flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Connected
                  </span>
                )}
                {k.status === 'invalid' && (
                  <span className="text-xs text-accent-red">Invalid key</span>
                )}
              </div>
              <div className="text-xs text-g-8 mb-3">Models: {p.models}</div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={k.value}
                  onChange={e => updateKey(p.id, e.target.value)}
                  placeholder={p.placeholder}
                  className="input-field flex-1 text-sm"
                />
                <button
                  onClick={() => saveKey(p.id)}
                  disabled={!k.value || k.saved}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    k.value && !k.saved
                      ? 'bg-blue-primary text-white hover:bg-blue-hover'
                      : 'bg-g-4 text-g-8 cursor-not-allowed'
                  }`}
                >
                  {k.saved ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={() => testKey(p.id)}
                  disabled={!k.value || k.testing}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    k.value && !k.testing
                      ? 'bg-g-4 text-g-11 hover:bg-g-5'
                      : 'bg-g-4 text-g-8 cursor-not-allowed'
                  }`}
                >
                  {k.testing ? 'Testing...' : 'Test'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* MAJOR-3 fix: STT Mode with working onClick handlers */}
      <div className="mt-6 p-4 bg-g-3 rounded-xl border border-g-5">
        <div className="text-xs font-medium text-g-8 uppercase tracking-wider mb-3">Speech-to-Text</div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSttMode('cloud')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              sttMode === 'cloud' ? 'bg-blue-primary text-white' : 'bg-g-4 text-g-10 hover:bg-g-5'
            }`}
          >
            Cloud (Whisper API)
          </button>
          <button
            onClick={() => handleSttMode('local')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              sttMode === 'local' ? 'bg-blue-primary text-white' : 'bg-g-4 text-g-10 hover:bg-g-5'
            }`}
          >
            Local (Faster-Whisper)
          </button>
        </div>
        <p className="text-xs text-g-8 mt-2">Cloud mode uses your OpenAI API key. Local mode requires Python + Faster-Whisper installed.</p>
      </div>
    </div>
  )
}
