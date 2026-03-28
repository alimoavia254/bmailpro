export type DeliverySpeedMode = 'safe' | 'balanced' | 'fast'

export const DELIVERY_SPEED_KEY = 'bmail:delivery-speed'

export const DELIVERY_SPEED_PRESETS: Record<
  DeliverySpeedMode,
  { label: string; batchSize: number; intervalMs: number; approxPerMinute: number }
> = {
  safe: { label: 'Safe', batchSize: 5, intervalMs: 60_000, approxPerMinute: 5 },
  balanced: { label: 'Balanced', batchSize: 5, intervalMs: 30_000, approxPerMinute: 10 },
  fast: { label: 'Fast', batchSize: 10, intervalMs: 30_000, approxPerMinute: 20 },
}

export function normalizeDeliveryMode(value: string | null | undefined): DeliverySpeedMode {
  if (value === 'safe' || value === 'balanced' || value === 'fast') return value
  return 'balanced'
}

export function getDeliveryPresetFromStorage(): {
  mode: DeliverySpeedMode
  batchSize: number
  intervalMs: number
  approxPerMinute: number
  label: string
} {
  if (typeof window === 'undefined') {
    const p = DELIVERY_SPEED_PRESETS.balanced
    return { mode: 'balanced', ...p }
  }
  const mode = normalizeDeliveryMode(localStorage.getItem(DELIVERY_SPEED_KEY))
  return { mode, ...DELIVERY_SPEED_PRESETS[mode] }
}

