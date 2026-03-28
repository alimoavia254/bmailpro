import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Transporter } from 'nodemailer'
import {
  createTransporter,
  createOAuthTransporter,
  sendEmail,
  injectTracking,
  injectUnsubscribeLink,
  generateUnsubscribeToken,
} from '@/lib/email'
import { refreshAccessToken } from '@/lib/google-oauth'
import { resolveStoredSecret } from '@/lib/encryption'
import { assertCampaignSendAuthorized } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Recompute campaign row from campaign_contacts (fixes drip idle + stuck "sending"). */
async function syncCampaignProgressFromContacts(campaignId: string): Promise<{
  pendingCount: number
  totalSentCount: number
  totalFailedCount: number
  newStatus: string
}> {
  const [{ count: pendingCountRaw }, { count: dbSentCountRaw }, { count: dbFailedCountRaw }] =
    await Promise.all([
      supabaseAdmin
        .from('campaign_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending'),
      supabaseAdmin
        .from('campaign_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .in('status', ['sent', 'opened', 'clicked']),
      supabaseAdmin
        .from('campaign_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed'),
    ])

  const pendingCount = pendingCountRaw ?? 0
  const totalSentCount = dbSentCountRaw ?? 0
  const totalFailedCount = dbFailedCountRaw ?? 0
  const newStatus =
    pendingCount > 0 ? 'sending' : totalSentCount > 0 ? 'sent' : totalFailedCount > 0 ? 'failed' : 'draft'

  const { error } = await supabaseAdmin
    .from('campaigns')
    .update({
      status: newStatus,
      sent_count: totalSentCount,
      failed_count: totalFailedCount,
    })
    .eq('id', campaignId)

  if (error) {
    console.error('syncCampaignProgressFromContacts:', error)
  }

  return { pendingCount, totalSentCount, totalFailedCount, newStatus }
}

/** Nodemailer + Gmail need the Node runtime (not Edge). */
export const runtime = 'nodejs'

/**
 * Vercel kills functions after ~10s by default on Hobby; SMTP often needs longer.
 * Plan caps still apply (e.g. Hobby max 60s unless upgraded).
 */
export const maxDuration = 300

function getAppBaseUrl(request: NextRequest): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

  if (explicit && !explicit.includes('localhost')) {
    return explicit.replace(/\/+$/, '')
  }

  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    process.env.VERCEL_URL

  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, '')
  }

  return 'http://localhost:3000'
}

