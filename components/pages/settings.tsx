'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  User, Mail, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Save, ChevronRight, Copy, Eye, EyeOff,
  Shield, Zap, Star, ExternalLink, Wifi, WifiOff, X, ArrowRight
} from 'lucide-react'

// ── Google Sign-In wizard modal ────────────────────────────────────────────
type WizardStep = 'signin' | 'apppassword' | 'testing' | 'done'

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

function ConnectGmailWizard({
  open, slot, onClose, onSaved, showToast
}: {
  open: boolean
  slot: 1 | 2
  onClose: () => void
  onSaved: (slot: 1|2, email: string) => void
  showToast: (msg: string, type?: any) => void
}) {
  const [step, setStep] = useState<WizardStep>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [gisReady, setGisReady] = useState(false)
  const supabase = createClient()

  // Load Google Identity Services script
  useEffect(() => {
    if (!open) return
    if ((window as any).google?.accounts) { setGisReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => setGisReady(true)
    document.head.appendChild(script)
  }, [open])

  // Reset on open
  useEffect(() => {
    if (open) { setStep('signin'); setEmail(''); setPassword(''); setError('') }
  }, [open])

  const signInWithGoogle = () => {
    if (!(window as any).google?.accounts) {
      setError('Google Sign-In not loaded yet. Please try again.')
      return
    }
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope: 'email profile',
      callback: async (tokenResponse: any) => {
        if (!tokenResponse.access_token) {
          setError('Google sign-in cancelled.')
          return
        }
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          })
          const info = await res.json()
          if (info.email) {
            setEmail(info.email)
            setStep('apppassword')
          } else {
            setError('Could not get email from Google.')
          }
        } catch {
          setError('Failed to fetch Google account info.')
        }
      },
      error_callback: () => setError('Google sign-in was cancelled or failed.'),
    })
    client.requestAccessToken()
  }

  const testAndSave = async () => {
    if (!password.trim()) { setError('Please enter the App Password.'); return }
    setStep('testing')
    setError('')
    try {
      // Test SMTP connection
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpEmail: email, smtpPassword: password.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Connection failed. Check your App Password and try again.')
        setStep('apppassword')
        return
      }
      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated.'); setStep('apppassword'); return }

      const updates: any = {
        [`smtp_email_${slot}`]: email,
        [`smtp_password_${slot}`]: password.trim(),
        [`smtp_verified_${slot}`]: true,
        updated_at: new Date().toISOString(),
      }
      if (slot === 1) { updates.smtp_email = email; updates.smtp_password = password.trim() }

      await supabase.from('profiles').update(updates).eq('id', user.id)
      setStep('done')
      onSaved(slot, email)
    } catch {
      setError('Network error. Please try again.')
      setStep('apppassword')
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <GoogleIcon />
            <span className="font-bold text-[var(--ink)]">Connect Gmail — Account {slot}</span>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--paper)' }}>
          {(['signin', 'apppassword', 'done'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                  style={{
                    background: step === s || (s === 'done' && step === 'done') || (s === 'signin' && ['apppassword','testing','done'].includes(step)) || (s === 'apppassword' && ['testing','done'].includes(step))
                      ? 'var(--accent)' : 'var(--border)',
                    color: step === s || (s === 'signin' && ['apppassword','testing','done'].includes(step)) || (s === 'apppassword' && ['testing','done'].includes(step))
                      ? '#fff' : 'var(--muted)',
                  }}
                >
                  {(s === 'signin' && ['apppassword','testing','done'].includes(step)) || (s === 'apppassword' && ['testing','done'].includes(step)) || (s === 'done' && step === 'done')
                    ? '✓' : i + 1}
                </div>
                <span className="text-[10px] font-semibold text-[var(--muted)]">
                  {s === 'signin' ? 'Sign In' : s === 'apppassword' ? 'App Password' : 'Done'}
                </span>
              </div>
              {i < 2 && <div className="flex-1 h-px mx-2" style={{ background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5">

          {/* Step 1: Google Sign-In */}
          {step === 'signin' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)] mb-1">Step 1: Verify your Gmail account</p>
                <p className="text-xs text-[var(--muted)]">
                  We'll use Google Sign-In just to confirm your Gmail address. No email access is granted.
                </p>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #ffc9c9' }}>
                  <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <button
                onClick={signInWithGoogle}
                disabled={!gisReady}
                className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                style={{ background: '#fff', border: '1.5px solid #dadce0', color: '#3c4043', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
              >
                <GoogleIcon />
                {gisReady ? 'Sign in with Google' : 'Loading...'}
              </button>
              <p className="text-[10px] text-center text-[var(--muted)]">
                Only your email address will be read. Your emails are never accessed.
              </p>
            </div>
          )}

          {/* Step 2: App Password */}
          {(step === 'apppassword' || step === 'testing') && (
            <div className="space-y-4">
              <div
                className="flex items-center gap-2.5 p-3 rounded-lg"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent2)' }} />
                <div>
                  <div className="text-xs font-bold" style={{ color: 'var(--accent2)' }}>Google account confirmed</div>
                  <div className="text-xs text-[var(--muted)]">{email}</div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-[var(--ink)] mb-1">Step 2: Create an App Password</p>
                <div
                  className="rounded-lg p-3.5 text-xs leading-relaxed space-y-1.5"
                  style={{ background: 'rgba(26,86,219,0.05)', border: '1px solid rgba(26,86,219,0.12)' }}
                >
                  <p style={{ color: 'var(--muted-foreground)' }}>Follow these steps in a new tab:</p>
                  <ol className="space-y-1" style={{ color: 'var(--muted-foreground)' }}>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-[var(--accent)] flex-shrink-0">1.</span>
                      <span>Enable <strong>2-Step Verification</strong> at <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>Google Security <ExternalLink className="w-2.5 h-2.5" /></a></span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-[var(--accent)] flex-shrink-0">2.</span>
                      <span>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>App Passwords <ExternalLink className="w-2.5 h-2.5" /></a></span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-[var(--accent)] flex-shrink-0">3.</span>
                      <span>Type a name (e.g. <strong>BmailPro</strong>) → click <strong>Create</strong></span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-[var(--accent)] flex-shrink-0">4.</span>
                      <span>Copy the <strong>16-character password</strong> and paste below</span>
                    </li>
                  </ol>
                </div>
              </div>

              <div>
                <label className="form-label">App Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="form-input pr-10"
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={step === 'testing'}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    onClick={() => setShowPw(p => !p)}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #ffc9c9' }}>
                  <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <button
                onClick={testAndSave}
                disabled={step === 'testing'}
                className="btn-bmail btn-bmail-primary w-full justify-center"
              >
                {step === 'testing'
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Testing connection...</>
                  : <><Zap className="w-4 h-4" /> Test & Connect Gmail</>
                }
              </button>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--accent2)' }} />
              </div>
              <div>
                <p className="font-bold text-[var(--ink)] text-base">Gmail Connected!</p>
                <p className="text-sm text-[var(--muted)] mt-1">{email}</p>
                <p className="text-xs text-[var(--muted)] mt-2">Account {slot} is ready to send emails.</p>
              </div>
              <button onClick={onClose} className="btn-bmail btn-bmail-primary px-8 justify-center mt-2">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
import { DELIVERY_SPEED_KEY, DELIVERY_SPEED_PRESETS, normalizeDeliveryMode, type DeliverySpeedMode } from '@/lib/delivery-speed'

interface SettingsProps {
  profile: any
  trackingUrl: string
  showToast: (msg: string, type?: any) => void
}

interface SmtpAccount {
  slot: 1 | 2
  email: string
  password: string
  label: string
  verified: boolean
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail'

// ── Sub-component moved outside to prevent focus loss ──────────────────────
const SmtpAccountCard = ({
  slot, accounts, activeSmtp, testStatus, testMsg,
  savingSmtp, expandedSlot, profile, showPasswords,
  setAccounts, setExpandedSlot, setActiveSMTP,
  testConnection, saveSmtp, setShowPasswords,
  onConnectGmail,
}: any) => {
  const acc = accounts[slot]
  const isActive = activeSmtp === slot
  const status = testStatus[slot]
  const msg = testMsg[slot]
  const isSaving = savingSmtp[slot]
  const isExpanded = expandedSlot === slot
  const hasEmail = !!acc.email
  const savedPw = slot === 1
    ? (profile?.smtp_password_1 || profile?.smtp_password)
    : profile?.smtp_password_2

  const statusIcon = () => {
    if (!hasEmail) return <WifiOff className="w-3.5 h-3.5 text-[var(--muted)]" />
    if (acc.verified) return <Wifi className="w-3.5 h-3.5 text-[var(--accent2)]" />
    return <AlertCircle className="w-3.5 h-3.5 text-[var(--amber)]" />
  }

  const statusColor = !hasEmail ? 'var(--muted)' : acc.verified ? 'var(--accent2)' : 'var(--amber)'
  const statusText = !hasEmail ? 'Not configured' : acc.verified ? 'Verified' : 'Unverified'

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{
        borderColor: isActive ? 'var(--accent)' : 'var(--border)',
        background: 'var(--surface)',
        boxShadow: isActive
          ? '0 0 0 3px rgba(26,86,219,0.08), 0 2px 8px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpandedSlot(isExpanded ? null : slot)}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isActive ? 'rgba(26,86,219,0.1)' : 'var(--paper)' }}
        >
          <Mail className="w-4 h-4" style={{ color: isActive ? 'var(--accent)' : 'var(--muted)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input
              className="font-semibold text-sm bg-transparent border-none outline-none w-32 text-[var(--ink)]"
              value={acc.label}
              onClick={e => e.stopPropagation()}
              onChange={e => setAccounts((prev: any) => ({ ...prev, [slot]: { ...prev[slot], label: e.target.value } }))}
              placeholder={`Account ${slot}`}
            />
            {isActive && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(26,86,219,0.1)', color: 'var(--accent)' }}
              >
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {statusIcon()}
            <span className="text-xs" style={{ color: statusColor }}>{statusText}</span>
            {hasEmail && (
              <>
                <span className="text-xs text-[var(--muted)]">·</span>
                <span className="text-xs text-[var(--muted)] truncate">{acc.email}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isActive && hasEmail && (
            <button
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(26,86,219,0.08)', color: 'var(--accent)' }}
              onClick={e => { e.stopPropagation(); setActiveSMTP(slot) }}
            >
              Use this
            </button>
          )}
          <ChevronRight
            className="w-4 h-4 text-[var(--muted)] transition-transform"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
          />
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>

          {/* ── Connect Gmail (wizard) ── */}
          <div className="mt-4 mb-4">
            {acc.verified && acc.email ? (
              <div
                className="flex items-center justify-between p-3.5 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent2)' }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--accent2)' }}>Gmail Connected</div>
                    <div className="text-xs text-[var(--muted)]">{acc.email}</div>
                  </div>
                </div>
                <button
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: 'rgba(26,86,219,0.08)', color: 'var(--accent)' }}
                  onClick={() => onConnectGmail(slot)}
                >
                  Reconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => onConnectGmail(slot)}
                className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: '#fff',
                  border: '1.5px solid #dadce0',
                  color: '#3c4043',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <GoogleIcon />
                Connect Gmail (Guided Setup)
              </button>
            )}

            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-[10px] font-bold text-[var(--muted)]">OR CONFIGURE MANUALLY</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
          </div>

          {/* Gmail App Password setup guide */}
          <div
            className="rounded-lg p-3.5 mb-4 text-xs leading-relaxed"
            style={{ background: 'rgba(26,86,219,0.05)', border: '1px solid rgba(26,86,219,0.12)' }}
          >
            <div className="flex items-center gap-1.5 font-bold mb-2" style={{ color: 'var(--accent)' }}>
              <Shield className="w-3.5 h-3.5" />
              Gmail App Password Setup
            </div>
            <ol className="space-y-1" style={{ color: 'var(--muted-foreground)' }}>
              <li>1. Enable 2FA at <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>Google Account Security <ExternalLink className="w-2.5 h-2.5" /></a></li>
              <li>2. Go to <strong>Security → App Passwords</strong></li>
              <li>3. Select app: <strong>Mail</strong>, device: <strong>Other</strong></li>
              <li>4. Copy the 16-character password and paste below</li>
            </ol>
          </div>

          {/* Label */}
          <div className="mb-4">
            <label className="form-label">Account Label</label>
            <input
              className="form-input"
              value={acc.label}
              onChange={e => setAccounts((prev: any) => ({ ...prev, [slot]: { ...prev[slot], label: e.target.value } }))}
              placeholder={`e.g. Work Gmail, Personal, etc.`}
            />
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="form-label">Gmail Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="yourname@gmail.com"
              value={acc.email}
              onChange={e => setAccounts((prev: any) => ({ ...prev, [slot]: { ...prev[slot], email: e.target.value } }))}
            />
          </div>

          {/* Password */}
          <div className="mb-5">
            <label className="form-label">App Password (16 characters)</label>
            <div className="relative">
              <input
                type={showPasswords[slot] ? 'text' : 'password'}
                className="form-input pr-10"
                placeholder={savedPw ? '••••••••••••••••' : 'xxxx xxxx xxxx xxxx'}
                value={acc.password}
                onChange={e => setAccounts((prev: any) => ({ ...prev, [slot]: { ...prev[slot], password: e.target.value } }))}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={() => setShowPasswords((prev: any) => ({ ...prev, [slot]: !prev[slot] }))}
              >
                {showPasswords[slot] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {savedPw && !acc.password && (
              <p className="form-hint flex items-center gap-1 mt-1" style={{ color: 'var(--accent2)' }}>
                <CheckCircle2 className="w-3 h-3" /> Password saved — leave blank to keep current
              </p>
            )}
          </div>

          {/* Test result */}
          {status !== 'idle' && (
            <div
              className="flex items-center gap-2.5 p-3 rounded-lg mb-4 text-sm font-medium"
              style={{
                background: status === 'ok' ? 'var(--green-bg)' : status === 'fail' ? 'var(--red-bg)' : 'var(--accent-bg)',
                color: status === 'ok' ? 'var(--accent2)' : status === 'fail' ? 'var(--red)' : 'var(--accent)',
                border: `1px solid ${status === 'ok' ? '#b2f2bb' : status === 'fail' ? '#ffc9c9' : '#bfdbfe'}`,
              }}
            >
              {status === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
              {status === 'ok' && <CheckCircle2 className="w-4 h-4" />}
              {status === 'fail' && <XCircle className="w-4 h-4" />}
              {msg}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              className="btn-bmail btn-bmail-outline flex-1 justify-center"
              onClick={() => testConnection(slot)}
              disabled={status === 'testing'}
            >
              {status === 'testing' ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testing...</>
              ) : (
                <><Zap className="w-3.5 h-3.5" /> Test Connection</>
              )}
            </button>
            <button
              className="btn-bmail btn-bmail-primary flex-1 justify-center"
              onClick={() => saveSmtp(slot)}
              disabled={isSaving}
            >
              {isSaving ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Save Account {slot}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings({ profile, trackingUrl, showToast }: SettingsProps) {
  const supabase = createClient()

  // Profile
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardSlot, setWizardSlot] = useState<1 | 2>(1)

  const openWizard = (slot: 1 | 2) => {
    setWizardSlot(slot)
    setWizardOpen(true)
  }

  // SMTP accounts
  const [accounts, setAccounts] = useState<{ [k: number]: SmtpAccount }>({
    1: {
      slot: 1,
      email: profile?.smtp_email_1 || profile?.smtp_email || '',
      password: '',
      label: profile?.smtp_label_1 || 'Account 1',
      verified: profile?.smtp_verified_1 || false,
    },
    2: {
      slot: 2,
      email: profile?.smtp_email_2 || '',
      password: '',
      label: profile?.smtp_label_2 || 'Account 2',
      verified: profile?.smtp_verified_2 || false,
    },
  })
  const [showPasswords, setShowPasswords] = useState<{ [k: number]: boolean }>({ 1: false, 2: false })
  const [activeSmtp, setActiveSmtp] = useState<1 | 2>(profile?.active_smtp || 1)
  const [testStatus, setTestStatus] = useState<{ [k: number]: TestStatus }>({ 1: 'idle', 2: 'idle' })
  const [testMsg, setTestMsg] = useState<{ [k: number]: string }>({ 1: '', 2: '' })
  const [savingSmtp, setSavingSmtp] = useState<{ [k: number]: boolean }>({ 1: false, 2: false })
  const [expandedSlot, setExpandedSlot] = useState<1 | 2 | null>(1)
  const [deliverySpeed, setDeliverySpeed] = useState<DeliverySpeedMode>('balanced')
  const isSubscribed = profile?.subscription_status === 'active'

  const mergeProfile = (next: any) => {
    if (!next) return
    setAccounts({
      1: {
        slot: 1,
        email: next.smtp_email_1 || next.smtp_email || '',
        password: '',
        label: next.smtp_label_1 || 'Account 1',
        verified: next.smtp_verified_1 || false,
      },
      2: {
        slot: 2,
        email: next.smtp_email_2 || '',
        password: '',
        label: next.smtp_label_2 || 'Account 2',
        verified: next.smtp_verified_2 || false,
      },
    })
    setActiveSmtp(next.active_smtp || 1)
  }

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setAccounts({
        1: {
          slot: 1,
          email: profile.smtp_email_1 || profile.smtp_email || '',
          password: '',
          label: profile.smtp_label_1 || 'Account 1',
          verified: profile.smtp_verified_1 || false,
        },
        2: {
          slot: 2,
          email: profile.smtp_email_2 || '',
          password: '',
          label: profile.smtp_label_2 || 'Account 2',
          verified: profile.smtp_verified_2 || false,
        },
      })
      setActiveSmtp(profile.active_smtp || 1)
    }
  }, [profile])

  useEffect(() => {
    const stored = normalizeDeliveryMode(typeof window !== 'undefined' ? localStorage.getItem(DELIVERY_SPEED_KEY) : null)
    setDeliverySpeed(stored)
  }, [])

  // ── Profile save ──────────────────────────────────────────
  const saveProfile = async () => {
    setSavingProfile(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { showToast('Not authenticated', 'error'); setSavingProfile(false); return }

    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*')
      .single()

    if (error) showToast('Failed to save profile', 'error')
    else {
      showToast('Profile updated', 'success')
      mergeProfile(data)
    }
    setSavingProfile(false)
  }

  // ── SMTP save ─────────────────────────────────────────────
  const saveSmtp = async (slot: 1 | 2) => {
    const acc = accounts[slot]
    if (!acc.email) { showToast('Enter a Gmail address', 'error'); return }

    setSavingSmtp(prev => ({ ...prev, [slot]: true }))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { showToast('Not authenticated', 'error'); setSavingSmtp(prev => ({ ...prev, [slot]: false })); return }

    const updates: any = {
      [`smtp_email_${slot}`]: acc.email,
      [`smtp_label_${slot}`]: acc.label,
      updated_at: new Date().toISOString(),
    }
    // Only update password if user entered one
    if (acc.password) {
      updates[`smtp_password_${slot}`] = acc.password
      updates[`smtp_verified_${slot}`] = false // reset until retested
    }

    // Also keep legacy fields in sync for slot 1
    if (slot === 1) {
      updates.smtp_email = acc.email
      if (acc.password) updates.smtp_password = acc.password
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single()
    if (error) {
      showToast('Failed to save SMTP settings', 'error')
    } else {
      showToast(`Account ${slot} saved`, 'success')
      // clear password field after save
      setAccounts(prev => ({ ...prev, [slot]: { ...prev[slot], password: '' } }))
      mergeProfile(data)
    }
    setSavingSmtp(prev => ({ ...prev, [slot]: false }))
  }

  // ── Active account switch ─────────────────────────────────
  const setActiveSMTP = async (slot: 1 | 2) => {
    const acc = accounts[slot]
    if (!acc.email) { showToast(`Account ${slot} has no email configured`, 'error'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .update({ active_smtp: slot, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*')
      .single()

    if (!error) {
      mergeProfile(data)
      showToast(`Switched to Account ${slot}`, 'success')
    }
  }

  // ── Test connection ───────────────────────────────────────
  const testConnection = async (slot: 1 | 2) => {
    const acc = accounts[slot]
    const emailToTest = acc.email
    const pwToTest = acc.password || (slot === 1 ? profile?.smtp_password_1 || profile?.smtp_password : profile?.smtp_password_2)

    if (!emailToTest || !pwToTest) {
      setTestStatus(prev => ({ ...prev, [slot]: 'fail' }))
      setTestMsg(prev => ({ ...prev, [slot]: 'Enter email and app password first' }))
      return
    }

    setTestStatus(prev => ({ ...prev, [slot]: 'testing' }))
    setTestMsg(prev => ({ ...prev, [slot]: 'Connecting to Gmail SMTP...' }))

    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpEmail: emailToTest, smtpPassword: pwToTest }),
      })
      const data = await res.json()

      if (data.success) {
        setTestStatus(prev => ({ ...prev, [slot]: 'ok' }))
        setTestMsg(prev => ({ ...prev, [slot]: 'Connected successfully' }))
        // Mark verified in DB
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: updatedProfile } = await supabase.from('profiles')
            .update({ [`smtp_verified_${slot}`]: true })
            .eq('id', user.id)
            .select('*')
            .single()
          setAccounts(prev => ({ ...prev, [slot]: { ...prev[slot], verified: true } }))
          mergeProfile(updatedProfile)
        }
      } else {
        setTestStatus(prev => ({ ...prev, [slot]: 'fail' }))
        setTestMsg(prev => ({ ...prev, [slot]: data.error || 'Connection failed' }))
      }
    } catch {
      setTestStatus(prev => ({ ...prev, [slot]: 'fail' }))
      setTestMsg(prev => ({ ...prev, [slot]: 'Network error — try again' }))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard', 'success')
  }

  const saveDeliverySpeed = () => {
    localStorage.setItem(DELIVERY_SPEED_KEY, deliverySpeed)
    const preset = DELIVERY_SPEED_PRESETS[deliverySpeed]
    showToast(`Delivery speed saved: ${preset.label} (~${preset.approxPerMinute}/min)`, 'success')
  }

  return (
    <div className="two-col">
      {/* LEFT: Profile + SMTP */}
      <div className="space-y-5">

        {/* Profile Card */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--muted)]" />
              <span className="bmail-card-title">Profile</span>
            </div>
          </div>
          <div className="bmail-card-body">
            <div className="form-row">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                placeholder="Your display name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
            <div className="form-row mb-0">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                value={profile?.email || ''}
                disabled
                style={{ background: 'var(--paper)', color: 'var(--muted)' }}
              />
              <p className="form-hint">Account email cannot be changed</p>
            </div>
          </div>
        </div>

        {/* Gmail SMTP Card */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--muted)]" />
              <span className="bmail-card-title">Gmail SMTP Accounts</span>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
            >
              2 Accounts Supported
            </span>
          </div>
          <div className="bmail-card-body space-y-3">
            {/* Active account indicator */}
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'var(--paper)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Zap className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                <span>Sending from:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--ink)]">
                  {accounts[activeSmtp]?.email || `Account ${activeSmtp} (not set)`}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(26,86,219,0.1)', color: 'var(--accent)' }}
                >
                  ACTIVE
                </span>
              </div>
            </div>

            {/* Account 1 */}
            <SmtpAccountCard
              slot={1}
              accounts={accounts}
              activeSmtp={activeSmtp}
              testStatus={testStatus}
              testMsg={testMsg}
              savingSmtp={savingSmtp}
              expandedSlot={expandedSlot}
              profile={profile}
              showPasswords={showPasswords}
              setAccounts={setAccounts}
              setExpandedSlot={setExpandedSlot}
              setActiveSMTP={setActiveSMTP}
              testConnection={testConnection}
              saveSmtp={saveSmtp}
              setShowPasswords={setShowPasswords}
              onConnectGmail={openWizard}
            />

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs font-semibold text-[var(--muted)]">OR</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {/* Account 2 */}
            <SmtpAccountCard
              slot={2}
              accounts={accounts}
              activeSmtp={activeSmtp}
              testStatus={testStatus}
              testMsg={testMsg}
              savingSmtp={savingSmtp}
              expandedSlot={expandedSlot}
              profile={profile}
              showPasswords={showPasswords}
              setAccounts={setAccounts}
              setExpandedSlot={setExpandedSlot}
              setActiveSMTP={setActiveSMTP}
              testConnection={testConnection}
              saveSmtp={saveSmtp}
              setShowPasswords={setShowPasswords}
              onConnectGmail={openWizard}
            />
          </div>
        </div>

        {/* Save profile */}
        <button
          className="btn-bmail btn-bmail-primary w-full justify-center py-2.5 text-sm"
          onClick={saveProfile}
          disabled={savingProfile}
        >
          {savingProfile ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4" /> Save Profile</>
          )}
        </button>

        {/* Delivery Speed */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--muted)]" />
              <span className="bmail-card-title">Delivery Speed</span>
            </div>
          </div>
          <div className="bmail-card-body">
            <p className="form-hint mb-3">
              Default is Balanced. Change only if needed for your sender reputation.
            </p>
            <div className="space-y-2 mb-3">
              {(['safe', 'balanced', 'fast'] as DeliverySpeedMode[]).map((mode) => {
                const p = DELIVERY_SPEED_PRESETS[mode]
                const selected = deliverySpeed === mode
                return (
                  <label
                    key={mode}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer border"
                    style={{
                      borderColor: selected ? 'var(--accent)' : 'var(--border)',
                      background: selected ? 'rgba(26,86,219,0.06)' : 'var(--surface)',
                    }}
                  >
                    <div>
                      <div className="font-semibold text-sm">{p.label}</div>
                      <div className="text-xs text-[var(--muted)]">~{p.approxPerMinute} emails / minute</div>
                    </div>
                    <input
                      type="radio"
                      name="delivery_speed"
                      checked={selected}
                      onChange={() => setDeliverySpeed(mode)}
                    />
                  </label>
                )
              })}
            </div>
            <button className="btn-bmail btn-bmail-primary w-full justify-center" onClick={saveDeliverySpeed}>
              Save Delivery Speed
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Info panels */}
      <div className="space-y-5">

        {/* Subscription */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[var(--muted)]" />
              <span className="bmail-card-title">Subscription</span>
            </div>
          </div>
          <div className="bmail-card-body">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: isSubscribed ? 'rgba(103,65,217,0.1)' : 'var(--paper)',
                }}
              >
                <Star
                  className="w-5 h-5"
                  style={{ color: isSubscribed ? 'var(--purple)' : 'var(--muted)' }}
                />
              </div>
              <div>
                <div className="font-semibold text-sm text-[var(--ink)]">
                  {isSubscribed ? `${(profile?.subscription_plan || profile?.subscription_tier || 'Pro').toString()} Plan` : 'Free Plan'}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {isSubscribed ? 'Unlimited emails' : '100 emails / month'}
                </div>
              </div>
              <span
                className={`pill ml-auto ${isSubscribed ? 'p-purple' : 'p-draft'}`}
              >
                {isSubscribed ? 'Active' : 'Free'}
              </span>
            </div>

            {isSubscribed && profile?.subscription_end_date && (
              <div
                className="p-3 rounded-lg text-xs"
                style={{ background: 'var(--green-bg)', border: '1px solid #b2f2bb', color: 'var(--accent2)' }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                Expires {new Date(profile.subscription_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            )}

            {!isSubscribed && (
              <button
                className="btn-bmail btn-bmail-primary w-full justify-center mt-2"
                onClick={() => showToast('Go to Upgrade page for subscription details', 'info')}
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>

        {/* Tracking URL */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--muted)]" />
              <span className="bmail-card-title">Tracking URL</span>
            </div>
          </div>
          <div className="bmail-card-body">
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-xs font-mono"
              style={{ background: 'var(--paper)', border: '1px solid var(--border)' }}
            >
              <span className="flex-1 text-[var(--ink)] break-all">{trackingUrl}</span>
              <button
                className="flex-shrink-0 p-1.5 rounded hover:bg-[var(--border)] transition-colors"
                onClick={() => copyToClipboard(trackingUrl)}
                title="Copy URL"
              >
                <Copy className="w-3.5 h-3.5 text-[var(--muted)]" />
              </button>
            </div>
            <p className="form-hint mt-2">
              Opens and clicks are tracked through this URL. Ensure it is publicly accessible.
            </p>
          </div>
        </div>

        {/* Account Security */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--muted)]" />
              <span className="bmail-card-title">Account Security</span>
            </div>
          </div>
          <div className="bmail-card-body space-y-3">
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-sm font-semibold text-[var(--ink)]">Email Verified</div>
                <div className="text-xs text-[var(--muted)]">{profile?.email}</div>
              </div>
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent2)' }} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-semibold text-[var(--ink)]">Account Type</div>
                <div className="text-xs text-[var(--muted)]">
                  {profile?.is_admin ? 'Administrator' : 'Standard User'}
                </div>
              </div>
              <span
                className={`pill ${profile?.is_admin ? 'p-purple' : 'p-draft'}`}
              >
                {profile?.is_admin ? 'Admin' : 'User'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Gmail wizard modal */}
      <ConnectGmailWizard
        open={wizardOpen}
        slot={wizardSlot}
        onClose={() => setWizardOpen(false)}
        onSaved={(savedSlot: 1 | 2, savedEmail: string) => {
          setAccounts((prev: any) => ({
            ...prev,
            [savedSlot]: { ...prev[savedSlot], email: savedEmail, verified: true },
          }))
          setWizardOpen(false)
          showToast(`Gmail Account ${savedSlot} connected successfully!`, 'success')
        }}
        showToast={showToast}
      />
    </div>
  )
}
