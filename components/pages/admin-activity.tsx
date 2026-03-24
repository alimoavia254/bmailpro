'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminActivityProps {
  onNavigate: (page: string) => void
  showToast: (msg: string, type?: string) => void
}

interface ActivityLog {
  id: string
  user_id: string
  action: string
  details: any
  created_at: string
  profiles?: {
    email: string
    full_name: string
  }
}

export default function AdminActivity({ onNavigate, showToast }: AdminActivityProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profiles(email, full_name)')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      showToast('Failed to load activity logs', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = !filterAction || log.action === filterAction
    return matchesSearch && matchesFilter
  })

  const uniqueActions = [...new Set(logs.map((log) => log.action))]

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      login: '🔑',
      logout: '🚪',
      campaign_sent: '📧',
      campaign_created: '📝',
      payment_approved: '💳',
      payment_rejected: '❌',
      subscription_activated: '🎉',
      subscription_deactivated: '⏹️',
      profile_updated: '👤',
      smtp_configured: '⚙️',
      settings_updated: '🔧',
      plan_updated: '📋',
    }
    return icons[action] || '📌'
  }

  const getActionPill = (action: string) => {
    const styles: Record<string, string> = {
      login: 'p-complete',
      payment_approved: 'p-complete',
      subscription_activated: 'p-complete',
      payment_rejected: 'p-failed',
      subscription_deactivated: 'p-failed',
      campaign_sent: 'p-running',
      campaign_created: 'p-draft',
    }
    return styles[action] || 'p-draft'
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by email or action..."
          className="bmail-input flex-1 min-w-[200px]"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select
          className="bmail-input w-[200px]"
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
        >
          <option value="">All Actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{formatAction(action)}</option>
          ))}
        </select>
        <button
          className="btn-bmail btn-bmail-outline"
          onClick={fetchLogs}
        >
          Refresh
        </button>
      </div>

      {/* Activity Log */}
      <div className="bmail-card">
        <div className="bmail-card-head">
          <div className="bmail-card-title">Activity Logs ({filteredLogs.length})</div>
        </div>
        <div className="bmail-card-body p-0">
          {loading ? (
            <div className="text-center py-8 text-[var(--muted)]">Loading...</div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {filteredLogs.map(log => (
                <div key={log.id} className="p-4 hover:bg-[var(--surface)] transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getActionIcon(log.action)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[13px]">
                          {log.profiles?.email || 'System'}
                        </span>
                        <span className={`pill ${getActionPill(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                      </div>
                      
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2 text-xs bg-[var(--surface)] p-2 rounded font-mono text-[var(--muted)] overflow-x-auto">
                          {Object.entries(log.details).slice(0, 3).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-[var(--accent)]">{key}:</span>{' '}
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state py-8">
              <div className="empty-icon text-3xl">📋</div>
              <p className="text-sm">No activity logs found</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
