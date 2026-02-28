import sharp from 'sharp'
import logger from './Logger'

/**
 * Processes screenshots for LLM consumption.
 * Resizes to max 1536px and compresses to JPEG 80% quality.
 * Reduces payload by ~60-80% compared to raw PNG at 1920px.
 */
export class ImageProcessor {
  private readonly maxWidth = 1536
  private readonly jpegQuality = 80

  async processScreenshot(pngBuffer: Buffer): Promise<{ base64: string; mimeType: string }> {
    try {
      const processed = await sharp(pngBuffer)
        .resize(this.maxWidth, null, {
          withoutEnlargement: true,
          fit: 'inside',
        })
        .jpeg({ quality: this.jpegQuality })
        .toBuffer()

      const originalSize = pngBuffer.length
      const newSize = processed.length
      const savings = Math.round((1 - newSize / originalSize) * 100)
      logger.debug('ImageProcessor', `Compressed screenshot: ${(originalSize / 1024).toFixed(0)}KB -> ${(newSize / 1024).toFixed(0)}KB (${savings}% reduction)`)

      return {
        base64: processed.toString('base64'),
        mimeType: 'image/jpeg',
      }
    } catch (err) {
      logger.warn('ImageProcessor', 'Sharp compression failed, falling back to raw PNG', err)
      return {
        base64: pngBuffer.toString('base64'),
        mimeType: 'image/png',
      }
    }
  }
}
