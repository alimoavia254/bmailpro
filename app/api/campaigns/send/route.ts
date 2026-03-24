import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createTransporter,
  sendEmail,
  injectTracking,
  injectUnsubscribeLink,
  generateUnsubscribeToken,
} from '@/lib/email'
import { decrypt } from '@/lib/encryption'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { campaignId, userId, includeFailed } = await request.json()

    if (!campaignId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

    if (!smtpEmail || !smtpPasswordRaw) {
      return NextResponse.json(
        { error: 'SMTP not configured. Please configure your Gmail settings in Settings.' },
        { status: 400 }
      )
    }

    // Decrypt the stored password
    const smtpPassword = decrypt(smtpPasswordRaw)

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
      return NextResponse.json({ error: 'No recipients available for sending' }, { status: 400 })
    }

    // ── Quota check (enough remaining quota for free users?) ───────────────
    if (profile.subscription_status !== 'active') {
      const today = new Date().toISOString().split('T')[0]
      const lastEmailDate = profile.last_email_date?.split?.('T')?.[0] ?? profile.last_email_date
      let dailyCount = profile.daily_emails_sent || 0
      if (lastEmailDate !== today) dailyCount = 0

      const remaining = freeDailyLimit - dailyCount
      if (recipients.length > remaining) {
        return NextResponse.json(
          {
            error: `You can only send ${remaining} more emails today (${recipients.length} recipients selected). Upgrade to send more.`,
            limitReached: true,
            whatsapp: settingsMap.whatsapp_number || '923254139900',
          },
          { status: 403 }
        )
      }
    }

    // ── Create real SMTP transporter ───────────────────────────────────────
    const transporter = createTransporter(smtpEmail, smtpPassword)

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_URL ||
      'http://localhost:3000'

    // Mark campaign as sending
    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId)

    let sentCount = 0
    let failedCount = 0

    // ── Send emails ────────────────────────────────────────────────────────
    for (const recipient of recipients) {
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
            })
            .eq('id', recipient.id)

          sentCount++
        } else {
          console.error(`Failed to send to ${recipientEmail}:`, result.error)
          await supabaseAdmin
            .from('campaign_contacts')
            .update({ status: 'failed' })
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

    // Close the connection pool
    transporter.close()

    // ── Update campaign stats ──────────────────────────────────────────────
    const newStatus = sentCount > 0 ? 'sent' : 'failed'
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: newStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        sent_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

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
      message: `Successfully sent ${sentCount} email${sentCount !== 1 ? 's' : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''
        }`,
    })
  } catch (error) {
    console.error('Campaign send error:', error)
    return NextResponse.json({ error: 'Failed to send campaign' }, { status: 500 })
  }
}
