import { testSmtpConnection } from '@/lib/email'
import { resolveStoredSecret } from '@/lib/encryption'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body: { smtpEmail?: string; smtpPassword?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    const { smtpEmail, smtpPassword } = body

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
