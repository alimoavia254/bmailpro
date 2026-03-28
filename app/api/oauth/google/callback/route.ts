import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens } from '@/lib/google-oauth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const storedState = request.cookies.get('oauth_state')?.value
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`

  const settingsUrl = `${appUrl}/protected/settings`

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}/?oauth=error&msg=missing_params`)
  }

  // state format: randomHex:slot:userId
  const parts = stateParam.split(':')
  if (parts.length !== 3) {
    return NextResponse.redirect(`${appUrl}/?oauth=error&msg=invalid_state`)
  }
  const [state, slot, userId] = parts

  if (!storedState || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/?oauth=error&msg=state_mismatch`)
  }

  const slotNum = slot === '2' ? 2 : 1

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    const redirectUri = `${appUrl}/api/oauth/google/callback`

    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri)

    const updates: Record<string, string | boolean> = {
      [`google_email_${slotNum}`]: tokens.email,
      [`google_access_token_${slotNum}`]: tokens.access_token,
      [`google_refresh_token_${slotNum}`]: tokens.refresh_token,
      [`google_token_expiry_${slotNum}`]: new Date(tokens.expiry_date).toISOString(),
      // Also sync the smtp_email so existing send logic picks it up
      [`smtp_email_${slotNum}`]: tokens.email,
      [`smtp_verified_${slotNum}`]: true,
      updated_at: new Date().toISOString(),
    }

    if (slotNum === 1) {
      updates.smtp_email = tokens.email
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) throw error

    const response = NextResponse.redirect(`${appUrl}/?oauth=success&slot=${slotNum}`)
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    console.error('OAuth callback error:', err)
    const msg = err instanceof Error ? encodeURIComponent(err.message) : 'unknown'
    return NextResponse.redirect(`${appUrl}/?oauth=error&msg=${msg}`)
  }
}
