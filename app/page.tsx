'use client'

import { useEffect, useRef, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient, getCurrentUserSafe } from '@/lib/supabase/client'
import AuthScreen from '@/components/auth-screen'
import LandingPage from '@/components/landing-page'
import AppShell from '@/components/app-shell'

const ADMIN_EMAIL = 'alimoavia80@gmail.com'
const AUTH_TIMEOUT_MS = 10000

async function fetchProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string | undefined
) {
  const isHardcodedAdmin = userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data
      ? { ...data, is_admin: data.is_admin || isHardcodedAdmin }
      : isHardcodedAdmin
      ? { is_admin: true, email: userEmail }
      : null
  } catch {
    return isHardcodedAdmin ? { is_admin: true, email: userEmail } : null
  }
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showAuth, setShowAuth] = useState(false)
  // Start loading:true — resolved exactly once via the auth state listener below
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Track whether we have already resolved the initial session.
  // This prevents onAuthStateChange's INITIAL_SESSION event from
  // racing with an explicit checkSession call and causing double-
  // setLoading or a permanent loading state on hard-refresh.
  const resolvedRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

    // Supabase auth error (e.g. otp_expired) → forward to forgot-password
    const errorCode = params.get('error_code') || hashParams.get('error_code')
    if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
      window.location.replace('/auth/forgot-password?error=link_expired')
      return
    }

    // Google OAuth callback → store so settings page can read it
    const oauth = params.get('oauth')
    if (oauth) {
      sessionStorage.setItem('oauth_result', window.location.search)
      window.history.replaceState({}, '', '/')
    }

    // New user cookie set by /auth/callback → move to sessionStorage
    if (document.cookie.includes('bmail_new_user=1')) {
      sessionStorage.setItem('bmail:new_user', '1')
      document.cookie = 'bmail_new_user=; Max-Age=0; path=/'
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('request_timeout')), timeoutMs)
      )
      return Promise.race([promise, timeout]) as Promise<T>
    }

    const hydrateProfile = async (currentUser: any) => {
      try {
        const profileData = await withTimeout(
          fetchProfile(supabase, currentUser.id, currentUser.email),
          7000
        )
        if (!isMounted) return
        setProfile(profileData)
      } catch {
        if (!isMounted) return
        setProfile(null)
      }
    }

    // Supabase fires INITIAL_SESSION (or SIGNED_IN) synchronously on
    // page load/refresh.  We rely solely on onAuthStateChange so there
    // is one guaranteed code-path that sets loading:false.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return

        const currentUser = session?.user ?? null

        // For the very first event on refresh this handles both
        // "no session" and "has session" cleanly.
        if (!resolvedRef.current) {
          resolvedRef.current = true

          if (currentUser) {
            setUser(currentUser)
            // Unblock UI first; profile can hydrate in background.
            setLoading(false)
            void hydrateProfile(currentUser)
          } else {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        // Subsequent events (sign-in, sign-out, token refresh …)
        if (currentUser) {
          setUser(currentUser)
          void hydrateProfile(currentUser)
        } else {
          setUser(null)
          setProfile(null)
        }
      }
    )

    // Extra fallback for browsers where INITIAL_SESSION event can be delayed/lost.
    void (async () => {
      try {
        const existingUser = await getCurrentUserSafe(supabase, 7000)
        if (!isMounted || resolvedRef.current) return
        resolvedRef.current = true
        if (existingUser) {
          setUser(existingUser)
          setLoading(false)
          void hydrateProfile(existingUser)
          return
        }
        setUser(null)
        setProfile(null)
        setLoading(false)
      } catch {
        // handled by safety timer below
      }
    })()

    // Safety net: if the auth system never fires (e.g. network offline),
    // stop the loading spinner after the timeout so the user sees the
    // login screen instead of infinite loading.
    const safetyTimer = setTimeout(() => {
      if (isMounted && !resolvedRef.current) {
        resolvedRef.current = true
        setLoading(false)
      }
    }, AUTH_TIMEOUT_MS)

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-bg-gradient" aria-hidden="true" />
        <div className="loading-center" role="status" aria-live="polite">
          <div className="loading-logo">
            <div className="loading-logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <h1 className="loading-logo-text">
              Bmail<span className="loading-logo-accent">Pro</span>
            </h1>
          </div>
          <div className="loading-dots" aria-hidden="true">
            <div className="loading-dot" />
            <div className="loading-dot" />
            <div className="loading-dot" />
          </div>
          <span className="loading-label">Loading...</span>
        </div>
        <div className="loading-footer" aria-hidden="true">
          Professional Email Tracking Platform
        </div>
      </div>
    )
  }

  if (!user) {
    if (!showAuth) {
      return (
        <LandingPage
          onGetStarted={() => setShowAuth(true)}
          onSignIn={() => setShowAuth(true)}
        />
      )
    }
    return <AuthScreen onBack={() => setShowAuth(false)} />
  }

  return <AppShell user={user} profile={profile} />
}
