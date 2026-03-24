'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  User, Mail, Lock, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Save, ChevronRight, Copy, Eye, EyeOff,
  Shield, Zap, Star, ExternalLink, Wifi, WifiOff
} from 'lucide-react'

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
  testConnection, saveSmtp, setShowPasswords 
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
          {/* Gmail setup guide */}
          <div
            className="rounded-lg p-3.5 mt-4 mb-4 text-xs leading-relaxed"
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
    </div>
  )
}
