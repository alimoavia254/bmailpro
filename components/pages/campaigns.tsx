'use client'

import { useState, useEffect, type ReactElement } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CampaignsProps {
  onNavigate: (page: any, id?: string) => void
  showToast: (msg: string, type?: any) => void
}

export default function Campaigns({ onNavigate, showToast }: CampaignsProps) {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: campaignsData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Get contacts for each campaign
    const { data: contactsData } = await supabase
      .from('campaign_contacts')
      .select('*, campaigns!inner(user_id)')
      .eq('campaigns.user_id', user.id)

    const processedCampaigns = (campaignsData || []).map(camp => {
      const campContacts = contactsData?.filter(c => c.campaign_id === camp.id) || []
      const sent = campContacts.filter(c => ['sent', 'opened', 'clicked'].includes(c.status)).length
      const opened = campContacts.filter(c => c.opened_at).length
      const clicked = campContacts.filter(c => c.clicked_at).length
      const failed = campContacts.filter(c => c.status === 'failed').length
      return {
        ...camp,
        total: campContacts.length,
        sent,
        opened,
        clicked,
        failed,
        open_rate: sent > 0 ? Math.round((opened / sent) * 100 * 10) / 10 : 0,
        click_rate: sent > 0 ? Math.round((clicked / sent) * 100 * 10) / 10 : 0,
      }
    })

    setCampaigns(processedCampaigns)
    setLoading(false)
  }

  const sendCampaign = async (id: string) => {
    if (!confirm('Send this campaign now? This cannot be undone.')) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Not authenticated', 'error')
      return
    }

    const res = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: id, userId: user.id }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      showToast(data?.error || 'Failed to send campaign', 'error')
      return
    }

    showToast(data?.message || 'Campaign sent', 'success')
    loadCampaigns()
  }

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign and all its data?')) return
    
    await supabase.from('campaign_contacts').delete().eq('campaign_id', id)
    await supabase.from('campaigns').delete().eq('id', id)
    
    showToast('🗑 Campaign deleted')
    loadCampaigns()
  }

  const statusPill = (status: string) => {
    const pills: Record<string, ReactElement> = {
      draft: <span className="pill p-draft">📝 Draft</span>,
      sending: <span className="pill p-running">⚡ Sending</span>,
      sent: <span className="pill p-complete">✅ Complete</span>,
      failed: <span className="pill p-failed">❌ Failed</span>,
    }
    return pills[status] || <span className="pill p-draft">{status}</span>
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-[var(--muted)]">
        Loading campaigns...
      </div>
    )
  }

  return (
    <div className="bmail-card">
      <div className="bmail-card-head">
        <div className="bmail-card-title">📧 All Campaigns</div>
        <button 
          className="btn-bmail btn-bmail-primary text-sm"
          onClick={() => onNavigate('new')}
        >
          + New Campaign
        </button>
      </div>
      <div className="bmail-card-body p-0">
        {campaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="bmail-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Delivered</th>
                  <th>Opened</th>
                  <th>Open Rate</th>
                  <th>Clicks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-[var(--muted)]">{c.subject}</div>
                    </td>
                    <td>{statusPill(c.status)}</td>
                    <td>
                      <strong>{c.sent}</strong>
                      <span className="text-[var(--muted)]"> / {c.total}</span>
                    </td>
                    <td>{c.opened}</td>
                    <td>
                      <div className="prog-row">
                        <div className="prog-bar" style={{ width: '60px' }}>
                          <div className="prog-fill" style={{ width: `${c.open_rate}%` }}></div>
                        </div>
                        <span className={`text-xs min-w-[36px] ${c.open_rate > 30 ? 'text-[var(--accent2)]' : 'text-[var(--muted)]'}`}>
                          {c.open_rate}%
                        </span>
                      </div>
                    </td>
                    <td>{c.clicked}</td>
                    <td>
                      <div className="flex gap-[5px]">
                        <button 
                          className="btn-bmail btn-bmail-outline text-xs py-1 px-2"
                          onClick={() => onNavigate('detail', c.id)}
                        >
                          📊 Details
                        </button>
                        {(c.status === 'draft' || c.status === 'sending' || c.status === 'failed') && (
                          <button 
                            className="btn-bmail btn-bmail-success text-xs py-1 px-2"
                            onClick={() => sendCampaign(c.id)}
                          >
                            ▶ Send
                          </button>
                        )}
                        <button 
                          className="btn-bmail btn-bmail-danger text-xs py-1 px-2"
                          onClick={() => deleteCampaign(c.id)}
                        >
                          🗑
                        </button>
                      </div>
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
            <p className="text-sm mb-4">Create your first email campaign to get started</p>
            <button 
              className="btn-bmail btn-bmail-primary"
              onClick={() => onNavigate('new')}
            >
              + Create Campaign
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
