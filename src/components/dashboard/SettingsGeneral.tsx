import { useState, useEffect } from 'react'

export default function SettingsGeneral() {
  const [undetectable, setUndetectable] = useState(true)
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(95)
  const [meetingDetection, setMeetingDetection] = useState(true)

  useEffect(() => {
    window.api?.invoke('settings:get', 'overlayOpacity').then((v: number | null) => {
      if (v != null) setOverlayOpacity(v)
    }).catch(() => {})
    window.api?.invoke('settings:get', 'autoLaunch').then((v: boolean | null) => {
      if (v != null) setAutoLaunch(v)
    }).catch(() => {})
    window.api?.invoke('settings:get', 'meetingDetectionEnabled').then((v: boolean | null) => {
      if (v != null) setMeetingDetection(v)
    }).catch(() => {})
  }, [])

  const handleOpacityChange = (val: number) => {
    setOverlayOpacity(val)
    window.api?.invoke('settings:set', 'overlayOpacity', val).catch(() => {})
  }

  const handleAutoLaunch = (val: boolean) => {
    setAutoLaunch(val)
    window.api?.invoke('settings:set', 'autoLaunch', val).catch(() => {})
  }

  // MAJOR-3 fix: Undetectable toggle now persists via IPC
  const handleUndetectable = (val: boolean) => {
    setUndetectable(val)
    window.api?.send('set-content-protection', val)
  }

  const handleMeetingDetection = (val: boolean) => {
    setMeetingDetection(val)
    window.api?.invoke('settings:set', 'meetingDetectionEnabled', val).catch(() => {})
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold text-g-12 mb-2">General</h2>
      <p className="text-sm text-g-10 mb-6">Configure app behavior and appearance</p>

      {/* Undetectability */}
      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-g-5">
          <div>
            <div className="text-sm font-medium text-g-12">Undetectable Mode</div>
            <div className="text-xs text-g-8 mt-0.5">Hide overlay from screen sharing and recordings</div>
          </div>
          <button
            onClick={() => handleUndetectable(!undetectable)}
            className={`w-10 h-5 rounded-full transition-colors relative ${undetectable ? 'bg-blue-primary' : 'bg-g-5'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${undetectable ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Auto Launch */}
        <div className="flex items-center justify-between py-3 border-b border-g-5">
          <div>
            <div className="text-sm font-medium text-g-12">Launch at Startup</div>
            <div className="text-xs text-g-8 mt-0.5">Automatically start AskToto when your computer boots</div>
          </div>
          <button
            onClick={() => handleAutoLaunch(!autoLaunch)}
            className={`w-10 h-5 rounded-full transition-colors relative ${autoLaunch ? 'bg-blue-primary' : 'bg-g-5'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoLaunch ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Meeting Detection */}
        <div className="flex items-center justify-between py-3 border-b border-g-5">
          <div>
            <div className="text-sm font-medium text-g-12">Meeting Detection</div>
            <div className="text-xs text-g-8 mt-0.5">Automatically detect Zoom, Teams, Meet and offer to record</div>
          </div>
          <button
            onClick={() => handleMeetingDetection(!meetingDetection)}
            className={`w-10 h-5 rounded-full transition-colors relative ${meetingDetection ? 'bg-blue-primary' : 'bg-g-5'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${meetingDetection ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Overlay Opacity */}
        <div className="py-3 border-b border-g-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-g-12">Overlay Opacity</div>
              <div className="text-xs text-g-8 mt-0.5">Adjust the transparency of the overlay panel</div>
            </div>
            <span className="text-sm text-g-11 font-mono">{overlayOpacity}%</span>
          </div>
          <input
            type="range"
            min={30}
            max={100}
            value={overlayOpacity}
            onChange={e => handleOpacityChange(Number(e.target.value))}
            className="w-full accent-blue-primary"
          />
        </div>
      </div>
    </div>
  )
}
