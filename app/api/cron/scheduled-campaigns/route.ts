// app/api/cron/scheduled-campaigns/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
    // 1. Verify Cron Secret (Security)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        // 2. Find campaigns that are scheduled and past due
        const now = new Date().toISOString()
        const { data: campaigns, error } = await supabaseAdmin
            .from('campaigns')
            .select('id, user_id')
            .eq('status', 'scheduled')
            .lte('scheduled_at', now)

        if (error) throw error

        if (!campaigns || campaigns.length === 0) {
            return NextResponse.json({ message: 'No campaigns to process' })
        }

        // 3. Start each scheduled campaign in smart paced mode (not blast).
        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXT_PUBLIC_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
            'http://localhost:3000'

        const results = await Promise.all(
            campaigns.map(async (c) => {
                const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/campaigns/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${process.env.CRON_SECRET}`,
                    },
                    body: JSON.stringify({
                      campaignId: c.id,
                      userId: c.user_id,
                      maxRecipients: 5
                    })
                })
                return { id: c.id, status: res.status }
            })
        )

        return NextResponse.json({ processed: campaigns.length, results })

    } catch (error: any) {
        console.error('Cron Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
