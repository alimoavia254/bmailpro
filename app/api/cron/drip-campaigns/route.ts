import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id')
      .eq('status', 'sending')

    if (error) throw error
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No sending campaigns' })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

    if (!baseUrl) {
      return NextResponse.json({ error: 'Missing app URL for cron processing' }, { status: 500 })
    }

    const results = await Promise.all(
      campaigns.map(async (campaign) => {
        const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/campaigns/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            campaignId: campaign.id,
            userId: campaign.user_id,
            maxRecipients: 5,
          }),
        })
        const payload = await res.json().catch(() => ({}))
        return { campaignId: campaign.id, ok: res.ok, payload }
      })
    )

    return NextResponse.json({
      processed: campaigns.length,
      mode: 'smart-paced',
      results,
    })
  } catch (error: any) {
    console.error('Drip cron error:', error)
    return NextResponse.json({ error: error.message || 'cron_failed' }, { status: 500 })
  }
}

