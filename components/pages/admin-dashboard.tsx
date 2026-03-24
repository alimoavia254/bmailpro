'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminDashboardProps {
  onNavigate: (page: string) => void
  showToast: (msg: string, type?: string) => void
}

interface AdminStats {
  totalUsers: number
  activeSubscribers: number
  pendingPayments: number
  freeUsers: number
  totalEmailsSent: number
  monthlyRevenue: number
  pendingRequests: number
  totalCampaigns: number
  sentCampaigns: number
}

export default function AdminDashboard({ onNavigate, showToast }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchAdminStats()
  }, [])

  const fetchAdminStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setRecentUsers(data.recentUsers || [])
        setPendingPayments(data.pendingPayments || [])
      } else {
        showToast('Failed to load admin stats', 'error')
      }
    } catch (error) {
      console.error('Admin stats error:', error)
      showToast('Error loading admin dashboard', 'error')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-[var(--muted)]">
        Loading admin dashboard...
      </div>
    )
  }

  return (
    <>
      {/* Admin Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-val text-[var(--accent)]">{stats?.totalUsers || 0}</div>
          <div className="stat-sub">Registered accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Subscribers</div>
          <div className="stat-val text-[var(--accent2)]">{stats?.activeSubscribers || 0}</div>
          <div className="stat-sub">Paid users</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Payments</div>
          <div className="stat-val text-[var(--warning)]">{stats?.pendingRequests || 0}</div>
          <div className="stat-sub">Awaiting approval</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Revenue</div>
          <div className="stat-val text-[var(--purple)]">${stats?.monthlyRevenue?.toFixed(2) || '0.00'}</div>
          <div className="stat-sub">From subscriptions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Emails</div>
          <div className="stat-val text-[var(--accent)]">{stats?.totalEmailsSent?.toLocaleString() || 0}</div>
          <div className="stat-sub">All users combined</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <button 
          className="btn-bmail btn-bmail-primary py-4 flex items-center justify-center gap-2"
          onClick={() => onNavigate('admin-payments')}
        >
          <span>Review Payments</span>
          {(stats?.pendingRequests || 0) > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {stats?.pendingRequests}
            </span>
          )}
        </button>
        <button 
          className="btn-bmail btn-bmail-outline py-4"
          onClick={() => onNavigate('admin-users')}
        >
          Manage Users
        </button>
        <button 
          className="btn-bmail btn-bmail-outline py-4"
          onClick={() => onNavigate('admin-settings')}
        >
          Edit Plans & Pricing
        </button>
        <button 
          className="btn-bmail btn-bmail-outline py-4"
          onClick={() => onNavigate('admin-activity')}
        >
          View Activity Logs
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Users */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="bmail-card-title">Recent Users</div>
            <button 
              className="btn-bmail btn-bmail-outline text-xs py-1 px-3"
              onClick={() => onNavigate('admin-users')}
            >
              View All
            </button>
          </div>
          <div className="bmail-card-body p-0">
            {recentUsers.length > 0 ? (
              <table className="bmail-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Emails</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.slice(0, 5).map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="font-semibold text-[13px]">{user.email}</div>
                        <div className="text-xs text-[var(--muted)]">{user.full_name || 'No name'}</div>
                      </td>
                      <td>
                        <span className={`pill ${
                          user.subscription_status === 'active' ? 'p-complete' : 
                          user.subscription_status === 'pending' ? 'p-running' : 'p-draft'
                        }`}>
                          {user.subscription_status === 'active' ? user.subscription_tier?.toUpperCase() : 
                           user.subscription_status === 'pending' ? 'PENDING' : 'FREE'}
                        </span>
                      </td>
                      <td>{user.total_emails_sent || 0}</td>
                      <td className="text-xs text-[var(--muted)]">{formatDate(user.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state py-8">
                <p className="text-sm">No users yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="bmail-card-title">
              Pending Payments
              {(stats?.pendingRequests || 0) > 0 && (
                <span className="ml-2 bg-[var(--warning)] text-white px-2 py-0.5 rounded-full text-xs">
                  {stats?.pendingRequests}
                </span>
              )}
            </div>
            <button 
              className="btn-bmail btn-bmail-outline text-xs py-1 px-3"
              onClick={() => onNavigate('admin-payments')}
            >
              View All
            </button>
          </div>
          <div className="bmail-card-body p-0">
            {pendingPayments.length > 0 ? (
              <table className="bmail-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.slice(0, 5).map(payment => (
                    <tr key={payment.id} className="cursor-pointer" onClick={() => onNavigate('admin-payments')}>
                      <td>
                        <div className="font-semibold text-[13px]">{payment.profiles?.email}</div>
                      </td>
                      <td>
                        <span className="pill p-running">{payment.plan_name?.toUpperCase()}</span>
                      </td>
                      <td className="font-bold text-[var(--accent2)]">${payment.amount}</td>
                      <td className="text-xs text-[var(--muted)]">{formatDate(payment.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state py-8">
                <div className="empty-icon text-3xl">💳</div>
                <p className="text-sm">No pending payments</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Platform Stats Summary */}
      <div className="bmail-card mt-5">
        <div className="bmail-card-head">
          <div className="bmail-card-title">Platform Summary</div>
        </div>
        <div className="bmail-card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[var(--accent)]">{stats?.totalCampaigns || 0}</div>
              <div className="text-xs text-[var(--muted)]">Total Campaigns</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--accent2)]">{stats?.sentCampaigns || 0}</div>
              <div className="text-xs text-[var(--muted)]">Sent Campaigns</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--purple)]">{stats?.freeUsers || 0}</div>
              <div className="text-xs text-[var(--muted)]">Free Users</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--warning)]">
                {stats?.totalUsers ? Math.round((stats.activeSubscribers / stats.totalUsers) * 100) : 0}%
              </div>
              <div className="text-xs text-[var(--muted)]">Conversion Rate</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
