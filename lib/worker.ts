// lib/worker.ts
import { Worker, Job } from 'bullmq'
import { connection, CampaignJobData } from './queue'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createTransporter, sendEmail, injectTracking, injectUnsubscribeLink, generateUnsubscribeToken } from './email'
import { decrypt } from './encryption'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import * as Sentry from "@sentry/nextjs";

const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 s'), // 5 emails per second max
})

const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const worker = new Worker<CampaignJobData>(
    'campaign-send',
    async (job: Job<CampaignJobData>) => {
        const { campaignId, userId, recipientId } = job.data

        // Rate limiting check
        const { success } = await ratelimit.limit(`user:${userId}`)
        if (!success) {
            // Re-queue the job with a delay if rate limited
            await job.moveToDelayed(Date.now() + 2000)
            throw new Error('Rate limit exceeded, job delayed')
        }

        try {
            // 1. Get User Profile & Campaign Data
            const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single()
            const { data: campaign } = await supabaseAdmin.from('campaigns').select('*').eq('id', campaignId).single()
            const { data: recipient } = await supabaseAdmin.from('campaign_contacts').select('*, contacts(*)').eq('id', recipientId).single()

            if (!profile || !campaign || !recipient) {
                throw new Error('Missing data for job')
            }

            // 2. SMTP Setup
            const activeSlot = profile.active_smtp === 2 ? 2 : 1
            const smtpEmail = activeSlot === 2 ? profile.smtp_email_2 : profile.smtp_email_1 || profile.smtp_email
            const smtpPasswordRaw = activeSlot === 2 ? profile.smtp_password_2 : profile.smtp_password_1 || profile.smtp_password
            if (!smtpEmail || !smtpPasswordRaw) throw new Error('SMTP not configured')

            const smtpPassword = decrypt(smtpPasswordRaw)
            const transporter = createTransporter(smtpEmail, smtpPassword)

            // 3. Prepare Email Body & Subject
            let subject = campaign.subject
            let emailBody = campaign.body_html || ''
            let variantId = null

            if (campaign.is_ab_test) {
                const { data: variants } = await supabaseAdmin
                    .from('campaign_variants')
                    .select('*')
                    .eq('campaign_id', campaignId)
                    .order('created_at', { ascending: true })

                if (variants && variants.length > 0) {
                    // Simple rotation: Variant A for even jobs, Variant B for odd
                    // In a real scenario, we'd use a more robust split (e.g., hash-based or counter-based)
                    const variantIndex = parseInt(job.id || '0') % variants.length
                    const variant = variants[variantIndex]
                    subject = variant.subject
                    emailBody = variant.body_html
                    variantId = variant.id

                    // Increment variant sent count
                    await supabaseAdmin
                        .from('campaign_variants')
                        .update({ sent_count: (variant.sent_count || 0) + 1 })
                        .eq('id', variantId)
                }
            }
            const recipientEmail = recipient.contacts.email
            const recipientName = recipient.contacts.name || recipientEmail.split('@')[0]
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

            emailBody = emailBody.replace(/\{\{name\}\}/gi, recipientName)
            emailBody = emailBody.replace(/\{\{email\}\}/gi, recipientEmail)

            const unsubToken = generateUnsubscribeToken(recipientEmail)
            emailBody = injectUnsubscribeLink(emailBody, recipientEmail, unsubToken, baseUrl)
            emailBody = injectTracking(emailBody, recipient.tracking_id, baseUrl)

            // 4. Send Email
            const result = await sendEmail(transporter, recipientEmail, subject, emailBody, smtpEmail)

            // 5. Update Status
            if (result.success) {
                await supabaseAdmin.from('campaign_contacts').update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    variant_id: variantId
                }).eq('id', recipientId)
            } else {
                await supabaseAdmin.from('campaign_contacts').update({ status: 'failed' }).eq('id', recipientId)
                throw new Error(result.error)
            }

            // 6. Throttling (300ms delay as requested)
            await new Promise(resolve => setTimeout(resolve, 300))

        } catch (error) {
            console.error(`Job ${job.id} failed:`, error)
            Sentry.captureException(error, {
                extra: { jobId: job.id, campaignId, recipientId }
            })
            throw error // BullMQ will retry based on attempts
        }
    },
    {
        connection: connection as any,
        concurrency: 5, // 5 parallel emails as requested
    }
)

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`)
})

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`)
})

export default worker
