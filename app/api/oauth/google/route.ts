import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAuthUrl } from '@/lib/google-oauth'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const slot = request.nextUrl.searchParams.get('slot') || '1'
  const state = crypto.randomBytes(16).toString('hex')

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`
  const redirectUri = `${appUrl}/api/oauth/google/callback`

  // Encode slot + userId in state so callback knows where to save tokens
  const fullState = `${state}:${slot}:${user.id}`
  const authUrl = getGoogleAuthUrl(clientId, redirectUri, fullState)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return response
}
