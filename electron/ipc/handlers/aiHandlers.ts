import { IpcMain } from 'electron'
import { WindowHelper } from '../../WindowHelper'
import { LLMHelper } from '../../llm/LLMHelper'
import { ScreenshotHelper } from '../../ScreenshotHelper'
import { Database } from '../../db/database'
import { SettingsManager } from '../../services/SettingsManager'
import { AudioManager } from '../../audio/AudioManager'
import { MeetingSession } from '../../services/MeetingSession'
import logger from '../../services/Logger'
import type { ProviderName } from '../../llm/types'

interface AIDependencies {
  windowHelper: WindowHelper
  llmHelper: LLMHelper
  screenshotHelper: ScreenshotHelper
  database: Database
  settingsManager: SettingsManager
  audioManager: AudioManager
  meetingSession: MeetingSession
}

export function registerAIHandlers(ipcMain: IpcMain, deps: AIDependencies) {
  const { windowHelper, llmHelper, screenshotHelper, database, settingsManager, audioManager, meetingSession } = deps

  ipcMain.handle('trigger-ai', async (_event, opts: {
    transcript?: string
    provider?: string
    query?: string
    useScreen?: boolean       // CRITICAL-2 fix: respect useScreen toggle
    activeMode?: string       // CRITICAL-4 fix: pass mode to LLM
  }) => {
    const overlayWindow = windowHelper.getOverlayWindow()
    if (!overlayWindow) throw new Error('Overlay window not available')

    try {
      // CRITICAL-2 fix: Only capture screenshot if useScreen is true (default true)
      let screenshot: { base64: string } | null = null
      if (opts.useScreen !== false) {
        screenshot = await screenshotHelper.captureScreen()
      }

      const provider = (opts.provider || settingsManager.get('activeProvider', 'openai')) as ProviderName
      const model = settingsManager.getModelForProvider(provider)
      let fullResponse = ''

      // Resolve response language: 'auto' means match transcription language
      let responseLanguage = settingsManager.get('responseLanguage', 'auto')
      if (responseLanguage === 'auto') {
        const transcriptionLang = settingsManager.get('transcriptionLanguage', 'auto')
        // If transcription is also auto-detect, tell LLM to match conversation language
        responseLanguage = transcriptionLang === 'auto' ? 'auto' : transcriptionLang
      }

      logger.info('AI', `Triggering AI with provider=${provider} model=${model} mode=${opts.activeMode || 'default'} responseLang=${responseLanguage} hasScreenshot=${!!screenshot} hasTranscript=${!!opts.transcript} hasQuery=${!!opts.query}`)

      await llmHelper.streamChat(
        {
          transcript: opts.transcript || audioManager.getTranscript(),
          query: opts.query,
          screenshot: screenshot?.base64,
          provider,
          model,
          activeMode: opts.activeMode,  // CRITICAL-4 fix: pass mode through
          responseLanguage,             // Wire response language to LLM
        },
        {
          onChunk: (chunk) => windowHelper.sendToOverlay('llm:chunk', chunk),
          onComplete: (response) => {
            fullResponse = response
            windowHelper.sendToOverlay('llm:complete', response)

            if (meetingSession.isActive) {
              try {
                database.addAIResponse(meetingSession.id!, response, {
                  query: opts.query, provider, model,
                })
              } catch (err) {
                logger.error('AI', 'Failed to save AI response', err)
              }
            }
          },
          onError: (error) => {
            logger.error('AI', 'LLM streaming error', new Error(error))
            windowHelper.sendToOverlay('llm:error', error)
          }
        }
      )

      return fullResponse
    } catch (err: any) {
      const msg = err?.message || 'AI request failed'
      logger.error('AI', 'Trigger AI failed', err)
      windowHelper.sendToOverlay('llm:error', msg)
      throw err
    }
  })

  ipcMain.handle('test-llm-connection', async (_event, data: any) => {
    try {
      const provider = (data?.activeProvider || settingsManager.get('activeProvider', 'openai')) as ProviderName
      if (data?.openaiKey) settingsManager.set('openaiKey', data.openaiKey)
      if (data?.anthropicKey) settingsManager.set('anthropicKey', data.anthropicKey)
      if (data?.geminiKey) settingsManager.set('geminiKey', data.geminiKey)
      if (data?.kimiKey) settingsManager.set('kimiKey', data.kimiKey)

      logger.info('AI', `Testing LLM connection for ${provider}`)
      return await llmHelper.testConnection(provider)
    } catch (err) {
      logger.error('AI', 'LLM connection test failed', err)
      return false
    }
  })

  ipcMain.handle('llm:test', async (_event, provider: string) => {
    try {
      return await llmHelper.testConnection(provider as ProviderName)
    } catch (err) {
      logger.error('AI', `LLM test failed for ${provider}`, err)
      return false
    }
  })
}
