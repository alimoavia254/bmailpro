import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { triggerWebhooks } from '@/lib/webhooks'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const trackingId = searchParams.get('tid') // Bug #3 fixed: was 'id', now 'tid'
  const url = searchParams.get('url')

  if (!trackingId || !url) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  try {
    // Get campaign contact by tracking ID
    const { data: campaignContact } = await supabaseAdmin
      .from('campaign_contacts')
      .select('id, variant_id')
      .eq('tracking_id', trackingId)
      .single()

    if (campaignContact) {
      // Resolve IP address — request.ip is deprecated in Next.js 15
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
        request.headers.get('x-real-ip') ??
        null

      // Log click event
      await supabaseAdmin.from('tracking_events').insert({
        campaign_contact_id: campaignContact.id,
        event_type: 'click',
        ip_address: ipAddress,
        user_agent: request.headers.get('user-agent'),
        link_url: url,
      })

      // Update campaign contact status
      await supabaseAdmin
        .from('campaign_contacts')
        .update({
          status: 'clicked',
          clicked_at: new Date().toISOString(),
        })
        .eq('id', campaignContact.id)

      // Get the campaign and update click count
      const { data: contactData } = await supabaseAdmin
        .from('campaign_contacts')
        .select('campaign_id')
        .eq('id', campaignContact.id)
        .single()

      if (contactData) {
        // Increment click count
        const { data: campaign } = await supabaseAdmin
          .from('campaigns')
          .select('clicked_count, user_id')
          .eq('id', contactData.campaign_id)
          .single()

        if (campaign) {
          await supabaseAdmin
            .from('campaigns')
            .update({ clicked_count: (campaign.clicked_count || 0) + 1 })
            .eq('id', contactData.campaign_id)

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
            campaign_id: contactData.campaign_id,
            tracking_id: trackingId,
            url: url,
            ip_address: ipAddress,
            user_agent: request.headers.get('user-agent')
          })
        }
      }
    }

    // Redirect to the original URL
    return NextResponse.redirect(url, 302)
  } catch (error) {
    console.error('Error logging click event:', error)
    // Still redirect on error
    return NextResponse.redirect(url, 302)
  }
}
