// app/api/campaigns/enqueue/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getCampaignQueue } from '@/lib/queue'

const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const supabaseAuth = await createClient()
        const {
            data: { user },
        } = await supabaseAuth.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let body: { campaignId?: string; userId?: string }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const { campaignId, userId } = body

        if (!campaignId || !userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (user.id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // 1. Get Recipients (skip unsubscribed)
        const { data: recipients, error: recipientsError } = await supabaseAdmin
            .from('campaign_contacts')
            .select('*, contacts!inner(is_unsubscribed)')
            .eq('campaign_id', campaignId)
            .eq('status', 'pending')
            .eq('contacts.is_unsubscribed', false)

        if (recipientsError) {
            return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
        }

        if (!recipients || recipients.length === 0) {
            return NextResponse.json({ error: 'No pending recipients to send to' }, { status: 400 })
        }

        // 2. Mark Campaign as Sending
        await supabaseAdmin
            .from('campaigns')
            .update({ status: 'sending', started_at: new Date().toISOString() })
            .eq('id', campaignId)

        // 3. Add Jobs to Queue
        const jobs = recipients.map((r) => ({
            name: `send-${campaignId}-${r.id}`,
            data: {
                campaignId,
                userId,
                recipientId: r.id,
            },
        }))

        await getCampaignQueue().addBulk(jobs)

        return NextResponse.json({
            success: true,
            enqueued: recipients.length,
            message: `Enqueued ${recipients.length} emails for sending.`,
        })
    } catch (error) {
        console.error('Enqueue error:', error)
        return NextResponse.json({ error: 'Failed to enqueue campaign' }, { status: 500 })
    }
}