export async function POST(request: NextRequest) {
  let campaignIdForRecovery: string | null = null
  let didMarkCampaignSending = false
  let transporter: Transporter | undefined

  try {
    let body: {
      campaignId?: string
      userId?: string
      includeFailed?: boolean
      maxRecipients?: unknown
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { campaignId, userId, includeFailed, maxRecipients } = body
    campaignIdForRecovery = campaignId ?? null
    const maxBatchSize =
      Number.isFinite(Number(maxRecipients)) && Number(maxRecipients) > 0
        ? Math.floor(Number(maxRecipients))
        : null

    if (!campaignId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const auth = await assertCampaignSendAuthorized(request, userId)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Get user profile with SMTP settings
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (profile.is_active === false) {
      return NextResponse.json(
        { error: 'Account is blocked by admin.' },
        { status: 403 }
      )
    }

    const { data: authUserData, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId)
    if (authUserError || !authUserData?.user?.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Please confirm your email before sending campaigns.' },
        { status: 403 }
      )
    }

    // ── Pick the active SMTP slot ──────────────────────────────────────────
    const activeSlot: 1 | 2 = profile.active_smtp === 2 ? 2 : 1
    const smtpEmail =
      activeSlot === 2
        ? profile.smtp_email_2
        : profile.smtp_email_1 || profile.smtp_email

    const smtpPasswordRaw =
      activeSlot === 2
        ? profile.smtp_password_2
        : profile.smtp_password_1 || profile.smtp_password

    // If no OAuth and no SMTP password, block sending
    const googleRefreshRaw =
      activeSlot === 2 ? profile.google_refresh_token_2 : profile.google_refresh_token_1
    if (!smtpEmail || (!googleRefreshRaw && !smtpPasswordRaw)) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail account or add an App Password in Settings.' },
        { status: 400 }
      )
    }

    // Get app settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')

    const settingsMap: Record<string, any> = {}
    settings?.forEach((s) => {
      try {
        settingsMap[s.key] = JSON.parse(s.value)
      } catch {
        settingsMap[s.key] = s.value
      }
    })

    const freeDailyLimit: number = settingsMap.free_email_limit ?? 5

    // ── Email limit check for free users ──────────────────────────────────
    if (profile.subscription_status !== 'active') {
      const today = new Date().toISOString().split('T')[0]
      const lastEmailDate = profile.last_email_date?.split?.('T')?.[0] ?? profile.last_email_date

      let dailyCount = profile.daily_emails_sent || 0
      if (lastEmailDate !== today) dailyCount = 0

      if (dailyCount >= freeDailyLimit) {
        return NextResponse.json(
          {
            error: `Daily limit reached. Free users can only send ${freeDailyLimit} emails per day. Contact us on WhatsApp to upgrade.`,
            limitReached: true,
            whatsapp: settingsMap.whatsapp_number || '923254139900',
          },
          { status: 403 }
        )
      }
    }

    // ── Fetch campaign ─────────────────────────────────────────────────────
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // ── Fetch recipients to send ───────────────────────────────────────────
    const statusesToSend = includeFailed ? ['pending', 'failed'] : ['pending']
    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from('campaign_contacts')
      .select('*, contacts!inner(email, name, is_unsubscribed)')
      .eq('campaign_id', campaignId)
      .in('status', statusesToSend)
      .eq('contacts.is_unsubscribed', false)

    if (recipientsError) {
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
    }

    if (!recipients || recipients.length === 0) {
      // Drip: next tick often has zero eligible rows while campaign is still "sending".
      // Without this, status never flips to "sent" and the UI stays stuck.
      if (campaign.status === 'sending') {
        const r = await syncCampaignProgressFromContacts(campaignId)
        return NextResponse.json({
          success: true,
          sent: 0,
          failed: 0,
          pending: r.pendingCount,
          batchSize: 0,
          mode: maxBatchSize ? 'drip' : 'bulk',
          reconciled: true,
          status: r.newStatus,
          message:
            r.newStatus === 'sent'
              ? 'All emails delivered.'
              : r.pendingCount > 0
                ? 'No eligible recipients in this batch (e.g. remaining may be unsubscribed).'
                : 'Campaign status synced.',
        })
      }
      return NextResponse.json({ error: 'No recipients available for sending' }, { status: 400 })
    }
    const recipientsToProcess = maxBatchSize ? recipients.slice(0, maxBatchSize) : recipients

    // ── Quota check (enough remaining quota for free users?) ───────────────
    if (profile.subscription_status !== 'active') {
      const today = new Date().toISOString().split('T')[0]
      const lastEmailDate = profile.last_email_date?.split?.('T')?.[0] ?? profile.last_email_date
      let dailyCount = profile.daily_emails_sent || 0
      if (lastEmailDate !== today) dailyCount = 0

      const remaining = freeDailyLimit - dailyCount
      if (recipientsToProcess.length > remaining) {
        return NextResponse.json(
          {
            error: `You can only send ${remaining} more emails today (${recipientsToProcess.length} recipients selected). Upgrade to send more.`,
            limitReached: true,
            whatsapp: settingsMap.whatsapp_number || '923254139900',
          },
          { status: 403 }
        )
      }
    }

    // ── Create transporter — OAuth2 if connected, else App Password ───────
    const googleRefreshToken =
      activeSlot === 2 ? profile.google_refresh_token_2 : profile.google_refresh_token_1
    const googleAccessToken =
      activeSlot === 2 ? profile.google_access_token_2 : profile.google_access_token_1
    const googleTokenExpiry =
      activeSlot === 2 ? profile.google_token_expiry_2 : profile.google_token_expiry_1

    if (googleRefreshToken && smtpEmail) {
      // OAuth2 flow — refresh token if expired
      let accessToken = googleAccessToken
      if (!accessToken || (googleTokenExpiry && new Date(googleTokenExpiry).getTime() < Date.now() + 60_000)) {
        try {
          const refreshed = await refreshAccessToken(
            googleRefreshToken,
            process.env.GOOGLE_CLIENT_ID!,
            process.env.GOOGLE_CLIENT_SECRET!
          )
          accessToken = refreshed.access_token
          // Update stored token
          await supabaseAdmin.from('profiles').update({
            [`google_access_token_${activeSlot}`]: refreshed.access_token,
            [`google_token_expiry_${activeSlot}`]: new Date(refreshed.expiry_date).toISOString(),
          }).eq('id', userId)
        } catch (err) {
          console.error('Token refresh failed:', err)
          return NextResponse.json(
            { error: 'Google OAuth token expired. Please reconnect your Gmail account in Settings.' },
            { status: 400 }
          )
        }
      }
      transporter = createOAuthTransporter(smtpEmail, accessToken!, googleRefreshToken)
    } else {
      // App Password flow
      let smtpPassword: string
      try {
        smtpPassword = resolveStoredSecret(smtpPasswordRaw, 'smtp_password')
      } catch {
        return NextResponse.json(
          { error: 'SMTP password could not be decrypted. Please re-save your SMTP App Password in Settings.' },
          { status: 400 }
        )
      }
      transporter = createTransporter(smtpEmail, smtpPassword)
    }

    const baseUrl = getAppBaseUrl(request)

    const closeTransport = () => {
      try {
        transporter?.close()
      } catch {
        /* ignore */
      }
    }

    // Mark campaign as sending.
    // Drip/cron batches arrive with maxBatchSize set and the campaign is already
    // 'sending' — that is intentional and must be allowed.
    // Double-click prevention is handled on the client (isSending guard).
    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId)
    didMarkCampaignSending = true

    let sentCount = 0
    let failedCount = 0

    // ── Send emails ────────────────────────────────────────────────────────
    for (const recipient of recipientsToProcess) {
      try {
        const trackingId = recipient.tracking_id || crypto.randomUUID()
        const recipientEmail = (recipient.email || recipient.contacts?.email) as string
        const recipientName = (recipient.contacts?.name || '') as string

        if (!recipientEmail) continue

        // Resolve the HTML body — support both 'body_html' and legacy 'body' column
        let emailBody: string = campaign.body_html || campaign.body || ''

        // Replace {{name}} / {{email}} placeholders (double-brace format as shown in UI)
        emailBody = emailBody.replace(/\{\{name\}\}/gi, recipientName || recipientEmail.split('@')[0])
        emailBody = emailBody.replace(/\{\{email\}\}/gi, recipientEmail)

        // Generate unsubscribe token and inject unsubscribe link + tracking
        const unsubToken = generateUnsubscribeToken(recipientEmail)
        emailBody = injectUnsubscribeLink(emailBody, recipientEmail, unsubToken, baseUrl)
        emailBody = injectTracking(emailBody, trackingId, baseUrl)

        const result = await sendEmail(
          transporter,
          recipientEmail,
          campaign.subject,
          emailBody,
          smtpEmail
        )

        if (result.success) {
          await supabaseAdmin
            .from('campaign_contacts')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              tracking_id: trackingId,
              email: recipientEmail,
            })
            .eq('id', recipient.id)

          sentCount++
        } else {
          console.error(`Failed to send to ${recipientEmail}:`, result.error)
          await supabaseAdmin
            .from('campaign_contacts')
            .update({ status: 'failed', email: recipientEmail })
            .eq('id', recipient.id)

          failedCount++

          // Stop immediately on auth errors — retrying won't help
          if (result.errorType === 'auth_error') {
            break
          }
        }
      } catch (emailError) {
        console.error(`Unexpected error sending to recipient:`, emailError)
        await supabaseAdmin
          .from('campaign_contacts')
          .update({ status: 'failed' })
          .eq('id', recipient.id)

        failedCount++
      }
    }

    closeTransport()

    // ── Update campaign stats (fresh DB counts — avoids stale-read race) ────
    const { pendingCount } = await syncCampaignProgressFromContacts(campaignId)

    // ── Update user email counts ───────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0]
    const lastEmailDate = profile.last_email_date?.split?.('T')?.[0] ?? profile.last_email_date
    const newDailyCount =
      (lastEmailDate === today ? profile.daily_emails_sent || 0 : 0) + sentCount

    await supabaseAdmin
      .from('profiles')
      .update({
        emails_sent_this_month: (profile.emails_sent_this_month || 0) + sentCount,
        total_emails_sent: (profile.total_emails_sent || 0) + sentCount,
        daily_emails_sent: newDailyCount,
        last_email_date: today,
      })
      .eq('id', userId)

    // ── Log activity ───────────────────────────────────────────────────────
    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      action: 'campaign_sent',
      details: {
        campaign_id: campaignId,
        campaign_name: campaign.name,
        sent: sentCount,
        failed: failedCount,
        smtp_slot: activeSlot,
      },
    })

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      pending: pendingCount,
      batchSize: recipientsToProcess.length,
      mode: maxBatchSize ? 'drip' : 'bulk',
      message: `Successfully sent ${sentCount} email${sentCount !== 1 ? 's' : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''
        }`,
    })
  } catch (error) {
    try {
      transporter?.close()
    } catch {
      /* ignore */
    }
    console.error('Campaign send error:', error)
    // If we already switched campaign to "sending", never leave it stuck there.
    if (campaignIdForRecovery && didMarkCampaignSending) {
      try {
        await syncCampaignProgressFromContacts(campaignIdForRecovery)
      } catch (reconcileErr) {
        console.error('Post-error reconcile failed:', reconcileErr)
        await supabaseAdmin
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignIdForRecovery)
          .eq('status', 'sending')
      }
    }
    return NextResponse.json({ error: 'Failed to send campaign' }, { status: 500 })
  }
}
