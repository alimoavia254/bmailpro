'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/sidebar'
import Dashboard from '@/components/pages/dashboard'
import Campaigns from '@/components/pages/campaigns'
import ContactsDetail from '@/components/pages/contacts-detail'
import NewCampaign from '@/components/pages/new-campaign'
import Templates from '@/components/pages/templates'
import Settings from '@/components/pages/settings'
import CampaignDetail from '@/components/pages/campaign-detail'
import AdminDashboard from '@/components/pages/admin-dashboard'
import AdminUsers from '@/components/pages/admin-users'
import AdminPayments from '@/components/pages/admin-payments'
import AdminSettings from '@/components/pages/admin-settings'
import AdminActivity from '@/components/pages/admin-activity'
import Upgrade from '@/components/pages/upgrade'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageCircle, X } from 'lucide-react'
import { getDeliveryPresetFromStorage } from '@/lib/delivery-speed'
import { parseShellSearch, replaceShellUrl } from '@/lib/app-shell-url'

type Page = 'dashboard' | 'campaigns' | 'contacts' | 'new' | 'templates' | 'settings' | 'detail' | 'upgrade' | 'admin-dashboard' | 'admin-users' | 'admin-payments' | 'admin-settings' | 'admin-activity'

interface AppShellProps {
  user: any
  profile: any
}

const IDLE_LOGOUT_MS = 30 * 60 * 1000
const LAST_ACTIVE_KEY = 'bmail:last-active'

