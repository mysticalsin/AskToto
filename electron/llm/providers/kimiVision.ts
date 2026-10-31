/**
 * Moonshot/Kimi vision capability by model id.
 *
 * K2 (including kimi-k2-0905-preview, the app default) is text-only.
 * Sending image_url parts to those models makes Assist fail for Kimi-only installs,
 * because the overlay captures a screenshot by default.
 *
 * Vision-capable ids include explicit "-vision-" variants and the K3 / late-K2
 * multimodal series (kimi-k3*, kimi-k2.6+, kimi-k2.7*).
 */
export function kimiModelAcceptsImages(model: string): boolean {
  const m = (model || '').toLowerCase()
  if (!m) return false
  if (m.includes('vision')) return true
  if (m.startsWith('kimi-k3')) return true
  if (/^kimi-k2\.[6-9]/.test(m)) return true
  return false
}
