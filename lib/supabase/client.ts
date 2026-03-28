import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (browserClient) return browserClient

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return browserClient
}

export async function getCurrentUserSafe(
  supabase: SupabaseClient,
  timeoutMs = 12000
): Promise<User | null> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), timeoutMs)
    )

    const result = await Promise.race([supabase.auth.getUser(), timeout]) as Awaited<
      ReturnType<typeof supabase.auth.getUser>
    >

    if (result.error) throw result.error
    if (result.data.user) return result.data.user
  } catch {
    // fallback below
  }

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user) return null

  return sessionData.session.user
}
