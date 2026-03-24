import { testSmtpConnection } from '@/lib/email'
import { resolveStoredSecret } from '@/lib/encryption'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { smtpEmail, smtpPassword } = await req.json()

    if (!smtpEmail || !smtpPassword) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    let resolvedPassword = smtpPassword
    try {
      resolvedPassword = resolveStoredSecret(smtpPassword, 'smtp_password')
    } catch {
      return NextResponse.json(
        { success: false, error: 'Saved SMTP password is unreadable. Please enter App Password again and save.' },
        { status: 400 }
      )
    }

    const result = await testSmtpConnection(smtpEmail, resolvedPassword)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to test SMTP connection',
      },
      { status: 500 }
    )
  }
}
