import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { triggerWebhooks } from '@/lib/webhooks'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TRACKING_PIXEL = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
  0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
  0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
  0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
  0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd3, 0xff, 0xd9,
])

const PIXEL_RESPONSE = new NextResponse(TRACKING_PIXEL, {
  headers: {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
})

/** Ignore pixel hits in the first moments after send (scanner prefetch). Keep low so Gmail opens still count. */
const MIN_OPEN_DELAY_MS = 2_500

const DELIVERED_STATUSES = new Set(['sent', 'opened', 'clicked'])

function isLikelyAutomatedOpen(request: NextRequest): boolean {
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase()
  const accept = (request.headers.get('accept') || '').toLowerCase()
  const purpose = (request.headers.get('purpose') || request.headers.get('x-purpose') || '').toLowerCase()
  const secPurpose = (request.headers.get('sec-purpose') || '').toLowerCase()

  // Gmail and other clients load tracking pixels as images; do not treat those as link prefetch.
  const looksLikeImageRequest = accept.includes('image')

  if (
    !looksLikeImageRequest &&
    (purpose.includes('prefetch') || secPurpose.includes('prefetch') || secPurpose.includes('prerender'))
  ) {
    return true
  }

  const scannerSignatures = [
    'proofpoint',
    'barracuda',
    'symantec',
    'mimecast',
    'trendmicro',
    'mailguard',
    'safelinks',
    'crawler',
    'spider',
    'bot/',
    'scanmail',
    'ironport',
    'message labs',
    'messagelabs',
  ]

  return scannerSignatures.some((sig) => userAgent.includes(sig))
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const trackingId = searchParams.get('tid')

  if (!trackingId) {
    return PIXEL_RESPONSE
  }

  try {
    const { data: row } = await supabaseAdmin
      .from('campaign_contacts')
      .select('id, campaign_id, variant_id, opened_at, sent_at, status, open_count')
      .eq('tracking_id', trackingId)
      .maybeSingle()

    if (!row) {
      return PIXEL_RESPONSE
    }

    if (isLikelyAutomatedOpen(request)) {
      return PIXEL_RESPONSE
    }

    // Only count opens after our server recorded a successful send (no "heal" — avoids false opens).
    if (!row.sent_at || !DELIVERED_STATUSES.has(row.status)) {
      return PIXEL_RESPONSE
    }

    const sentAtMs = new Date(row.sent_at).getTime()
    if (!Number.isFinite(sentAtMs) || Date.now() - sentAtMs < MIN_OPEN_DELAY_MS) {
      return PIXEL_RESPONSE
    }

    const prevOpenCount = typeof row.open_count === 'number' ? row.open_count : 0
    const nowIso = new Date().toISOString()
    const firstOpen = prevOpenCount === 0

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    await supabaseAdmin.from('tracking_events').insert({
      campaign_contact_id: row.id,
      event_type: 'open',
      ip_address: ipAddress,
      user_agent: request.headers.get('user-agent'),
    })

    await supabaseAdmin
      .from('campaign_contacts')
      .update({
        status: 'opened',
        open_count: prevOpenCount + 1,
        opened_at: row.opened_at ?? nowIso,
      })
      .eq('id', row.id)

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('opened_count, total_open_events, user_id')
      .eq('id', row.campaign_id)
      .maybeSingle()

    if (campaign) {
      const nextTotalOpens = (campaign.total_open_events ?? 0) + 1
      const nextUnique = firstOpen ? (campaign.opened_count ?? 0) + 1 : (campaign.opened_count ?? 0)

      await supabaseAdmin
        .from('campaigns')
        .update({
          opened_count: nextUnique,
          total_open_events: nextTotalOpens,
        })
        .eq('id', row.campaign_id)

      if (row.variant_id) {
        const { data: variant } = await supabaseAdmin
          .from('campaign_variants')
          .select('opened_count')
          .eq('id', row.variant_id)
          .maybeSingle()

        if (variant) {
          await supabaseAdmin
            .from('campaign_variants')
            .update({ opened_count: (variant.opened_count || 0) + 1 })
            .eq('id', row.variant_id)
        }
      }

      await triggerWebhooks(campaign.user_id, 'open', {
        campaign_id: row.campaign_id,
        tracking_id: trackingId,
        open_number: prevOpenCount + 1,
        ip_address: ipAddress,
        user_agent: request.headers.get('user-agent'),
      })
    }
  } catch (error) {
    console.error('Error logging open event:', error)
  }

  return PIXEL_RESPONSE
}
