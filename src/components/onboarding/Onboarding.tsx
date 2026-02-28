import { useState } from 'react'
import TitleBar from '../TitleBar'

interface OnboardingProps {
  onComplete: () => void
}

type Step = 'welcome' | 'apikeys' | 'mode' | 'tutorial'

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', description: 'GPT-4o, GPT-4o-mini' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...', description: 'Claude Sonnet, Claude Haiku' },
  { id: 'gemini', name: 'Google Gemini', placeholder: 'AI...', description: 'Gemini 2.0 Flash, Gemini Pro' },
  { id: 'kimi', name: 'Kimi (Moonshot)', placeholder: 'sk-...', description: 'Kimi K2, Kimi K2.5' },
]

const USE_CASES = [
  { id: 'job', icon: '💼', label: 'Looking for a job', desc: 'Interviews, networking calls, career chats' },
  { id: 'student', icon: '🎓', label: 'Student', desc: 'Presentations, research help, office hours' },
  { id: 'professional', icon: '👔', label: 'Professional', desc: 'Client calls, sales pitches, stakeholder meetings' },
  { id: 'curious', icon: '🔍', label: 'Curious', desc: 'Explore how AskToto fits your workflow' },
]

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [keys, setKeys] = useState({ openai: '', anthropic: '', gemini: '', kimi: '' })
  const [selectedUseCase, setSelectedUseCase] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const hasAnyKey = keys.openai || keys.anthropic || keys.gemini || keys.kimi

  const saveAndContinue = async () => {
    if (!window.api) {
      onComplete()
      return
    }
    const activeProvider = keys.openai ? 'openai' : keys.anthropic ? 'anthropic' : keys.gemini ? 'gemini' : 'kimi'
    await window.api.invoke('save-settings', {
      openaiKey: keys.openai,
      anthropicKey: keys.anthropic,
      geminiKey: keys.gemini,
      kimiKey: keys.kimi,
      activeProvider,
    })
    if (step === 'apikeys') {
      setStep('mode')
    } else {
      onComplete()
    }
  }

  const testConnection = async () => {
    if (!window.api) return
    setTesting(true)
    setTestResult(null)
    try {
      const provider = keys.openai ? 'openai' : keys.anthropic ? 'anthropic' : keys.gemini ? 'gemini' : 'kimi'
      const result = await window.api.invoke('test-llm-connection', {
        openaiKey: keys.openai,
        anthropicKey: keys.anthropic,
        geminiKey: keys.gemini,
        kimiKey: keys.kimi,
        activeProvider: provider,
      })
      setTestResult(result ? 'Connected successfully!' : 'Connection failed')
    } catch {
      setTestResult('Connection failed')
    }
    setTesting(false)
  }

  // MINOR-13 fix: Save use case to settings
  const handleContinueFromMode = () => {
    if (selectedUseCase) {
      window.api?.invoke('settings:set', 'useCase', selectedUseCase).catch(() => {})
    }
    setStep('tutorial')
  }

  return (
    <div className="w-full h-full bg-g-1 flex flex-col overflow-hidden">
      {/* MAJOR-10 fix: Use IPC for close instead of window.close() */}
      <TitleBar title="AskToto" showMaximize={false} onClose={() => window.api?.send('window:close')} />
      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left Panel */}
      <div className="flex-1 flex flex-col justify-center px-12 pb-8 max-w-[560px] overflow-y-auto overflow-x-hidden">
        {step === 'welcome' && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-blue-primary to-[#022c70] flex items-center justify-center shadow-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" fill="none"/><path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" fill="none"/>
                </svg>
              </div>
              <span className="text-xl font-semibold text-g-12">AskToto</span>
            </div>

            <h1 className="text-3xl font-bold text-g-12 mb-3">Welcome to AskToto</h1>
            <p className="text-base text-g-10 mb-8">The ultimate AI meeting assistant. Get real-time help during meetings, interviews, and calls.</p>

            <button onClick={() => setStep('apikeys')} className="btn-primary text-sm py-2.5 px-8 rounded-lg">
              Get Started
            </button>

            <p className="text-2xs text-g-8 mt-6">
              Powered by your own API keys. All data stays on your machine.
            </p>
          </div>
        )}

        {step === 'apikeys' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-g-12 mb-2">Connect your AI</h1>
            <p className="text-sm text-g-10 mb-6">Enter at least one API key to get started. You can add more later in Settings.</p>

            <div className="space-y-4">
              {PROVIDERS.map(p => (
                <div key={p.id}>
                  <label className="block text-xs font-medium text-g-10 mb-1.5">{p.name}</label>
                  <input
                    type="password"
                    value={keys[p.id as keyof typeof keys]}
                    onChange={e => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={p.placeholder}
                    className="input-field"
                  />
                  <p className="text-2xs text-g-8 mt-1">{p.description}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={saveAndContinue}
                disabled={!hasAnyKey}
                className={`btn-primary text-sm py-2 px-6 rounded-lg ${!hasAnyKey ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Continue
              </button>
              <button
                onClick={testConnection}
                disabled={!hasAnyKey || testing}
                className="btn-secondary text-sm py-2 px-4 rounded-lg"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              {testResult && (
                <span className={`text-xs ${testResult.includes('success') ? 'text-accent-green' : 'text-accent-red'}`}>
                  {testResult}
                </span>
              )}
            </div>

            <button onClick={() => setStep('welcome')} className="text-xs text-g-8 hover:text-g-11 mt-4 transition-colors">
              ← Back
            </button>
          </div>
        )}

        {step === 'mode' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-g-12 mb-2">How will you use AskToto?</h1>
            <p className="text-sm text-g-10 mb-6">This helps us tailor the experience for you.</p>

            <div className="grid grid-cols-2 gap-3">
              {USE_CASES.map(uc => (
                <button
                  key={uc.id}
                  onClick={() => setSelectedUseCase(uc.id)}
                  className={`onboarding-card text-left ${selectedUseCase === uc.id ? 'selected' : ''}`}
                >
                  <span className="text-xl mb-2 block">{uc.icon}</span>
                  <span className="text-sm font-medium text-g-12 block">{uc.label}</span>
                  <span className="text-2xs text-g-9 block mt-0.5">{uc.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-6">
              {/* MODERATE-11 fix: Properly disable continue when no use case selected */}
              <button
                onClick={handleContinueFromMode}
                disabled={!selectedUseCase}
                className={`btn-primary text-sm py-2 px-6 rounded-lg ${!selectedUseCase ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Continue
              </button>
              <button
                onClick={() => setStep('tutorial')}
                className="text-xs text-g-8 hover:text-g-11 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {step === 'tutorial' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-g-12 mb-2">You're all set!</h1>
            <p className="text-sm text-g-10 mb-6">Here are your keyboard shortcuts:</p>

            <div className="space-y-3 mb-8">
              {[
                { keys: 'Ctrl + Enter', desc: 'Ask AI about your screen and audio' },
                { keys: 'Ctrl + \\', desc: 'Hide / show the overlay' },
                { keys: 'Ctrl + Shift + R', desc: 'Start / stop recording' },
                { keys: 'Ctrl + Shift + ↑↓', desc: 'Scroll the response' },
              ].map(s => (
                <div key={s.keys} className="flex items-center justify-between py-2 px-4 bg-g-2 rounded-lg border border-g-5">
                  <span className="text-sm text-g-11">{s.desc}</span>
                  <kbd className="px-2 py-1 bg-g-4 rounded text-xs text-g-12 font-mono">{s.keys}</kbd>
                </div>
              ))}
            </div>

            <button onClick={onComplete} className="btn-primary text-sm py-2.5 px-8 rounded-lg">
              Start Using AskToto
            </button>
          </div>
        )}
      </div>

      {/* Right Panel - Decorative */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-g-2 to-g-1">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(100,139,236,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(100,139,236,0.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-80 rounded-2xl bg-gradient-to-b from-[var(--surface-panel-from)] to-[var(--surface-panel-to)] border border-[rgba(155,155,155,0.2)] shadow-2xl backdrop-blur-xl p-4">
            <div className="flex items-center gap-2 pb-3 border-b border-g-5">
              <div className="w-5 h-5 rounded bg-blue-primary/30 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-screen" />
              </div>
              <span className="text-2xs text-g-10 font-medium">AskToto</span>
              <span className="text-[8px] px-1 py-0.5 rounded bg-g-5 text-g-9">AI</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-2 bg-g-5 rounded w-3/4" />
              <div className="h-2 bg-g-5 rounded w-full" />
              <div className="h-2 bg-g-5 rounded w-2/3" />
              <div className="mt-4 p-2 rounded-lg bg-blue-primary/10 border border-blue-primary/20">
                <div className="h-2 bg-blue-primary/30 rounded w-full mb-1.5" />
                <div className="h-2 bg-blue-primary/30 rounded w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>{/* end content flex wrapper */}
    </div>
  )
}
