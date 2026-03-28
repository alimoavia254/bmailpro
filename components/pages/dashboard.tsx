'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient, getCurrentUserSafe } from '@/lib/supabase/client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface DashboardProps {
  feedItems: any[]
  onNavigate: (page: any, id?: string) => void
  showToast: (msg: string, type?: any) => void
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    draft:   { cls: 'p-draft',    label: '📝 Draft' },
    sending: { cls: 'p-running',  label: '⚡ Sending' },
    sent:    { cls: 'p-complete', label: '✅ Complete' },
    failed:  { cls: 'p-failed',   label: '❌ Failed' },
  }
  const entry = map[status] ?? { cls: 'p-draft', label: status }
  return <span className={`pill ${entry.cls}`}>{entry.label}</span>
}

export default function Dashboard({ feedItems, onNavigate, showToast }: DashboardProps) {
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    totalSent: 0,
    totalOpened: 0,
    totalOpenEvents: 0,
    totalClicked: 0,
    openRate: 0,
    clickRate: 0,
  })
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const supabase = createClient()

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 10000): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('request_timeout')), timeoutMs)
    )
    return Promise.race([promise, timeout]) as Promise<T>
  }

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const user = await getCurrentUserSafe(supabase, 10000)
      if (!user) {
        setStats({
          totalCampaigns: 0,
          totalSent: 0,
          totalOpened: 0,
          totalOpenEvents: 0,
          totalClicked: 0,
          openRate: 0,
          clickRate: 0,
        })
        setCampaigns([])
        setDailyData([])
        return
      }

      const campaignsResult = await withTimeout(
        supabase
          .from('campaigns')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        10000
      ) as any
      const { data: campaignsData, error: campaignsError } = campaignsResult
      if (campaignsError) throw campaignsError

      const campaignIds = (campaignsData || []).map((c: any) => c.id)
      let contactsData: any[] = []
      if (campaignIds.length > 0) {
        const contactsQueryResult = await withTimeout(
          supabase
            .from('campaign_contacts')
            .select('campaign_id,status,opened_at,clicked_at,sent_at,open_count')
            .in('campaign_id', campaignIds),
          10000
        ) as any
        const { data: contactsResult, error: contactsError } = contactsQueryResult
        if (contactsError) throw contactsError
        contactsData = contactsResult || []
      }

      const totalSent = contactsData?.filter((c: any) => c.status === 'sent' || c.status === 'opened' || c.status === 'clicked').length || 0
      const totalOpenEvents =
        contactsData?.reduce((s: number, c: any) => s + (typeof c.open_count === 'number' ? c.open_count : 0), 0) || 0
      const totalOpened =
        contactsData?.filter((c: any) => (c.open_count ?? 0) > 0 || c.opened_at).length || 0
      const totalClicked = contactsData?.filter((c: any) => c.clicked_at).length || 0

      setStats({
        totalCampaigns: campaignsData?.length || 0,
        totalSent,
        totalOpened,
        totalOpenEvents,
        totalClicked,
        openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100 * 10) / 10 : 0,
        clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100 * 10) / 10 : 0,
      })

      // Process campaigns with stats
      const processedCampaigns = (campaignsData || []).map((camp: any) => {
        const campContacts = contactsData.filter((c: any) => c.campaign_id === camp.id) || []
        const sent = campContacts.filter((c: any) => ['sent', 'opened', 'clicked'].includes(c.status)).length
        const opened = campContacts.filter((c: any) => (c.open_count ?? 0) > 0 || c.opened_at).length
        const clicked = campContacts.filter((c: any) => c.clicked_at).length
        return {
          ...camp,
          total: campContacts.length,
          sent,
          opened,
          clicked,
          open_rate: sent > 0 ? Math.round((opened / sent) * 100 * 10) / 10 : 0,
          click_rate: sent > 0 ? Math.round((clicked / sent) * 100 * 10) / 10 : 0,
        }
      })

      setCampaigns(processedCampaigns.slice(0, 5))

      // Generate daily data for chart (last 7 days)
      const days: Array<{ date: string; sent: number; opened: number; clicked: number }> = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const dayContacts = contactsData?.filter((c: any) => c.sent_at?.startsWith(dateStr)) || []
        days.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sent: dayContacts.length,
          opened: dayContacts.filter((c: any) => c.opened_at).length,
          clicked: dayContacts.filter((c: any) => c.clicked_at).length,
        })
      }
      setDailyData(days)
    } catch (error) {
      console.error('Failed to load dashboard:', error)
      setLoadError('Session sync issue detected. Please retry.')
      setStats({
        totalCampaigns: 0,
        totalSent: 0,
        totalOpened: 0,
        totalOpenEvents: 0,
        totalClicked: 0,
        openRate: 0,
        clickRate: 0,
      })
      setCampaigns([])
      setDailyData([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null
    const bump = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        debounce = null
        void loadDashboard()
      }, 350)
    }

    let channel: ReturnType<typeof supabase.channel> | null = null
    let pollId = 0

    const setup = async () => {
      await loadDashboard()
      const user = await getCurrentUserSafe(supabase, 10000)
      if (!user) return

      channel = supabase
        .channel(`dashboard-rt-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'campaigns', filter: `user_id=eq.${user.id}` },
          bump
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'campaign_contacts' },
          bump
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') bump()
        })

      pollId = window.setInterval(() => {
        if (document.visibilityState === 'visible') void loadDashboard()
      }, 10000)
    }

    void setup()

    return () => {
      if (debounce) clearTimeout(debounce)
      if (channel) void supabase.removeChannel(channel)
      if (pollId) window.clearInterval(pollId)
    }
  }, [supabase, loadDashboard])

  const pieData = [
    { name: 'Opened', value: stats.totalOpened, color: 'var(--accent2)' },
    { name: 'Clicked', value: stats.totalClicked, color: 'var(--purple)' },
    { name: 'Unopened', value: Math.max(0, stats.totalSent - stats.totalOpened), color: 'var(--border)' },
  ]

  if (loading) {
    return (
      <div className="text-center py-12 text-[var(--muted)]">
        Loading dashboard...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-[var(--muted)] mb-4">{loadError}</p>
        <button className="btn-bmail btn-bmail-outline" onClick={loadDashboard}>
          Retry Dashboard
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">📊 Campaigns</div>
          <div className="stat-val text-[var(--accent)]">{stats.totalCampaigns}</div>
          <div className="stat-sub">Total created</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📤 Delivered</div>
          <div className="stat-val text-[var(--accent)]">{stats.totalSent}</div>
          <div className="stat-sub">Emails sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">👁️ Opens</div>
          <div className="stat-val text-[var(--accent2)]">{stats.totalOpenEvents}</div>
          <div className="stat-sub">
            {stats.totalOpened} unique · {stats.openRate}% rate
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🔗 Clicked</div>
          <div className="stat-val text-[var(--purple)]">{stats.totalClicked}</div>
          <div className="stat-sub">{stats.clickRate}% click rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📈 Engagement</div>
          <div className="stat-val text-[var(--accent2)]">{stats.openRate}%</div>
          <div className="stat-sub">Avg. open rate</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Line Chart */}
        <div className="bmail-card lg:col-span-2">
          <div className="bmail-card-head">
            <div className="bmail-card-title">📈 Last 7 Days Activity</div>
          </div>
          <div className="bmail-card-body" style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent2)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent2)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--surface)', 
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} 
                />
                <Area type="monotone" dataKey="sent" stroke="var(--accent)" fill="url(#colorSent)" strokeWidth={2} />
                <Area type="monotone" dataKey="opened" stroke="var(--accent2)" fill="url(#colorOpened)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="bmail-card-title">🎯 Engagement</div>
          </div>
          <div className="bmail-card-body flex items-center justify-center" style={{ height: '240px' }}>
            {stats.totalSent > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-[var(--muted)]">
                <p>No data yet</p>
                <p className="text-xs mt-1">Send your first campaign!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Campaigns */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="bmail-card-title">📧 Recent Campaigns</div>
            <button 
              className="btn-bmail btn-bmail-outline text-xs py-1 px-3"
              onClick={() => onNavigate('campaigns')}
            >
              View All
            </button>
          </div>
          <div className="bmail-card-body p-0">
            {campaigns.length > 0 ? (
              <div className="bmail-table-wrap">
              <table className="bmail-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Open Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} className="cursor-pointer" onClick={() => onNavigate('detail', c.id)}>
                      <td>
                        <div className="font-semibold text-[13px]">{c.name}</div>
                      </td>
                      <td>
                        <StatusPill status={c.status} />
                      </td>
                      <td>{c.sent}/{c.total}</td>
                      <td>
                        <span className={`font-bold ${c.open_rate > 30 ? 'text-[var(--accent2)]' : 'text-[var(--muted)]'}`}>
                          {c.open_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📧</div>
                <h3 className="font-semibold mb-2">No campaigns yet</h3>
                <p className="text-sm mb-4">Create your first email campaign</p>
                <button 
                  className="btn-bmail btn-bmail-primary"
                  onClick={() => onNavigate('new')}
                >
                  + New Campaign
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Feed */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="bmail-card-title">⚡ Live Activity Feed</div>
            <span className="text-xs text-[var(--muted)]">{feedItems.length} events</span>
          </div>
          <div className="bmail-card-body p-0 max-h-[300px] overflow-y-auto">
            {feedItems.length > 0 ? (
              feedItems.map(item => (
                <div key={item.id} className="feed-item">
                  <span className="feed-icon">{item.icon}</span>
                  <div className="feed-text">{item.text}</div>
                  <span className="feed-time">{item.time}</span>
                </div>
              ))
            ) : (
              <div className="empty-state py-8">
                <div className="empty-icon text-3xl">📡</div>
                <p className="text-sm">Waiting for activity...</p>
                <p className="text-xs mt-1">Opens and clicks will appear here in real-time</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
