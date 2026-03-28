import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Authorize campaign send: either Vercel cron (Bearer CRON_SECRET) or
 * a logged-in user whose id matches the requested userId.
 */
export async function assertCampaignSendAuthorized(
  request: NextRequest,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  if (user.id !== userId) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  return { ok: true }
}
