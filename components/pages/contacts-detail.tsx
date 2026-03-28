'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, getCurrentUserSafe } from '@/lib/supabase/client'

interface ContactRow {
  id: string
  email: string
  name: string | null
  is_unsubscribed: boolean
  created_at: string
  campaign_contacts?: Array<{
    status: string
    sent_at: string | null
    opened_at: string | null
    campaigns?: { name: string } | null
  }>
}

interface ContactMetric {
  id: string
  email: string
  name: string
  createdAt: string
  isUnsubscribed: boolean
  totalCampaigns: number
  totalSent: number
  totalOpened: number
  lastCampaignName: string
  lastSentAt: string | null
}

export default function ContactsDetail({ onNavigate }: { onNavigate: (page: any) => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<ContactMetric[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const user = await getCurrentUserSafe(supabase, 10000)
        if (!user) {
          setRows([])
          return
        }

        const { data } = await supabase
          .from('contacts')
          .select('id,email,name,is_unsubscribed,created_at,campaign_contacts(status,sent_at,opened_at,campaigns(name))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        const mapped = ((data || []) as ContactRow[]).map((c) => {
          const stats = c.campaign_contacts || []
          const sentCount = stats.filter((s) => ['sent', 'opened', 'clicked'].includes(s.status)).length
          const openedCount = stats.filter((s) => !!s.opened_at).length
          const sorted = [...stats].sort((a, b) => {
            const bt = b.sent_at ? new Date(b.sent_at).getTime() : 0
            const at = a.sent_at ? new Date(a.sent_at).getTime() : 0
            return bt - at
          })
          const last = sorted[0]

          return {
            id: c.id,
            email: c.email,
            name: c.name || '',
            createdAt: c.created_at,
            isUnsubscribed: !!c.is_unsubscribed,
            totalCampaigns: stats.length,
            totalSent: sentCount,
            totalOpened: openedCount,
            lastCampaignName: last?.campaigns?.name || '—',
            lastSentAt: last?.sent_at || null,
          }
        })

        setRows(mapped)
      } catch (error) {
        console.error('Failed to load contacts detail:', error)
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [supabase])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }, [rows, search])

  if (loading) {
    return <div className="text-center py-10 text-[var(--muted)]">Loading contacts details...</div>
  }

  return (
    <div className="bmail-card">
      <div className="bmail-card-head">
        <div className="bmail-card-title">👥 Contacts Detail</div>
        <button className="btn-bmail btn-bmail-primary text-sm" onClick={() => onNavigate('new')}>
          + New Campaign
        </button>
      </div>
      <div className="bmail-card-body">
        <div className="mb-4">
          <input
            className="form-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3 className="font-semibold mb-2">No contacts found</h3>
            <p className="text-sm">Add contacts from New Campaign or Contacts import.</p>
          </div>
        ) : (
          <div className="bmail-table-wrap">
            <table className="bmail-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Campaigns Used</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Last Campaign</th>
                  <th>Last Sent</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-semibold">{r.name || r.email}</div>
                      <div className="text-xs text-[var(--muted)]">{r.email}</div>
                    </td>
                    <td>{r.totalCampaigns}</td>
                    <td>{r.totalSent}</td>
                    <td>{r.totalOpened}</td>
                    <td>{r.lastCampaignName}</td>
                    <td className="text-xs text-[var(--muted)]">
                      {r.lastSentAt ? new Date(r.lastSentAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

