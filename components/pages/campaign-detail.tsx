'use client'

import { useState, useEffect, type ReactElement } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface CampaignDetailProps {
  campaignId: string
  onNavigate: (page: any) => void
  showToast: (msg: string, type?: any) => void
}

export default function CampaignDetail({ campaignId, onNavigate, showToast }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCampaign()
  }, [campaignId])

  const loadCampaign = async () => {
    // Get campaign
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (!campaignData) {
      showToast('Campaign not found')
      onNavigate('campaigns')
      return
    }

    // Get contacts
    const { data: contactsData } = await supabase
      .from('campaign_contacts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false })

    const sent = contactsData?.filter(c => ['sent', 'opened', 'clicked'].includes(c.status)).length || 0
    const opened = contactsData?.filter(c => c.opened_at).length || 0
    const clicked = contactsData?.filter(c => c.clicked_at).length || 0
    const failed = contactsData?.filter(c => c.status === 'failed').length || 0

    setCampaign({
      ...campaignData,
      total: contactsData?.length || 0,
      sent,
      opened,
      clicked,
      failed,
      open_rate: sent > 0 ? Math.round((opened / sent) * 100 * 10) / 10 : 0,
      click_rate: sent > 0 ? Math.round((clicked / sent) * 100 * 10) / 10 : 0,
    })
    setContacts(contactsData || [])
    setLoading(false)
  }

  const sendCampaign = async () => {
    if (!confirm('Send this campaign now? This cannot be undone.')) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Not authenticated', 'error')
      return
    }

    const res = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, userId: user.id }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      showToast(data?.error || 'Failed to send campaign', 'error')
      return
    }

    showToast(data?.message || 'Campaign sent', 'success')
    await supabase
      .from('campaigns')
      .update({ status: data.failed > 0 && data.sent > 0 ? 'sent' : data.sent > 0 ? 'sent' : 'failed' })
      .eq('id', campaignId)
    loadCampaign()
  }

  const resendFailed = async () => {
    if (!confirm('Resend all failed recipients for this campaign?')) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Not authenticated', 'error')
      return
    }

    const res = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, userId: user.id, includeFailed: true }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      showToast(data?.error || 'Failed to resend failed recipients', 'error')
      return
    }

    showToast(data?.message || 'Resend complete', 'success')
    loadCampaign()
  }

  const deleteCampaign = async () => {
    if (!confirm('Delete this campaign and all its data?')) return
    
    await supabase.from('campaign_contacts').delete().eq('campaign_id', campaignId)
    await supabase.from('campaigns').delete().eq('id', campaignId)
    
    showToast('🗑 Campaign deleted')
    onNavigate('campaigns')
  }

  const statusPill = (status: string) => {
    const pills: Record<string, ReactElement> = {
      pending: <span className="pill p-draft">⏳ Pending</span>,
      sent: <span className="pill p-complete">✅ Sent</span>,
      opened: <span className="pill p-purple">👁️ Opened</span>,
      clicked: <span className="pill p-running">🔗 Clicked</span>,
      failed: <span className="pill p-failed">❌ Failed</span>,
    }
    return pills[status] || <span className="pill p-draft">{status}</span>
  }

  const campaignStatusPill = (status: string) => {
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
        Loading campaign...
      </div>
    )
  }

  const pieData = [
    { name: 'Opened', value: campaign.opened, color: 'var(--accent2)' },
    { name: 'Clicked', value: campaign.clicked, color: 'var(--purple)' },
    { name: 'Unopened', value: Math.max(0, campaign.sent - campaign.opened), color: 'var(--border)' },
  ]

  return (
    <>
      {/* Back Button */}
      <button 
        className="btn-bmail btn-bmail-outline mb-4"
        onClick={() => onNavigate('campaigns')}
      >
        ← Back to Campaigns
      </button>

      {/* Header Card */}
      <div className="bmail-card mb-5">
        <div className="bmail-card-head">
          <div>
            <div className="bmail-card-title text-lg">{campaign.name}</div>
            <div className="text-sm text-[var(--muted)] mt-1">{campaign.subject}</div>
          </div>
          <div className="flex items-center gap-2">
            {campaignStatusPill(campaign.status)}
            {(campaign.status === 'draft' || campaign.status === 'sending' || campaign.status === 'failed') && (
              <button 
                className="btn-bmail btn-bmail-success text-sm"
                onClick={sendCampaign}
              >
                ▶ Send Now
              </button>
            )}
            {campaign.failed > 0 && (
              <button
                className="btn-bmail btn-bmail-outline text-sm"
                onClick={resendFailed}
              >
                ↻ Resend Failed ({campaign.failed})
              </button>
            )}
            <button 
              className="btn-bmail btn-bmail-danger text-sm"
              onClick={deleteCampaign}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card">
          <div className="stat-label">📤 Delivered</div>
          <div className="stat-val text-[var(--accent)]">{campaign.sent}</div>
          <div className="stat-sub">of {campaign.total} recipients</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">👁️ Opened</div>
          <div className="stat-val text-[var(--accent2)]">{campaign.opened}</div>
          <div className="stat-sub">{campaign.open_rate}% open rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🔗 Clicked</div>
          <div className="stat-val text-[var(--purple)]">{campaign.clicked}</div>
          <div className="stat-sub">{campaign.click_rate}% click rate</div>
        </div>
        <div className="stat-card flex items-center justify-center">
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={45}
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
        </div>
      </div>

      {/* Recipients Table */}
      <div className="bmail-card">
        <div className="bmail-card-head">
          <div className="bmail-card-title">📧 Recipients ({contacts.length})</div>
        </div>
        <div className="bmail-card-body p-0">
          <div className="overflow-x-auto">
            <table className="bmail-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Sent At</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.email}</td>
                    <td>{statusPill(c.status)}</td>
                    <td className="text-[var(--muted)] text-xs">
                      {c.sent_at ? new Date(c.sent_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      {c.opened_at ? (
                        <span className="text-[var(--accent2)] text-xs">
                          {new Date(c.opened_at).toLocaleString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {c.clicked_at ? (
                        <span className="text-[var(--purple)] text-xs">
                          {new Date(c.clicked_at).toLocaleString()}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Email Preview */}
      <div className="bmail-card mt-5">
        <div className="bmail-card-head">
          <div className="bmail-card-title">📝 Email Preview</div>
        </div>
        <div className="bmail-card-body">
          <div className="bg-white border border-[var(--border)] rounded-lg p-6">
            <div className="text-[var(--muted)] text-sm mb-2">Subject: {campaign.subject}</div>
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: campaign.body_html || '<p>No content</p>' }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
