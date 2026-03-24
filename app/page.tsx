'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuthScreen from '@/components/auth-screen'
import AppShell from '@/components/app-shell'

// Hardcoded admin email - this user always gets admin access
const ADMIN_EMAIL = 'alimoavia80@gmail.com'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()
            
            // Check if this is the hardcoded admin email
            const isHardcodedAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
            const finalProfile = profileData 
              ? { ...profileData, is_admin: profileData.is_admin || isHardcodedAdmin }
              : isHardcodedAdmin ? { is_admin: true, email: user.email } : null
            
            setProfile(finalProfile)
          } catch (err) {
            // Profile doesn't exist yet - check if hardcoded admin
            const isHardcodedAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
            if (isHardcodedAdmin) {
              setProfile({ is_admin: true, email: user.email })
            } else {
              setProfile(null)
            }
          }
        }
        setUser(user)
        setLoading(false)
      } catch (err) {
        console.log('[v0] Session check error:', err)
        setLoading(false)
      }
    }
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single()
          
          // Check if this is the hardcoded admin email
          const isHardcodedAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
          const finalProfile = profileData 
            ? { ...profileData, is_admin: profileData.is_admin || isHardcodedAdmin }
            : isHardcodedAdmin ? { is_admin: true, email: currentUser.email } : null
          
          setProfile(finalProfile)
        } catch (err) {
          // Profile doesn't exist yet - check if hardcoded admin
          const isHardcodedAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
          if (isHardcodedAdmin) {
            setProfile({ is_admin: true, email: currentUser.email })
          } else {
            setProfile(null)
          }
        }
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex flex-col items-center justify-center">
        {/* Gradient Background */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 60% 40%, rgba(26,47,110,0.15), transparent),
              radial-gradient(ellipse 60% 80% at 20% 70%, rgba(14,164,114,0.12), transparent)
            `
          }}
        />
        
        {/* Logo */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1a56db 0%, #0ea472 100%)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                Bmail<span style={{ color: '#1a56db' }}>Pro</span>
              </h1>
            </div>
          </div>
          
          {/* Loading Animation */}
          <div className="flex items-center gap-2 text-white/60">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-[#1a56db] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-[#1a56db] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-[#1a56db] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm font-medium ml-2">Loading...</span>
          </div>
        </div>
        
        {/* Footer */}
        <div className="absolute bottom-8 text-white/30 text-xs">
          Professional Email Tracking Platform
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return <AppShell user={user} profile={profile} />
}
