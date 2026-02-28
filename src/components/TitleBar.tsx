import React from 'react'

interface TitleBarProps {
  title?: string
  onClose?: () => void
  showMaximize?: boolean
  children?: React.ReactNode
}

/**
 * Custom title bar for frameless Electron windows.
 * Uses -webkit-app-region: drag via inline styles for native drag support.
 * Provides custom window control buttons (minimize, maximize, close).
 */
export default function TitleBar({ title, onClose, showMaximize = true, children }: TitleBarProps) {
  return (
    <div
      className="shrink-0 h-9 flex items-center justify-between px-3 select-none cursor-default bg-g-2/80 border-b border-g-5/50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: title + children */}
      <div className="flex items-center gap-2">
        {title && <span className="text-xs text-g-8 font-medium">{title}</span>}
        {children}
      </div>

      {/* Right: window controls */}
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={() => window.api?.send('window:minimize')}
          className="w-11 h-9 flex items-center justify-center text-g-8 hover:bg-g-5/60 hover:text-g-12 transition-colors"
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>

        {/* Maximize */}
        {showMaximize && (
          <button
            onClick={() => window.api?.send('window:maximize')}
            className="w-11 h-9 flex items-center justify-center text-g-8 hover:bg-g-5/60 hover:text-g-12 transition-colors"
            aria-label="Maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          </button>
        )}

        {/* Close */}
        <button
          onClick={onClose || (() => window.api?.send('window:close'))}
          className="w-11 h-9 flex items-center justify-center text-g-8 hover:bg-accent-red hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