export default function AppShell({ user, profile }: AppShellProps) {
  // Only show settings for genuinely new users who haven't set up SMTP yet.
  // If SMTP is already connected, always go to dashboard.
  const hasSmtp = !!(profile?.smtp_email_1 || profile?.smtp_email || profile?.smtp_email_2)
  const isNewUser = !hasSmtp && typeof window !== 'undefined' &&
    sessionStorage.getItem('bmail:new_user') === '1'

  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [smtpStatus, setSmtpStatus] = useState<'ok' | 'fail' | 'warn'>('warn')
  const [trackingUrl, setTrackingUrl] = useState<string>(() => process.env.NEXT_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : ''))
  const [isLive, setIsLive] = useState(false)
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [appSettings, setAppSettings] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const dripOwnerRef = useRef(`drip:${Math.random().toString(36).slice(2)}`)
  const dripBusyRef = useRef(false)

  // Create a simple showToast wrapper for backward compatibility
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    toast({
      title: message,
      variant: type === 'error' ? 'destructive' : 'default'
    })
  }

  // Check email limit and show upgrade modal
  useEffect(() => {
    const checkEmailLimit = async () => {
      if (profile?.subscription_status === 'free') {
        const { data: settings } = await supabase
          .from('app_settings')
          .select('*')
          .in('key', ['free_email_limit', 'whatsapp_number', 'contact_message'])

        if (settings) {
          const settingsObj: any = {}
          settings.forEach((s: any) => {
            try {
              settingsObj[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value
            } catch (e) {
              settingsObj[s.key] = s.value
            }
          })
          setAppSettings(settingsObj)
        }
      }
    }
    checkEmailLimit()
  }, [profile, supabase])

  // Check SMTP status
  const checkSmtpStatus = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setSmtpStatus('warn')
        return
      }
      const { data: latestProfile } = await supabase
        .from('profiles')
        .select('active_smtp,smtp_email,smtp_password,smtp_email_1,smtp_password_1,smtp_email_2,smtp_password_2,smtp_verified_1,smtp_verified_2')
        .eq('id', authUser.id)
        .single()

      const activeSlot = latestProfile?.active_smtp || 1
      const hasEmail = activeSlot === 1
        ? (latestProfile?.smtp_email_1 || latestProfile?.smtp_email)
        : latestProfile?.smtp_email_2
      const hasPass = activeSlot === 1
        ? (latestProfile?.smtp_password_1 || latestProfile?.smtp_password)
        : latestProfile?.smtp_password_2
      const isVerified = activeSlot === 1 ? latestProfile?.smtp_verified_1 : latestProfile?.smtp_verified_2

      if (hasEmail && hasPass && isVerified) {
        setSmtpStatus('ok')
      } else {
        setSmtpStatus('warn')
      }
    } catch {
      setSmtpStatus('warn')
    }
  }, [supabase])

  useEffect(() => {
    checkSmtpStatus()
  }, [checkSmtpStatus])

  // Restore view from ?view=&cid= so refresh stays on the same screen.
  useEffect(() => {
    if (!user) return
    const { view, cid } = parseShellSearch(window.location.search)
    if (view) {
      setCurrentPage(view as Page)
      if (view === 'detail' && cid) setSelectedCampaignId(cid)
      else setSelectedCampaignId(null)
      return
    }
    const defaultPage: Page = profile?.is_admin ? 'admin-dashboard' : isNewUser ? 'settings' : 'dashboard'
    setCurrentPage(defaultPage)
    setSelectedCampaignId(null)
    replaceShellUrl(defaultPage, null)
  }, [user, profile?.is_admin, isNewUser])

  useEffect(() => {
    const onPop = () => {
      if (!user) return
      const { view, cid } = parseShellSearch(window.location.search)
      if (view) {
        setCurrentPage(view as Page)
        if (view === 'detail' && cid) setSelectedCampaignId(cid)
        else setSelectedCampaignId(null)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [user, profile?.is_admin])

  // Live feed: Realtime + light polling only on Dashboard (avoids global re-renders every few seconds).
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage

  useEffect(() => {
    let pollTimer: number | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    type TeRow = { id: string; event_type: string; created_at: string }

    const mapRow = (r: TeRow) => ({
      id: `ev-${r.id}`,
      eventId: r.id,
      icon: r.event_type === 'open' ? '👁️' : '🔗',
      text: r.event_type === 'open' ? 'Email opened' : 'Link clicked',
      time: new Date(r.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      at: r.created_at,
    })

    const mergeRows = (rows: TeRow[], replace: boolean) => {
      if (cancelled || rows.length === 0) return
      setFeedItems((prev) => {
        const base = replace ? [] : [...prev]
        const seen = new Set(
          base.map((p: { eventId?: string }) => p.eventId).filter(Boolean) as string[]
        )
        const additions = rows.filter((r) => r.id && !seen.has(r.id)).map(mapRow)
        if (!replace && additions.length === 0) return prev
        const merged = [...additions, ...base] as typeof base
        merged.sort(
          (a: { at: string }, b: { at: string }) =>
            new Date(b.at).getTime() - new Date(a.at).getTime()
        )
        return merged.slice(0, 50)
      })
    }

    const fetchRecent = async () => {
      if (currentPageRef.current !== 'dashboard') return
      const { data } = await supabase
        .from('tracking_events')
        .select('id, event_type, created_at')
        .order('created_at', { ascending: false })
        .limit(30)
      if (data?.length) mergeRows(data as TeRow[], false)
    }

    const setup = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser || cancelled) return

      const { data: recent } = await supabase
        .from('tracking_events')
        .select('id, event_type, created_at')
        .order('created_at', { ascending: false })
        .limit(40)
      if (recent?.length) mergeRows(recent as TeRow[], true)

      channel = supabase
        .channel(`tracking-events-${authUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tracking_events',
          },
          (payload: { new: Partial<TeRow> }) => {
            const n = payload.new
            if (!n?.id || !n.created_at) return
            mergeRows(
              [
                {
                  id: n.id,
                  event_type: n.event_type || 'open',
                  created_at: n.created_at,
                },
              ],
              false
            )
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') void fetchRecent()
        })

      pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') void fetchRecent()
      }, 20_000)
    }

    void setup()

    return () => {
      cancelled = true
      if (pollTimer) window.clearInterval(pollTimer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase])

  const navigate = (page: Page, campaignId?: string) => {
    setCurrentPage(page)
    setSidebarOpen(false)
    if (page === 'detail' && campaignId) {
      setSelectedCampaignId(campaignId)
      replaceShellUrl('detail', campaignId)
    } else {
      setSelectedCampaignId(null)
      replaceShellUrl(page, null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // Privacy: auto logout on inactivity and sync activity across tabs.
  useEffect(() => {
    const markActive = () => {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    }

    const checkIdle = async () => {
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || Date.now())
      if (Date.now() - last > IDLE_LOGOUT_MS) {
        await supabase.auth.signOut({ scope: 'local' })
        toast({
          title: 'Session expired for privacy',
          description: 'You were logged out after inactivity.',
        })
      }
    }

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }))
    markActive()
    const timer = window.setInterval(() => {
      void checkIdle()
    }, 15000)

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, markActive))
      window.clearInterval(timer)
    }
  }, [supabase, toast])

  // Drip: interval must match delivery preset (was 5s → extra batches + duplicate sends).
  // dripBusyRef blocks overlapping POSTs while SMTP is still sending.
  useEffect(() => {
    if (profile?.is_admin || !user?.id) return

    let active = true
    let timeoutId: number | null = null

    const runDripTick = async () => {
      if (!active || dripBusyRef.current) return
      try {
        const guardUntil = Number(sessionStorage.getItem('bmail:user_send_guard_until') || 0)
        if (guardUntil && Date.now() < guardUntil) return
      } catch {
        /* ignore */
      }
      dripBusyRef.current = true
      try {
        const now = Date.now()
        const lockKey = 'bmail:drip-lock'
        const currentOwner = dripOwnerRef.current

        const lockRaw = localStorage.getItem(lockKey)
        const lock = lockRaw ? JSON.parse(lockRaw) as { owner?: string; ts?: number } : {}
        const preset = getDeliveryPresetFromStorage()
        const dripIntervalMs = preset.intervalMs
        const dripBatchSize = preset.batchSize

        if (lock.owner && lock.owner !== currentOwner && typeof lock.ts === 'number' && now - lock.ts < dripIntervalMs - 5000) {
          return
        }

        localStorage.setItem(lockKey, JSON.stringify({ owner: currentOwner, ts: now }))

        const { data: sendingCampaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'sending')
          .limit(1)

        if (!sendingCampaigns || sendingCampaigns.length === 0) return

        const campaign = sendingCampaigns[0]
        await fetch('/api/campaigns/send', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: campaign.id,
            userId: user.id,
            maxRecipients: dripBatchSize,
          }),
        })
      } catch (error) {
        console.error('Drip tick failed:', error)
      } finally {
        dripBusyRef.current = false
      }
    }

    const scheduleNext = () => {
      if (!active) return
      const preset = getDeliveryPresetFromStorage()
      const gap = Math.max(10_000, preset.intervalMs)
      timeoutId = window.setTimeout(() => {
        void (async () => {
          if (!active) return
          await runDripTick()
          if (!active) return
          scheduleNext()
        })()
      }, gap)
    }

    timeoutId = window.setTimeout(() => {
      void (async () => {
        if (!active) return
        await runDripTick()
        if (!active) return
        scheduleNext()
      })()
    }, 8_000)

    return () => {
      active = false
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [profile?.is_admin, supabase, user?.id])

  const openWhatsApp = () => {
    const whatsappNumber = appSettings?.whatsapp_number || '+923254139900'
    const message = 'Hi, I would like to upgrade my BmailPro account'
    const url = `https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const renderPage = () => {
    // Admin routes
    if (profile?.is_admin) {
      switch (currentPage) {
        case 'admin-dashboard':
          return <AdminDashboard onNavigate={navigate as any} showToast={showToast as any} />
        case 'admin-users':
          return <AdminUsers onNavigate={navigate as any} showToast={showToast as any} />
        case 'admin-payments':
          return <AdminPayments onNavigate={navigate as any} showToast={showToast as any} />
        case 'admin-settings':
          return <AdminSettings onNavigate={navigate as any} showToast={showToast as any} />
        case 'admin-activity':
          return <AdminActivity onNavigate={navigate as any} showToast={showToast as any} />
        default:
          return <AdminDashboard onNavigate={navigate as any} showToast={showToast as any} />
      }
    }

    // User routes
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            feedItems={feedItems}
            onNavigate={navigate}
            showToast={showToast}
          />
        )
      case 'campaigns':
        return (
          <Campaigns
            onNavigate={navigate}
            showToast={showToast}
          />
        )
      case 'contacts':
        return <ContactsDetail onNavigate={navigate} />
      case 'new':
        return (
          <NewCampaign
            onNavigate={navigate}
            showToast={showToast}
            profile={profile}
            onShowUpgrade={() => setShowUpgradeModal(true)}
          />
        )
      case 'templates':
        return (
          <Templates
            showToast={showToast}
          />
        )
      case 'settings':
        return (
          <Settings
            profile={profile}
            trackingUrl={trackingUrl}
            showToast={showToast}
          />
        )
      case 'detail':
        return (
          <CampaignDetail
            campaignId={selectedCampaignId!}
            onNavigate={navigate}
            showToast={showToast}
          />
        )
      case 'upgrade':
        return (
          <Upgrade
            profile={profile}
            showToast={showToast}
          />
        )
      default:
        return <Dashboard feedItems={feedItems} onNavigate={navigate} showToast={showToast} />
    }
  }

  return (
    <div id="appShell">
      <Sidebar
        user={user}
        profile={profile}
        currentPage={currentPage}
        onNavigate={navigate}
        onLogout={handleLogout}
        smtpStatus={smtpStatus}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-content">
        {/* Top Bar */}
        <div className="topbar">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              className="sidebar-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
              aria-controls="main-nav"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect y="3"  width="20" height="2" rx="1" fill="currentColor"/>
                <rect y="9"  width="20" height="2" rx="1" fill="currentColor"/>
                <rect y="15" width="20" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <h1 className="page-title">
              {profile?.is_admin ? (
                currentPage === 'admin-dashboard' && 'Admin Dashboard' ||
                currentPage === 'admin-users' && 'User Management' ||
                currentPage === 'admin-payments' && 'Payment Management' ||
                currentPage === 'admin-settings' && 'Admin Settings' ||
                currentPage === 'admin-activity' && 'Activity Logs'
              ) : (
                currentPage === 'dashboard' && 'Dashboard' ||
                currentPage === 'campaigns' && 'Campaigns' ||
                currentPage === 'contacts' && 'Contacts' ||
                currentPage === 'new' && 'New Campaign' ||
                currentPage === 'templates' && 'Templates' ||
                currentPage === 'settings' && 'Settings' ||
                currentPage === 'detail' && 'Campaign Details' ||
                currentPage === 'upgrade' && 'Upgrade Plan'
              )}
            </h1>
            {isLive && (
              <div className="live-pill">
                <span className="live-dot"></span>
                LIVE
              </div>
            )}
          </div>
          <time
            className="text-xs text-[var(--muted)] hidden sm:block whitespace-nowrap"
            dateTime={new Date().toISOString().split('T')[0]}
          >
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
          <time
            className="text-xs text-[var(--muted)] block sm:hidden whitespace-nowrap"
            dateTime={new Date().toISOString().split('T')[0]}
          >
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </time>
        </div>

        {/* Page Content */}
        <div className="content-area">
          {renderPage()}
        </div>
      </main>

      {/* Upgrade Modal for Free Users */}
      {profile?.subscription_status === 'free' && showUpgradeModal && appSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Upgrade Your Account</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    You've reached your free email limit of {appSettings.free_email_limit} emails per day
                  </p>
                </div>
                <button onClick={() => setShowUpgradeModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-gray-700">
                  {appSettings.contact_message}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Available Plans:</h3>
                <div className="space-y-2">
                  <div className="border rounded p-3 bg-gray-50">
                    <p className="font-medium">Monthly Plan - $10</p>
                    <p className="text-xs text-muted-foreground">Unlimited emails for 30 days</p>
                  </div>
                  <div className="border rounded p-3 bg-green-50 border-green-200">
                    <p className="font-medium">3-Month Plan - $25 (Recommended)</p>
                    <p className="text-xs text-muted-foreground">Unlimited emails for 90 days</p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={openWhatsApp}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact on WhatsApp
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowUpgradeModal(false)}
              >
                Continue with Free Plan
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toast */}
      <Toaster />
    </div>
  )
}
