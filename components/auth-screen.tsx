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

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)

function mapAuthError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'Invalid email or password.'
  if (normalized.includes('email not confirmed')) return 'Please verify your email before signing in.'
  return 'Unable to complete authentication. Please try again.'
}

interface AuthScreenProps {
  onBack?: () => void
}

export default function AuthScreen({ onBack }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

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
      if (data.session) {
        sessionStorage.setItem('bmail:new_user', '1')
      }
      setRegName('')
      setRegEmail('')
      setRegPassword('')
      setSuccess('Account created! Check your email to confirm, then sign in.')
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
      setLoading(false)
    }
  }

  const valuePropsList = [
    'Real-time email open & click tracking',
    'Beautiful campaign analytics dashboard',
    'Schedule campaigns for perfect timing',
    'Multi-SMTP & Gmail integration',
  ]

  return (
    <div style={{
      display: 'flex', minHeight: '100dvh',
      fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
    }}>

      {/* ─── LEFT PANEL (brand / features) ─────────────── */}
      <div style={{
        flex: '0 0 45%', maxWidth: 520,
        background: '#0e0e16',
        display: 'flex', flexDirection: 'column',
        padding: 'clamp(2rem, 5vw, 3.5rem)',
        position: 'relative', overflow: 'hidden',
      }}
        className="auth-left-panel"
      >
        {/* Background gradient */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 70% 60% at 30% 20%, rgba(124,92,252,0.18), transparent),' +
            'radial-gradient(ellipse 50% 60% at 80% 80%, rgba(0,201,167,0.1), transparent)',
        }} />

        {/* Dot pattern */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo + back button row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg, #7c5cfc, #00c9a7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <span style={{
                fontFamily: 'var(--font-syne), Syne, sans-serif',
                fontWeight: 800, fontSize: '1.0625rem', color: '#fff', letterSpacing: '-0.02em',
              }}>
                Bmail<span style={{ color: '#7c5cfc' }}>Pro</span>
              </span>
            </div>

            {onBack && (
              <button
                onClick={onBack}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', borderRadius: 8,
                  padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 500,
                  cursor: 'pointer', minHeight: 'auto', minWidth: 'auto',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                Back
              </button>
            )}
          </div>

          {/* Main copy */}
          <div style={{ paddingTop: 'clamp(3rem, 8vh, 5rem)', paddingBottom: 'clamp(2rem, 5vh, 3rem)' }}>
            <h2 style={{
              fontFamily: 'var(--font-syne), Syne, sans-serif',
              fontWeight: 800,
              fontSize: 'clamp(1.625rem, 3.5vw, 2.25rem)',
              color: '#fff', letterSpacing: '-0.04em',
              lineHeight: 1.1, marginBottom: '1rem',
            }}>
              Your email campaigns,{' '}
              <span style={{
                background: 'linear-gradient(90deg, #a78bfa, #00c9a7)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>supercharged.</span>
            </h2>
            <p style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
              lineHeight: 1.7, marginBottom: '2rem',
            }}>
              Send, track, and analyze your email campaigns with professional-grade tools built for teams of all sizes.
            </p>

            {/* Value props */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {valuePropsList.map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(124,92,252,0.2)',
                    border: '1px solid rgba(124,92,252,0.3)',
                    color: '#a78bfa',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CheckIcon />
                  </div>
                  <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial card */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '1.25rem 1.5rem',
            marginTop: 'auto',
          }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: '0.75rem' }}>
              {[1,2,3,4,5].map(s => (
                <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '0.875rem' }}>
              &ldquo;BmailPro transformed how we run email outreach. The tracking data alone has doubled our response rates.&rdquo;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c5cfc, #00c9a7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: '#fff',
              }}>S</div>
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Sara K.</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Marketing Director</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL (form) ─────────────────────────── */}
      <div style={{
        flex: 1, background: '#f7f8fc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(2rem, 5vw, 3rem)',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo (only shown when left panel hidden) */}
          <div style={{
            display: 'none', alignItems: 'center', gap: 10,
            marginBottom: '2rem', justifyContent: 'center',
          }}
            className="auth-mobile-logo"
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'linear-gradient(135deg, #7c5cfc, #00c9a7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-syne), Syne, sans-serif',
              fontWeight: 800, fontSize: '1.125rem', color: '#0e0e16', letterSpacing: '-0.02em',
            }}>
              Bmail<span style={{ color: '#7c5cfc' }}>Pro</span>
            </span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '1.75rem' }}>
            <h1 style={{
              fontFamily: 'var(--font-syne), Syne, sans-serif',
              fontWeight: 800,
              fontSize: 'clamp(1.5rem, 3vw, 1.875rem)',
              color: '#0e0e16', letterSpacing: '-0.035em',
              marginBottom: '0.375rem',
            }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: '0.9375rem', color: '#64748b' }}>
              {mode === 'login'
                ? 'Sign in to your BmailPro account'
                : 'Start your free account today'}
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogleAuth}
            disabled={googleLoading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '11px 16px', borderRadius: 10,
              border: '1.5px solid #dadce0', background: '#fff',
              color: '#3c4043', fontWeight: 600, fontSize: '0.9375rem',
              cursor: 'pointer', marginBottom: '1.25rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              transition: 'box-shadow 0.15s',
              minHeight: 'auto', opacity: googleLoading ? 0.7 : 1,
            }}
          >
            {googleLoading ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#dadce0" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#4285F4" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            ) : (
              <GoogleIcon />
            )}
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e4f0' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#e2e4f0' }} />
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', background: '#f0edff', borderRadius: 10,
            padding: 4, marginBottom: '1.5rem',
          }}>
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError(''); setSuccess('') }}
                style={{
                  flex: 1, padding: '9px 8px', borderRadius: 8, border: 'none',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  minHeight: 'auto', transition: 'all 0.15s',
                  background: mode === tab ? '#fff' : 'transparent',
                  color: mode === tab ? '#0e0e16' : '#64748b',
                  boxShadow: mode === tab ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* ── Login Form ─────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
                  color: '#0e0e16', marginBottom: 6,
                }}>Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 9,
                    border: '1.5px solid #e2e4f0', background: '#fff',
                    fontSize: '0.9375rem', color: '#0e0e16', outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0e0e16' }}>Password</label>
                  <Link
                    href="/auth/forgot-password"
                    style={{ fontSize: '0.8125rem', color: '#7c5cfc', fontWeight: 500, textDecoration: 'none' }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 9,
                    border: '1.5px solid #e2e4f0', background: '#fff',
                    fontSize: '0.9375rem', color: '#0e0e16', outline: 'none',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 9,
                  background: '#fff5f5', border: '1px solid rgba(224,49,49,0.2)',
                  color: '#e03131', fontSize: '0.875rem', fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  background: loading ? '#9f7aea' : 'linear-gradient(135deg, #7c5cfc, #6d28d9)',
                  color: '#fff', fontSize: '0.9375rem', fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(124,92,252,0.3)',
                  minHeight: 'auto', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Register Form ──────────────────── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#0e0e16', marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 9,
                    border: '1.5px solid #e2e4f0', background: '#fff',
                    fontSize: '0.9375rem', color: '#0e0e16', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#0e0e16', marginBottom: 6 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 9,
                    border: '1.5px solid #e2e4f0', background: '#fff',
                    fontSize: '0.9375rem', color: '#0e0e16', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#0e0e16', marginBottom: 6 }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 9,
                    border: '1.5px solid #e2e4f0', background: '#fff',
                    fontSize: '0.9375rem', color: '#0e0e16', outline: 'none',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 9,
                  background: '#fff5f5', border: '1px solid rgba(224,49,49,0.2)',
                  color: '#e03131', fontSize: '0.875rem', fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              {success ? (
                <div style={{
                  padding: '12px 14px', borderRadius: 9,
                  background: '#e0fdf4', border: '1px solid rgba(0,201,167,0.25)',
                  color: '#00c9a7', fontSize: '0.875rem', fontWeight: 500,
                  lineHeight: 1.5,
                }}>
                  {success}
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                    background: loading ? '#9f7aea' : 'linear-gradient(135deg, #7c5cfc, #6d28d9)',
                    color: '#fff', fontSize: '0.9375rem', fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(124,92,252,0.3)',
                    minHeight: 'auto', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </>
                  )}
                </button>
              )}
            </form>
          )}

          {/* Footer note */}
          <p style={{
            marginTop: '1.5rem', textAlign: 'center',
            fontSize: '0.8125rem', color: '#94a3b8',
          }}>
            By continuing you agree to our{' '}
            <span style={{ color: '#7c5cfc', cursor: 'pointer' }}>Terms</span>
            {' '}and{' '}
            <span style={{ color: '#7c5cfc', cursor: 'pointer' }}>Privacy Policy</span>
          </p>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .auth-left-panel {
            display: none !important;
          }
          .auth-mobile-logo {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  )
}
