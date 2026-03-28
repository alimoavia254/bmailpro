/**
 * Validates redirect targets for tracking links to prevent open redirects
 * via javascript:, data:, etc.
 */
export function getSafeRedirectUrl(raw: string): string | null {
  if (!raw || raw.length > 8192) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.href
  } catch {
    return null
  }
}
