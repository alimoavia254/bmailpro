'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

function mapAuthError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'Invalid email or password.'
  if (normalized.includes('email not confirmed')) return 'Please verify your email before signing in.'
  return 'Unable to complete authentication right now. Please try again.'
}

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      })
      if (error) {
        setError('Google sign-in failed. Please try again.')
        setGoogleLoading(false)
      }
      // On success, browser redirects to Google — no need to stop loading
    } catch {
      setError('Google sign-in failed. Please try again.')
      setGoogleLoading(false)
    }
  }

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
        setError(mapAuthError(error.message))
        setLoading(false)
        return
      }

      // Session set — page.tsx will pick up the auth state change
      void data
      setLoading(false)
    } catch (err: any) {
      setError(mapAuthError(err?.message || 'Failed to sign in'))
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
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
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/&new_user=1`,
        },
      })

      if (error) {
        setError(mapAuthError(error.message))
        setLoading(false)
        return
      }

      // If user was auto-confirmed (no email confirmation required), mark as new
      if (data.session) {
        sessionStorage.setItem('bmail:new_user', '1')
      }

      setRegName('')
      setRegEmail('')
      setRegPassword('')
      setSuccess('Account created! Please check your email to confirm, then sign in.')
      setLoading(false)
    } catch (err: any) {
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

        {/* Google Button */}
        <button
          onClick={handleGoogleAuth}
          disabled={googleLoading}
          className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl font-semibold text-sm mb-5 transition-all disabled:opacity-60"
          style={{
            background: '#fff',
            border: '1.5px solid #dadce0',
            color: '#3c4043',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          {googleLoading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#dadce0" strokeWidth="3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#4285F4" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          ) : (
            <GoogleIcon />
          )}
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-[11px] font-semibold text-[var(--muted)]">OR</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Auth Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); setSuccess('') }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); setSuccess('') }}
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
            {success && (
              <div className="p-3 rounded-lg text-sm mt-2" style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--accent2)', border: '1px solid rgba(34,197,94,0.2)' }}>
                {success}
              </div>
            )}
            {!success && (
              <button
                type="submit"
                className="btn-bmail btn-bmail-primary w-full justify-center mt-4"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create Account →'}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
