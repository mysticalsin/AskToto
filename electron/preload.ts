import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  send: (channel: string, ...args: any[]) => {
    const validChannels = [
      'set-mouse-passthrough',
      'open-settings',
      'open-dashboard',
      'close-settings',
      // Window controls
      'window:minimize',
      'window:maximize',
      'window:close',
      // Audio
      'audio-chunk',
      // Content protection
      'set-content-protection',
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },

  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'trigger-ai',
      'toggle-recording',
      'take-screenshot',
      'get-settings',
      'save-settings',
      'test-llm-connection',
      'finish-onboarding',
      // Settings
      'settings:get',
      'settings:set',
      // LLM
      'llm:test',
      // Meetings
      'meetings:list',
      'meetings:transcripts',
      'meetings:responses',
      'start-meeting',
      'end-meeting',
      // Audio
      'get-audio-devices',
      // App control
      'app:quit',
      // Meeting detection
      'meeting-detection:accept',
      'meeting-detection:dismiss',
    ]
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`))
  },

  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = [
      'transcript-update',
      'llm:chunk',
      'llm:complete',
      'llm:error',
      'recording-status',
      'trigger-ai-shortcut',
      'toggle-recording-shortcut',
      'scroll-response',
      'move-overlay',
      'start-audio-capture',
      'stop-audio-capture',
      // Meeting detection
      'meeting-detected',
      'meeting-ended',
    ]
    if (validChannels.includes(channel)) {
      const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
    return () => {}
  }
})
