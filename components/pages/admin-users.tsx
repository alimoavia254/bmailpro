'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, UserCheck, UserX, Mail, Shield, Clock, Trash2, Edit, MoreVertical, Ban, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface AdminUsersProps {
  onNavigate: (page: string) => void
  showToast: (msg: string, type?: string) => void
}

interface User {
  id: string
  email: string
  full_name: string
  subscription_status: string
  subscription_tier: string
  subscription_plan: string
  subscription_start_date: string
  subscription_end_date: string
  is_admin: boolean
  is_active: boolean
  can_send_bulk: boolean
  daily_email_limit: number
  daily_emails_sent: number
  total_emails_sent: number
  created_at: string
  notes: string
}

export default function AdminUsers({ onNavigate, showToast }: AdminUsersProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [plans, setPlans] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
    fetchPlans()
  }, [search, statusFilter])

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (data) setPlans(data)
  }

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      } else {
        const errData = await response.json().catch(() => ({}))
        console.error('Fetch users error details:', errData)
        showToast(errData.error || 'Failed to load users from API', 'error')
      }
    } catch (error) {
      showToast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (userId: string, action: string, data?: any) => {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, action, data })
      })

      if (response.ok) {
        showToast('Action completed successfully', 'success')
        fetchUsers()
        if (action !== 'update_notes') {
          setShowModal(false)
          setSelectedUser(null)
        }
      } else {
        const error = await response.json()
        showToast(error.error || 'Action failed', 'error')
      }
    } catch (error) {
      showToast('Error performing action', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'p-complete'
      case 'pending': return 'p-running'
      case 'expired': return 'p-failed'
      default: return 'p-draft'
    }
  }

  const getDaysRemaining = (endDate: string) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const now = new Date()
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  // User Stats Summary
  const stats = {
    total: users.length,
    active: users.filter(u => u.subscription_status === 'active').length,
    pending: users.filter(u => u.subscription_status === 'pending').length,
    free: users.filter(u => u.subscription_status === 'inactive' || !u.subscription_status).length,
    admins: users.filter(u => u.is_admin).length,
    blocked: users.filter(u => !u.is_active).length
  }

  const UserModal = () => {
    if (!selectedUser) return null
    const daysRemaining = getDaysRemaining(selectedUser.subscription_end_date)
    
    return (
      <div className="modal-overlay" onClick={() => { setShowModal(false); setEditMode(false) }}>
        <div className="modal-box max-w-2xl" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>User Management</h3>
            <button onClick={() => { setShowModal(false); setEditMode(false) }}>&times;</button>
          </div>
          <div className="modal-body">
            {/* User Header */}
            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-[var(--border)]">
              <div className="w-16 h-16 rounded-full bg-[var(--accent-bg)] flex items-center justify-center text-2xl font-bold text-[var(--accent)]">
                {selectedUser.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold">{selectedUser.full_name || 'No Name'}</h4>
                <p className="text-[var(--muted)]">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`pill ${getStatusColor(selectedUser.subscription_status)}`}>
                    {selectedUser.subscription_status?.toUpperCase() || 'FREE'}
                  </span>
                  {selectedUser.is_admin && (
                    <span className="pill p-purple">ADMIN</span>
                  )}
                  {!selectedUser.is_active && (
                    <span className="pill p-failed">BLOCKED</span>
                  )}
                  {selectedUser.can_send_bulk && (
                    <span className="pill p-complete">BULK ENABLED</span>
                  )}
                </div>
              </div>
              <div className="text-right text-sm text-[var(--muted)]">
                <p>Joined {formatDate(selectedUser.created_at)}</p>
                {selectedUser.subscription_end_date && (
                  <p className={daysRemaining && daysRemaining < 7 ? 'text-red-500 font-semibold' : ''}>
                    {daysRemaining && daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'}
                  </p>
                )}
              </div>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-[var(--surface)] rounded-lg">
                <p className="text-2xl font-bold text-[var(--accent)]">{selectedUser.total_emails_sent || 0}</p>
                <p className="text-xs text-[var(--muted)]">Total Emails</p>
              </div>
              <div className="text-center p-3 bg-[var(--surface)] rounded-lg">
                <p className="text-2xl font-bold text-[var(--accent2)]">{selectedUser.daily_emails_sent || 0}</p>
                <p className="text-xs text-[var(--muted)]">Today</p>
              </div>
              <div className="text-center p-3 bg-[var(--surface)] rounded-lg">
                <p className="text-2xl font-bold">{selectedUser.daily_email_limit === -1 ? '∞' : selectedUser.daily_email_limit || 5}</p>
                <p className="text-xs text-[var(--muted)]">Daily Limit</p>
              </div>
              <div className="text-center p-3 bg-[var(--surface)] rounded-lg">
                <p className="text-2xl font-bold">{selectedUser.subscription_tier || 'free'}</p>
                <p className="text-xs text-[var(--muted)]">Plan</p>
              </div>
            </div>

            {/* Subscription Management */}
            <div className="mb-6">
              <h5 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Subscription Management
              </h5>
              <div className="grid grid-cols-2 gap-3">
                {selectedUser.subscription_status !== 'active' ? (
                  <>
                    {plans.map(plan => (
                      <button 
                        key={plan.id}
                        className="btn-bmail btn-bmail-primary text-sm py-2.5"
                        onClick={() => handleAction(selectedUser.id, 'activate_subscription', { 
                          plan: plan.id, 
                          durationDays: plan.duration_days,
                          dailyLimit: typeof plan.daily_limit === 'number' ? plan.daily_limit : -1
                        })}
                        disabled={actionLoading}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Activate {plan.display_name}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <button 
                      className="btn-bmail btn-bmail-outline text-sm py-2.5 text-orange-600 border-orange-300"
                      onClick={() => handleAction(selectedUser.id, 'extend_subscription', { days: 30 })}
                      disabled={actionLoading}
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Extend 30 Days
                    </button>
                    <button 
                      className="btn-bmail btn-bmail-outline text-sm py-2.5 text-red-500 border-red-300"
                      onClick={() => handleAction(selectedUser.id, 'deactivate_subscription')}
                      disabled={actionLoading}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Deactivate Subscription
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Permissions & Access */}
            <div className="mb-6">
              <h5 className="font-semibold mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                Permissions & Access
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  className={`btn-bmail text-sm py-2.5 ${selectedUser.can_send_bulk ? 'btn-bmail-outline text-orange-600 border-orange-300' : 'btn-bmail-primary'}`}
                  onClick={() => handleAction(selectedUser.id, 'toggle_bulk_access')}
                  disabled={actionLoading}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  {selectedUser.can_send_bulk ? 'Disable Bulk Emails' : 'Enable Bulk Emails'}
                </button>
                <button 
                  className={`btn-bmail text-sm py-2.5 ${selectedUser.is_active ? 'btn-bmail-outline text-red-500 border-red-300' : 'btn-bmail-primary'}`}
                  onClick={() => handleAction(selectedUser.id, 'toggle_active')}
                  disabled={actionLoading}
                >
                  {selectedUser.is_active ? <Ban className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  {selectedUser.is_active ? 'Block User' : 'Unblock User'}
                </button>
                <button 
                  className={`btn-bmail text-sm py-2.5 ${selectedUser.is_admin ? 'btn-bmail-outline text-purple-600 border-purple-300' : 'btn-bmail-outline'}`}
                  onClick={() => handleAction(selectedUser.id, 'toggle_admin')}
                  disabled={actionLoading}
                >
                  <Shield className="w-4 h-4 mr-1" />
                  {selectedUser.is_admin ? 'Remove Admin' : 'Make Admin'}
                </button>
                <button 
                  className="btn-bmail btn-bmail-outline text-sm py-2.5"
                  onClick={() => handleAction(selectedUser.id, 'reset_daily_limit')}
                  disabled={actionLoading}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reset Daily Count
                </button>
              </div>
            </div>

            {/* Custom Email Limit */}
            <div className="mb-6">
              <h5 className="font-semibold mb-3">Custom Daily Limit</h5>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="bmail-input flex-1"
                  placeholder="Enter limit (-1 for unlimited)"
                  defaultValue={selectedUser.daily_email_limit || 5}
                  onChange={e => setEditData({ ...editData, daily_email_limit: parseInt(e.target.value) })}
                />
                <button 
                  className="btn-bmail btn-bmail-primary"
                  onClick={() =>
                    handleAction(selectedUser.id, 'set_daily_limit', {
                      daily_email_limit:
                        Number.isFinite(editData.daily_email_limit)
                          ? editData.daily_email_limit
                          : selectedUser.daily_email_limit,
                    })
                  }
                  disabled={actionLoading}
                >
                  Set Limit
                </button>
              </div>
            </div>

            {/* Admin Notes */}
            <div>
              <h5 className="font-semibold mb-3">Admin Notes</h5>
              <textarea
                className="bmail-input w-full"
                rows={3}
                placeholder="Add private notes about this user..."
                defaultValue={selectedUser.notes || ''}
                onChange={e => setEditData({ ...editData, notes: e.target.value })}
              />
              <button 
                className="btn-bmail btn-bmail-outline text-sm mt-2"
                onClick={() => handleAction(selectedUser.id, 'update_notes', editData)}
                disabled={actionLoading}
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-val text-[var(--accent)]">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-val text-[var(--accent2)]">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-val text-[var(--warning)]">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Free</div>
          <div className="stat-val text-[var(--muted)]">{stats.free}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Admins</div>
          <div className="stat-val text-[var(--purple)]">{stats.admins}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Blocked</div>
          <div className="stat-val text-red-500">{stats.blocked}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search by email or name..."
            className="bmail-input w-full pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bmail-input w-[180px]"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Users</option>
          <option value="active">Active Subscribers</option>
          <option value="pending">Pending Payment</option>
          <option value="inactive">Free Users</option>
          <option value="expired">Expired</option>
        </select>
        <button 
          className="btn-bmail btn-bmail-outline"
          onClick={fetchUsers}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Users Table */}
      <div className="bmail-card">
        <div className="bmail-card-head">
          <div className="bmail-card-title">
            User Accounts
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">
              ({users.length} {statusFilter !== 'all' ? statusFilter : 'total'})
            </span>
          </div>
        </div>
        <div className="bmail-card-body p-0">
          {loading ? (
            <div className="text-center py-12 text-[var(--muted)]">Loading users...</div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="bmail-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Plan</th>
                    <th>Emails</th>
                    <th>Bulk</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const daysRemaining = getDaysRemaining(user.subscription_end_date)
                    return (
                      <tr key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[var(--accent-bg)] flex items-center justify-center text-sm font-bold text-[var(--accent)]">
                              {user.email?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-[13px] flex items-center gap-1">
                                {user.email}
                                {user.is_admin && <Shield className="w-3 h-3 text-[var(--purple)]" />}
                              </div>
                              <div className="text-xs text-[var(--muted)]">{user.full_name || 'No name'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`pill ${getStatusColor(user.subscription_status)}`}>
                            {user.subscription_status?.toUpperCase() || 'FREE'}
                          </span>
                          {daysRemaining !== null && daysRemaining > 0 && daysRemaining < 7 && (
                            <span className="text-xs text-red-500 block">{daysRemaining}d left</span>
                          )}
                        </td>
                        <td className="capitalize">{user.subscription_tier || 'free'}</td>
                        <td>
                          <span className="font-semibold">{user.total_emails_sent || 0}</span>
                          <span className="text-xs text-[var(--muted)]"> / {user.daily_emails_sent || 0} today</span>
                        </td>
                        <td>
                          {user.can_send_bulk ? (
                            <span className="text-[var(--accent2)]"><CheckCircle className="w-4 h-4" /></span>
                          ) : (
                            <span className="text-[var(--muted)]"><XCircle className="w-4 h-4" /></span>
                          )}
                        </td>
                        <td className="text-xs text-[var(--muted)]">{formatDate(user.created_at)}</td>
                        <td>
                          <button 
                            className="btn-bmail btn-bmail-primary text-xs py-1.5 px-3"
                            onClick={() => { setSelectedUser(user); setShowModal(true); setEditData({}) }}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state py-12">
              <div className="empty-icon text-4xl mb-2">👤</div>
              <p className="text-[var(--muted)]">No users found</p>
            </div>
          )}
        </div>
      </div>

      {showModal && <UserModal />}
    </>
  )
}
