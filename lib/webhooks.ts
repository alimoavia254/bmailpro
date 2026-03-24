// lib/webhooks.ts
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function triggerWebhooks(userId: string, eventType: string, payload: any) {
    const { data: webhooks } = await supabaseAdmin
        .from('webhooks')
        .select('url, event_types')
        .eq('user_id', userId)
        .eq('is_active', true)

    if (!webhooks) return

    const relevantWebhooks = webhooks.filter(w => w.event_types.includes(eventType))

    await Promise.all(
        relevantWebhooks.map(async (w) => {
            try {
                await fetch(w.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: eventType,
                        timestamp: new Date().toISOString(),
                        data: payload
                    })
                })
            } catch (err) {
                console.error(`Webhook error for ${w.url}:`, err)
            }
        })
    )
}
