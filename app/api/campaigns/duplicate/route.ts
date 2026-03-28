import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { campaignId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { campaignId } = body
    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaign id' }, { status: 400 })
    }

    const { data: sourceCampaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !sourceCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const { data: sourceContacts, error: contactsError } = await supabaseAdmin
      .from('campaign_contacts')
      .select('contact_id')
      .eq('campaign_id', campaignId)

    if (contactsError) {
      return NextResponse.json({ error: 'Failed to load campaign contacts' }, { status: 500 })
    }

    const duplicatedName = `${sourceCampaign.name} (Copy)`
    const recipientsCount = sourceContacts?.length || 0

    const { data: newCampaign, error: insertError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        user_id: user.id,
        name: duplicatedName,
        subject: sourceCampaign.subject,
        body_html: sourceCampaign.body_html || sourceCampaign.body || '',
        is_ab_test: sourceCampaign.is_ab_test || false,
        status: 'draft',
        total_recipients: recipientsCount,
        sent_count: 0,
        opened_count: 0,
        clicked_count: 0,
        failed_count: 0,
      })
      .select('id, name')
      .single()

    if (insertError || !newCampaign) {
      return NextResponse.json({ error: 'Failed to duplicate campaign' }, { status: 500 })
    }

    if (recipientsCount > 0) {
      const rows = (sourceContacts || []).map((c) => ({
        campaign_id: newCampaign.id,
        contact_id: c.contact_id,
        status: 'pending',
        tracking_id: crypto.randomUUID(),
      }))

      const { error: linkError } = await supabaseAdmin
        .from('campaign_contacts')
        .insert(rows)

      if (linkError) {
        await supabaseAdmin.from('campaigns').delete().eq('id', newCampaign.id)
        return NextResponse.json({ error: 'Failed to duplicate recipients' }, { status: 500 })
      }
    }

    if (sourceCampaign.is_ab_test) {
      const { data: variants } = await supabaseAdmin
        .from('campaign_variants')
        .select('name, subject, body_html')
        .eq('campaign_id', campaignId)

      if (variants && variants.length > 0) {
        const variantRows = variants.map((v) => ({
          campaign_id: newCampaign.id,
          name: v.name,
          subject: v.subject,
          body_html: v.body_html,
        }))
        await supabaseAdmin.from('campaign_variants').insert(variantRows)
      }
    }

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'campaign_duplicated',
      details: {
        source_campaign_id: campaignId,
        new_campaign_id: newCampaign.id,
        recipients: recipientsCount,
      },
    })

    return NextResponse.json({
      success: true,
      campaignId: newCampaign.id,
      message: 'Campaign duplicated successfully. You can send it again.',
    })
  } catch (error) {
    console.error('Campaign duplicate error:', error)
    return NextResponse.json({ error: 'Failed to duplicate campaign' }, { status: 500 })
  }
}

