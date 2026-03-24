'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        console.log('[v0] Auth callback - user logged in:', session.user.email)
        // Redirect to dashboard
        router.push('/protected')
      } else {
        console.log('[v0] Auth callback - no session, redirecting to login')
        router.push('/auth/login')
      }
    }

    handleCallback()
  }, [router, supabase])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-[var(--muted)]">Confirming your email...</p>
      </div>
    </div>
  )
}
