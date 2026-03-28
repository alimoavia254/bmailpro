import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { triggerWebhooks } from '@/lib/webhooks'
import { getSafeRedirectUrl } from '@/lib/safe-redirect-url'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const trackingId = searchParams.get('tid') // Bug #3 fixed: was 'id', now 'tid'
  const urlRaw = searchParams.get('url')
  const safeUrl = urlRaw ? getSafeRedirectUrl(urlRaw) : null

  if (!trackingId || !urlRaw) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  if (!safeUrl) {
    return NextResponse.json({ error: 'Invalid redirect URL' }, { status: 400 })
  }

  try {
    // Get campaign contact by tracking ID (include clicked_at for idempotency)
    const { data: campaignContact } = await supabaseAdmin
      .from('campaign_contacts')
      .select('id, variant_id, campaign_id, clicked_at')
      .eq('tracking_id', trackingId)
      .single()

    if (campaignContact) {
      // Resolve IP address — request.ip is deprecated in Next.js 15
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null

      const isFirstClick = !campaignContact.clicked_at

      // Always log the raw click event (every click is tracked for analytics)
      await supabaseAdmin.from('tracking_events').insert({
        campaign_contact_id: campaignContact.id,
        event_type: 'click',
        ip_address: ipAddress,
        user_agent: request.headers.get('user-agent'),
        link_url: safeUrl,
      })

      if (isFirstClick) {
        // Only update status + increment counters for the FIRST click per recipient
        await supabaseAdmin
          .from('campaign_contacts')
          .update({
            status: 'clicked',
            clicked_at: new Date().toISOString(),
          })
          .eq('id', campaignContact.id)

        const { data: campaign } = await supabaseAdmin
          .from('campaigns')
          .select('clicked_count, user_id')
          .eq('id', campaignContact.campaign_id)
          .single()

        if (campaign) {
          await supabaseAdmin
            .from('campaigns')
            .update({ clicked_count: (campaign.clicked_count || 0) + 1 })
            .eq('id', campaignContact.campaign_id)

          // Update variant stats if A/B test
          if (campaignContact.variant_id) {
            const { data: variant } = await supabaseAdmin
              .from('campaign_variants')
              .select('clicked_count')
              .eq('id', campaignContact.variant_id)
              .single()

            if (variant) {
              await supabaseAdmin
                .from('campaign_variants')
                .update({ clicked_count: (variant.clicked_count || 0) + 1 })
                .eq('id', campaignContact.variant_id)
            }
          }

          // Trigger Webhooks
          await triggerWebhooks(campaign.user_id, 'click', {
            campaign_id: campaignContact.campaign_id,
            tracking_id: trackingId,
            url: safeUrl,
            ip_address: ipAddress,
            user_agent: request.headers.get('user-agent')
          })
        }
      }
    }

    // Redirect to the original URL (http/https only)
    return NextResponse.redirect(safeUrl, 302)
  } catch (error) {
    console.error('Error logging click event:', error)
    return NextResponse.redirect(safeUrl, 302)
  }
}
