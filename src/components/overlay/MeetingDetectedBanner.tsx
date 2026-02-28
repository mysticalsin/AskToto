import { useEffect } from 'react'

const APP_LABELS: Record<string, string> = {
  zoom:  'Zoom Meeting',
  teams: 'Teams Call',
  meet:  'Google Meet',
  slack: 'Slack Huddle',
  webex: 'Webex Meeting',
  skype: 'Skype Call',
}

interface MeetingDetectedBannerProps {
  app: string
  windowTitle: string
  onAccept: () => void
  onDismiss: () => void
}

export default function MeetingDetectedBanner({
  app, windowTitle, onAccept, onDismiss
}: MeetingDetectedBannerProps) {
  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 30_000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const appLabel = APP_LABELS[app] || app

  return (
    <div className="overlay-panel animate-slide-down mb-2 px-3 py-2.5 flex items-center gap-3 w-[520px]">
      {/* Pulsing green dot */}
      <div className="w-2.5 h-2.5 rounded-full bg-accent-green animate-pulse-slow shrink-0" />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-g-12 truncate">
          {appLabel} detected
        </div>
        <div className="text-2xs text-g-8 truncate">{windowTitle}</div>
      </div>

      {/* Record button */}
      <button
        onClick={onAccept}
        className="btn-primary text-2xs px-3 py-1 shrink-0"
      >
        Record
      </button>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="w-6 h-6 rounded-full flex items-center justify-center text-g-8 hover:text-white hover:bg-[var(--surface-action-hover)] transition-colors cursor-pointer shrink-0"
        title="Dismiss"
        aria-label="Dismiss meeting detection"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
