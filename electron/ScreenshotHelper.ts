import { desktopCapturer, screen } from 'electron'
import { WindowHelper } from './WindowHelper'
import { ImageProcessor } from './services/ImageProcessor'
import logger from './services/Logger'

export interface ScreenshotResult {
  base64: string
  mimeType: string
  width: number
  height: number
}

/**
 * Captures screenshots with multi-display support, 1-second caching,
 * and JPEG compression via ImageProcessor.
 *
 * Improvements over v1:
 * - Multi-display: captures the display where the cursor is located
 * - 1-second cache: avoids duplicate captures in rapid-fire requests
 * - JPEG compression: ~60-80% smaller via Sharp (faster LLM processing)
 */
export class ScreenshotHelper {
  private windowHelper: WindowHelper | null = null
  private imageProcessor: ImageProcessor
  private cache: { result: ScreenshotResult; timestamp: number } | null = null
  private readonly CACHE_TTL_MS = 1000 // 1 second cache

  constructor(imageProcessor?: ImageProcessor) {
    this.imageProcessor = imageProcessor || new ImageProcessor()
  }

  setWindows(wh: WindowHelper) {
    this.windowHelper = wh
  }

  async captureScreen(): Promise<ScreenshotResult | null> {
    // Return cached result if fresh (within 1 second)
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL_MS) {
      logger.debug('Screenshot', 'Returning cached screenshot')
      return this.cache.result
    }

    try {
      // Multi-display: find the display where the cursor is
      const cursorPoint = screen.getCursorScreenPoint()
      const activeDisplay = screen.getDisplayNearestPoint(cursorPoint)
      const { width, height } = activeDisplay.size
      const scaleFactor = activeDisplay.scaleFactor

      // Capture at native resolution
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.floor(width * scaleFactor),
          height: Math.floor(height * scaleFactor),
        },
      })

      if (sources.length === 0) {
        logger.warn('Screenshot', 'No screen sources available')
        return null
      }

      // Find the source matching the active display, or fall back to first
      let source = sources[0]

      // desktopCapturer may return multiple sources for multi-display setups
      // Try to match by display ID in the source name/id
      if (sources.length > 1) {
        const displayId = String(activeDisplay.id)
        const matched = sources.find(
          (s) => s.display_id === displayId || s.id.includes(displayId)
        )
        if (matched) {
          source = matched
          logger.debug('Screenshot', `Matched display ${displayId} for cursor at (${cursorPoint.x}, ${cursorPoint.y})`)
        }
      }

      const thumbnail = source.thumbnail

      if (thumbnail.isEmpty()) {
        logger.warn('Screenshot', 'Captured empty thumbnail')
        return null
      }

      // Get raw PNG buffer from NativeImage
      const pngBuffer = thumbnail.toPNG()

      // Compress via ImageProcessor (Sharp: resize to 1536px max, JPEG 80%)
      const processed = await this.imageProcessor.processScreenshot(pngBuffer)

      const result: ScreenshotResult = {
        base64: processed.base64,
        mimeType: processed.mimeType,
        width,
        height,
      }

      // Cache the result
      this.cache = { result, timestamp: Date.now() }

      logger.debug('Screenshot', `Captured ${width}x${height} from display ${activeDisplay.id}`)
      return result
    } catch (err) {
      logger.error('Screenshot', 'Capture failed', err)
      return null
    }
  }

  /** Invalidate the cache (e.g. when display configuration changes) */
  invalidateCache(): void {
    this.cache = null
  }
}
