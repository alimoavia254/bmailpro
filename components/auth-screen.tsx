'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function mapAuthError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'Invalid email or password.'
  if (normalized.includes('email not confirmed')) return 'Please verify your email before signing in.'
  return 'Unable to complete authentication right now. Please try again.'
}

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!loginEmail) { setError('Enter your email'); return }
    if (!loginPassword) { setError('Enter your password'); return }
    
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      
      if (error) {
        console.log('[v0] Login error:', error.message)
        setError(mapAuthError(error.message))
        setLoading(false)
        return
      }

      console.log('[v0] Login successful:', data.user?.email)
      // Session set, page should redirect
      setLoading(false)
    } catch (err: any) {
      console.log('[v0] Login exception:', err)
      setError(mapAuthError(err?.message || 'Failed to sign in'))
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!regName) { setError('Enter your name'); return }
    if (!regEmail) { setError('Enter your email'); return }
    if (!regPassword) { setError('Enter a password'); return }
    if (regPassword.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: { full_name: regName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.log('[v0] Signup error:', error.message)
        setError(mapAuthError(error.message))
        setLoading(false)
        return
      }

      // Success - user created
      console.log('[v0] Account created successfully:', data.user?.email)
      // Clear form and show success message
      setRegName('')
      setRegEmail('')
      setRegPassword('')
      setError('Account created! Please check your email to confirm.')
      setLoading(false)
    } catch (err: any) {
      console.log('[v0] Signup exception:', err)
      setError(err.message || 'Failed to create account')
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-[42px] h-[42px] bg-[var(--accent)] rounded-xl flex items-center justify-center text-xl text-white">
            ✉
          </div>
          <span className="font-[var(--font-syne)] text-[22px] font-extrabold text-[var(--ink)]">
            Bmail<span className="text-[var(--accent)]">Pro</span>
          </span>
        </div>

        {/* Auth Tabs */}
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
          >
            Sign In
          </button>
          <button 
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError('') }}
          >
            Create Account
          </button>
        </div>

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-row">
              <label className="form-label">Email Address</label>
              <input 
                type="email"
                className="form-input"
                placeholder="yourname@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Password</label>
              <input 
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
              <div className="mt-1 text-right">
                <Link href="/auth/forgot-password" className="text-xs underline underline-offset-4">
                  Forgot password?
                </Link>
              </div>
            </div>
            {error && <div className="form-err">{error}</div>}
            <button 
              type="submit" 
              className="btn-bmail btn-bmail-primary w-full justify-center mt-4"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-row">
              <label className="form-label">Full Name</label>
              <input 
                type="text"
                className="form-input"
                placeholder="John Doe"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Email Address</label>
              <input 
                type="email"
                className="form-input"
                placeholder="yourname@example.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Password</label>
              <input 
                type="password"
                className="form-input"
                placeholder="At least 6 characters"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            {error && <div className="form-err">{error}</div>}
            <button 
              type="submit" 
              className="btn-bmail btn-bmail-primary w-full justify-center mt-4"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
