'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/sidebar'
import Dashboard from '@/components/pages/dashboard'
import Campaigns from '@/components/pages/campaigns'
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

type Page = 'dashboard' | 'campaigns' | 'new' | 'templates' | 'settings' | 'detail' | 'upgrade' | 'admin-dashboard' | 'admin-users' | 'admin-payments' | 'admin-settings' | 'admin-activity'

interface AppShellProps {
  user: any
  profile: any
}

export default function AppShell({ user, profile }: AppShellProps) {
  // Default to admin-dashboard if user is admin, otherwise dashboard
  const [currentPage, setCurrentPage] = useState<Page>(profile?.is_admin ? 'admin-dashboard' : 'dashboard')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [smtpStatus, setSmtpStatus] = useState<'ok' | 'fail' | 'warn'>('warn')
  const [trackingUrl, setTrackingUrl] = useState<string>(() => process.env.NEXT_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : ''))
  const [isLive, setIsLive] = useState(false)
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [appSettings, setAppSettings] = useState<any>(null)
  const { toast } = useToast()
  const supabase = createClient()

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
          settings.forEach(s => {
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

  // Set up real-time subscriptions for tracking events
  useEffect(() => {
    const channel = supabase
      .channel('tracking-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracking_events',
        },
        (payload) => {
          const event = payload.new
          const icon = event.event_type === 'open' ? '👁️' : '🔗'
          const text = event.event_type === 'open'
            ? 'Email opened'
            : 'Link clicked'

          addFeedItem(icon, text)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const addFeedItem = (icon: string, text: string) => {
    const newItem = {
      id: Date.now(),
      icon,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
    setFeedItems(prev => [newItem, ...prev].slice(0, 50))
  }

  const navigate = (page: Page, campaignId?: string) => {
    setCurrentPage(page)
    if (campaignId) {
      setSelectedCampaignId(campaignId)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

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
      />

      <main className="main-content">
        {/* Top Bar */}
        <div className="topbar">
          <div className="flex items-center gap-3">
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
          <div className="text-sm text-[var(--muted)]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
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
