import Store from 'electron-store'
import { EventEmitter } from 'events'
import { machineIdSync } from 'node-machine-id'
import type { ProviderName } from '../llm/types'
import logger from './Logger'

const defaultModels: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  kimi: 'kimi-k2-0905-preview',
}

interface SettingsSchema {
  openaiKey: string
  anthropicKey: string
  geminiKey: string
  kimiKey: string
  activeProvider: ProviderName
  activeModel: string
  sttMode: 'cloud' | 'local'
  overlayOpacity: number
  localWhisperPort: number
  autoLaunch: boolean
  transcriptionLanguage: string
  responseLanguage: string
  meetingDetectionEnabled: boolean
  [key: string]: any
}

type SettingsKey = keyof SettingsSchema
type ChangeCallback<K extends SettingsKey = SettingsKey> = (
  newValue: SettingsSchema[K],
  oldValue: SettingsSchema[K]
) => void

/**
 * Settings manager with EventEmitter for reactive updates.
 * Emits 'change' events when any setting is modified.
 * Emits 'change:<key>' events for specific setting changes.
 * Uses machine ID for encryption key derivation.
 */
export class SettingsManager extends EventEmitter {
  private store: Store<SettingsSchema>
  private changeListeners: Map<string, Set<ChangeCallback>> = new Map()

  constructor() {
    super()

    // Derive encryption key from machine ID for better security
    let encryptionKey: string
    try {
      const machineId = machineIdSync(true)
      encryptionKey = `asktoto-${machineId.slice(0, 32)}`
    } catch {
      logger.warn('Settings', 'Could not derive machine ID, using fallback encryption key')
      encryptionKey = 'asktoto-settings-v1'
    }

    this.store = new Store<SettingsSchema>({
      name: 'settings',
      defaults: {
        openaiKey: '',
        anthropicKey: '',
        geminiKey: '',
        kimiKey: '',
        activeProvider: 'openai',
        activeModel: 'gpt-4o',
        sttMode: 'cloud',
        overlayOpacity: 88,
        localWhisperPort: 8765,
        autoLaunch: false,
        transcriptionLanguage: 'auto',
        responseLanguage: 'auto',
        meetingDetectionEnabled: true,
      },
      encryptionKey,
    })

    logger.info('Settings', `Loaded settings from ${this.store.path}`)
  }

  get<K extends SettingsKey>(key: K, defaultValue?: SettingsSchema[K]): SettingsSchema[K] {
    return this.store.get(key, defaultValue as any)
  }

  set<K extends SettingsKey>(key: K, value: SettingsSchema[K]): void {
    const oldValue = this.store.get(key)

    // Skip if value hasn't actually changed
    if (JSON.stringify(oldValue) === JSON.stringify(value)) return

    this.store.set(key, value)

    // Emit generic change event
    this.emit('change', key, value, oldValue)

    // Emit key-specific change event
    this.emit(`change:${String(key)}`, value, oldValue)

    // Notify registered onChange callbacks
    const listeners = this.changeListeners.get(String(key))
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(value, oldValue)
        } catch (err) {
          logger.error('Settings', `onChange callback failed for ${String(key)}`, err)
        }
      }
    }

    logger.debug('Settings', `Updated ${String(key)}`)
  }

  getAll(): SettingsSchema {
    return this.store.store
  }

  setAll(data: Partial<SettingsSchema>): void {
    for (const [key, value] of Object.entries(data)) {
      this.set(key as SettingsKey, value as any)
    }
  }

  getModelForProvider(provider: ProviderName): string {
    if (provider === this.get('activeProvider')) {
      return this.get('activeModel', defaultModels[provider])
    }
    return defaultModels[provider] || ''
  }

  /**
   * Register a callback for when a specific setting changes.
   * Returns an unsubscribe function.
   */
  onChange<K extends SettingsKey>(key: K, callback: ChangeCallback<K>): () => void {
    const keyStr = String(key)
    if (!this.changeListeners.has(keyStr)) {
      this.changeListeners.set(keyStr, new Set())
    }
    this.changeListeners.get(keyStr)!.add(callback as ChangeCallback)

    // Return unsubscribe function
    return () => {
      const listeners = this.changeListeners.get(keyStr)
      if (listeners) {
        listeners.delete(callback as ChangeCallback)
        if (listeners.size === 0) {
          this.changeListeners.delete(keyStr)
        }
      }
    }
  }

  /**
   * Validate a setting value before storing.
   * Returns true if valid, or an error string.
   */
  validate(key: SettingsKey, value: any): true | string {
    switch (key) {
      case 'overlayOpacity':
        if (typeof value !== 'number' || value < 10 || value > 100) {
          return 'Opacity must be a number between 10 and 100'
        }
        break

      case 'localWhisperPort':
        if (typeof value !== 'number' || value < 1024 || value > 65535) {
          return 'Port must be between 1024 and 65535'
        }
        break

      case 'activeProvider':
        if (!['openai', 'anthropic', 'gemini', 'kimi'].includes(value)) {
          return 'Invalid provider name'
        }
        break

      case 'sttMode':
        if (!['cloud', 'local'].includes(value)) {
          return 'STT mode must be "cloud" or "local"'
        }
        break

      case 'transcriptionLanguage':
      case 'responseLanguage':
        if (typeof value !== 'string' || value.length < 2 || value.length > 5) {
          return 'Language code must be 2-5 characters'
        }
        break
    }

    return true
  }

  /**
   * Set with validation. Returns true if set, or error string.
   */
  setValidated<K extends SettingsKey>(key: K, value: SettingsSchema[K]): true | string {
    const result = this.validate(key, value)
    if (result !== true) {
      logger.warn('Settings', `Validation failed for ${String(key)}: ${result}`)
      return result
    }
    this.set(key, value)
    return true
  }
}
