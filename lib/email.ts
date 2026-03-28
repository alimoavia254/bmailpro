// lib/email.ts
// Real nodemailer SMTP integration for BMail Pro

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import crypto from 'crypto'

export type EmailErrorType =
  | 'auth_error'
  | 'connection_error'
  | 'rate_limit_error'
  | 'invalid_recipient'
  | 'unknown_error'

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
  errorType?: EmailErrorType
}

/**
 * Creates a Gmail SMTP transporter using an App Password.
 */
export function createTransporter(
  smtpEmail: string,
  smtpPassword: string
): Transporter {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: smtpEmail,
      pass: smtpPassword,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 3,
    tls: {
      rejectUnauthorized: true,
    },
  })
}

/**
 * Creates a Gmail OAuth2 transporter using a refresh token.
 * Used when the user connected their Gmail via "Connect with Google".
 */
export function createOAuthTransporter(
  gmailEmail: string,
  accessToken: string,
  refreshToken: string
): Transporter {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: gmailEmail,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken,
      accessToken,
    },
  } as any)
}

/**
 * Tests SMTP connection and returns result.
 */
export async function testSmtpConnection(
  smtpEmail: string,
  smtpPassword: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const transporter = createTransporter(smtpEmail, smtpPassword)
    await transporter.verify()
    transporter.close()
    return {
      success: true,
      message: 'SMTP connection verified! Gmail is ready to send emails.',
    }
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException & { responseCode?: number }
    let errorMessage = 'Failed to connect to SMTP server'

    if (error.responseCode === 535 || error.message?.includes('Invalid login')) {
      errorMessage =
        'Authentication failed. Please check your Gmail App Password. ' +
        'Regular Gmail passwords do not work — you must generate an App Password.'
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage =
        'Connection refused. Check your network or firewall settings.'
    }

    return {
      success: false,
      message: errorMessage,
      error: error.message,
    }
  }
}

/**
 * Sends a single email with retry logic (2 retries, exponential backoff).
 */
export async function sendEmail(
  transporter: Transporter,
  to: string,
  subject: string,
  html: string,
  fromEmail: string,
  maxRetries = 2
): Promise<SendEmailResult> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
        text: stripHtml(html), // auto-generate plain text version
      })

      return { success: true, messageId: info.messageId }
    } catch (err: unknown) {
      lastError = err
      const error = err as NodeJS.ErrnoException & { responseCode?: number }

      // Don't retry authentication errors — they won't self-resolve
      if (error.responseCode === 535 || error.message?.includes('Invalid login')) {
        return {
          success: false,
          error: 'Authentication failed. Check your Gmail App Password.',
          errorType: 'auth_error',
        }
      }

      // Don't retry invalid recipient errors
      if (error.responseCode === 550 || error.responseCode === 553) {
        return {
          success: false,
          error: `Invalid recipient address: ${to}`,
          errorType: 'invalid_recipient',
        }
      }

      // Rate limit — wait longer before retry
      if (error.responseCode === 421 || error.message?.includes('rate limit')) {
        if (attempt < maxRetries) {
          await sleep(Math.pow(2, attempt + 1) * 2000)
          continue
        }
        return {
          success: false,
          error: 'Rate limit exceeded. Try again later.',
          errorType: 'rate_limit_error',
        }
      }

      // Exponential backoff for other errors: 1s, 2s
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000)
      }
    }
  }

  const error = lastError as Error
  return {
    success: false,
    error: error?.message || 'Unknown error sending email',
    errorType: 'unknown_error',
  }
}

/**
 * Injects a tracking pixel and wraps links for click tracking.
 * Uses 'tid' parameter consistently across all tracking routes.
 */
export function injectTracking(
  html: string,
  trackingId: string,
  appUrl: string
): string {
  // Tracking pixel — uses 'tid' parameter (must match /api/tracking/open?tid=)
  const pixel = `<img src="${appUrl}/api/tracking/open?tid=${trackingId}" width="1" height="1" style="display:none;border:0;outline:0;" alt="" />`

  // Wrap all external links with click tracking — uses 'tid' parameter
  const tracked = html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_, url) =>
      `href="${appUrl}/api/tracking/click?tid=${trackingId}&url=${encodeURIComponent(url)}"`
  )

  // Inject pixel before </body> or append at end
  if (tracked.includes('</body>')) {
    return tracked.replace('</body>', `${pixel}</body>`)
  }
  return tracked + pixel
}

/**
 * Injects an unsubscribe link before </body>.
 */
export function injectUnsubscribeLink(
  html: string,
  email: string,
  token: string,
  appUrl: string
): string {
  const unsubscribeLink = `
<div style="text-align:center;padding:20px 0;font-size:12px;color:#999;font-family:Arial,sans-serif;">
  <p>You received this email because you subscribed to our list.</p>
  <a href="${appUrl}/api/unsubscribe?token=${token}&email=${encodeURIComponent(email)}" 
     style="color:#999;text-decoration:underline;">Unsubscribe</a>
</div>`

  if (html.includes('</body>')) {
    return html.replace('</body>', `${unsubscribeLink}</body>`)
  }
  return html + unsubscribeLink
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Strips HTML tags to produce plain text version of an email.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generates an unsubscribe token for an email address.
 */
export function generateUnsubscribeToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) {
    throw new Error('Missing UNSUBSCRIBE_SECRET. Set a strong secret in environment variables.')
  }
  return crypto.createHmac('sha256', secret).update(email.toLowerCase()).digest('hex')
}

/**
 * Verifies an unsubscribe token.
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email)
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
}
