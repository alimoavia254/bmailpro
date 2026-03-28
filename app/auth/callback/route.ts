import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/protected'
  const isNewUser = searchParams.get('new_user') === '1'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Detect new user: either flagged via new_user param, or account was just created
      // (created_at and last_sign_in_at are within 30 seconds of each other)
      let redirectNew = isNewUser
      if (!redirectNew && data.user) {
        const createdAt = new Date(data.user.created_at).getTime()
        const now = Date.now()
        if (now - createdAt < 60_000) redirectNew = true
      }

      if (redirectNew) {
        const response = NextResponse.redirect(`${origin}/`)
        response.cookies.set('bmail_new_user', '1', { maxAge: 300, path: '/' })
        return response
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
