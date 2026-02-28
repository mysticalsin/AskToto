import { useState } from 'react'
import TitleBar from '../TitleBar'
import SettingsGeneral from './SettingsGeneral'
import SettingsApiKeys from './SettingsApiKeys'
import SettingsKeybinds from './SettingsKeybinds'
import SettingsLanguage from './SettingsLanguage'
import SessionList from './SessionList'
import ManageModes from './ManageModes'

type SettingsTab = 'sessions' | 'modes' | 'general' | 'apikeys' | 'keybinds' | 'language' | 'about'

interface DashboardProps {
  onClose: () => void
}

const NAV_ITEMS: { id: SettingsTab; label: string; icon: JSX.Element; section?: string }[] = [
  {
    id: 'sessions', label: 'Sessions', section: 'main',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  },
  {
    id: 'modes', label: 'Manage Modes', section: 'main',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  },
  {
    id: 'general', label: 'General', section: 'settings',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
  },
  {
    id: 'apikeys', label: 'API Keys', section: 'settings',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
  },
  {
    id: 'keybinds', label: 'Shortcuts', section: 'settings',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
  },
  {
    id: 'language', label: 'Language', section: 'settings',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
  },
  {
    id: 'about', label: 'About', section: 'support',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  },
]

export default function Dashboard({ onClose }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sessions')

  // MAJOR-4 fix: Quit handler
  const handleQuit = () => {
    window.api?.invoke('app:quit').catch(() => {})
  }

  return (
    <div className="w-full h-full flex flex-col dashboard-bg overflow-hidden">
      <TitleBar title="AskToto" onClose={onClose} />

      {/* Main body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 settings-sidebar flex flex-col p-3 shrink-0 overflow-y-auto overflow-x-hidden">
          {/* Main Nav */}
          <div className="mb-4">
            <div className="text-2xs font-medium text-g-8 uppercase tracking-wider px-3 mb-1">Main</div>
            {NAV_ITEMS.filter(n => n.section === 'main').map(n => (
              <button key={n.id} onClick={() => setActiveTab(n.id)} className={`settings-nav-item w-full ${activeTab === n.id ? 'active' : ''}`}>
                {n.icon}{n.label}
              </button>
            ))}
          </div>

          {/* Settings Nav */}
          <div className="mb-4">
            <div className="text-2xs font-medium text-g-8 uppercase tracking-wider px-3 mb-1">Settings</div>
            {NAV_ITEMS.filter(n => n.section === 'settings').map(n => (
              <button key={n.id} onClick={() => setActiveTab(n.id)} className={`settings-nav-item w-full ${activeTab === n.id ? 'active' : ''}`}>
                {n.icon}{n.label}
              </button>
            ))}
          </div>

          {/* Support Nav */}
          <div className="mb-4">
            <div className="text-2xs font-medium text-g-8 uppercase tracking-wider px-3 mb-1">Support</div>
            {NAV_ITEMS.filter(n => n.section === 'support').map(n => (
              <button key={n.id} onClick={() => setActiveTab(n.id)} className={`settings-nav-item w-full ${activeTab === n.id ? 'active' : ''}`}>
                {n.icon}{n.label}
              </button>
            ))}
          </div>

          {/* Bottom — MAJOR-4 fix: Add onClick handler to quit button */}
          <div className="mt-auto space-y-1">
            <button onClick={handleQuit} className="settings-nav-item w-full text-g-8 hover:text-accent-red">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Quit AskToto
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 bg-g-1 min-w-0">
          <div className={`${activeTab === 'modes' ? 'h-full' : 'max-w-3xl mx-auto'}`}>
            {activeTab === 'sessions' && <SessionList />}
            {activeTab === 'modes' && <ManageModes />}
            {activeTab === 'general' && <SettingsGeneral />}
            {activeTab === 'apikeys' && <SettingsApiKeys />}
            {activeTab === 'keybinds' && <SettingsKeybinds />}
            {activeTab === 'language' && <SettingsLanguage />}
            {activeTab === 'about' && (
              <div className="animate-fade-in">
                <h2 className="text-xl font-semibold text-g-12 mb-2">About AskToto</h2>
                <p className="text-sm text-g-10 mb-6">Real-time AI meeting assistant</p>
                <div className="space-y-3 text-sm text-g-10">
                  <div className="flex justify-between py-3 border-b border-g-5">
                    <span>Version</span><span className="text-g-12">1.0.0</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-g-5">
                    <span>Electron</span><span className="text-g-12">33.x</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-g-5">
                    <span>Data Storage</span><span className="text-g-12">Local (on device)</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-g-5">
                    <span>License</span><span className="text-g-12">MIT</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
