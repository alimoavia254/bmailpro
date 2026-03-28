'use client'

import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { createClient, getCurrentUserSafe } from '@/lib/supabase/client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getDeliveryPresetFromStorage } from '@/lib/delivery-speed'
import { useConfirm } from '@/components/ui/confirm-modal'

interface CampaignDetailProps {
  campaignId: string
  onNavigate: (page: any) => void
  showToast: (msg: string, type?: any) => void
}

export default function CampaignDetail({ campaignId, onNavigate, showToast }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const { confirm, modal } = useConfirm()
  const supabase = createClient()

  const loadCampaign = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const user = await getCurrentUserSafe(supabase, 10000)
      if (!user) {
        showToast('Session expired. Please login again.', 'error')
        onNavigate('dashboard')
        return
      }

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
        .select('*, contacts(email, name)')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })

      const normalizedContacts = (contactsData || []).map((c: any) => ({
        ...c,
        display_email: c.email || c.contacts?.email || '',
        display_name: c.contacts?.name || '',
      }))

      const sent = normalizedContacts.filter((c: any) => ['sent', 'opened', 'clicked'].includes(c.status)).length || 0
      const uniqueOpened =
        normalizedContacts.filter(
          (c: any) => (c.open_count ?? 0) > 0 || c.opened_at
        ).length || 0
      const totalOpenEvents = normalizedContacts.reduce(
        (s, c: any) => s + (typeof c.open_count === 'number' ? c.open_count : 0),
        0
      )
      const clicked = normalizedContacts.filter((c: any) => c.clicked_at).length || 0
      const failed = normalizedContacts.filter((c: any) => c.status === 'failed').length || 0
      const pending = normalizedContacts.filter((c: any) => c.status === 'pending').length || 0

      // Auto-heal: derive the real status from actual contact states.
      // Fixes campaigns stuck in 'sending' that the API may not have finalized.
      let derivedStatus = campaignData.status
      if (campaignData.status === 'sending' && pending === 0 && normalizedContacts.length > 0) {
        derivedStatus = sent > 0 ? 'sent' : failed > 0 ? 'failed' : 'sent'
      }
      // If DB already reflects a final state, trust it
      if (['sent', 'failed', 'draft'].includes(campaignData.status)) {
        derivedStatus = campaignData.status
      }

      // Stuck "sending": marked sending but zero progress (common when Vercel times out mid-request).
      const STUCK_MS = 3 * 60 * 1000
      const updatedAtMs = campaignData.updated_at
        ? new Date(campaignData.updated_at).getTime()
        : 0
      const looksStuckSending =
        campaignData.status === 'sending' &&
        normalizedContacts.length > 0 &&
        pending === normalizedContacts.length &&
        sent === 0 &&
        failed === 0 &&
        updatedAtMs > 0 &&
        Date.now() - updatedAtMs > STUCK_MS

      if (looksStuckSending) {
        await supabase.from('campaigns').update({ status: 'draft' }).eq('id', campaignId)
        derivedStatus = 'draft'
        if (!silent) {
          showToast(
            'Previous send timed out or failed before any email went out. Campaign moved back to draft — tap Send again.',
            'error'
          )
        }
      }

      if (derivedStatus !== campaignData.status && !looksStuckSending) {
        void supabase.from('campaigns').update({ status: derivedStatus }).eq('id', campaignId)
      }

      setCampaign({
        ...campaignData,
        status: derivedStatus,
        total: normalizedContacts.length || 0,
        sent,
        opened: uniqueOpened,
        total_opens: totalOpenEvents,
        clicked,
        failed,
        open_rate: sent > 0 ? Math.round((uniqueOpened / sent) * 100 * 10) / 10 : 0,
        click_rate: sent > 0 ? Math.round((clicked / sent) * 100 * 10) / 10 : 0,
      })
      setContacts(normalizedContacts)
    } catch (error) {
      console.error('Failed to load campaign detail:', error)
      showToast('Failed to load campaign details', 'error')
    } finally {
      setLoading(false)
    }
  }, [campaignId, supabase, onNavigate, showToast])

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null
    const bump = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        debounce = null
        void loadCampaign(true)
      }, 300)
    }

    void loadCampaign(false)

    const channel = supabase
      .channel(`campaign-detail-rt-${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        bump
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_contacts', filter: `campaign_id=eq.${campaignId}` },
        bump
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void loadCampaign(true)
        }
      })

    const pollMs = 7000
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadCampaign(true)
      }
    }, pollMs)

    return () => {
      if (debounce) clearTimeout(debounce)
      void supabase.removeChannel(channel)
      window.clearInterval(poll)
    }
  }, [campaignId, supabase, loadCampaign])

  const sendCampaign = async () => {
    if (isSending) return  // Prevent double-click
    const ok = await confirm({ title: 'Send Campaign', message: 'Send this campaign now? This cannot be undone.', confirmLabel: 'Send Now', variant: 'success' })
    if (!ok) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Not authenticated', 'error')
      return
    }

    setIsSending(true)
    try {
      const preset = getDeliveryPresetFromStorage()
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, userId: user.id, maxRecipients: preset.batchSize }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg =
          data?.error ||
          (res.status === 504 || res.status === 502
            ? 'Server timed out while sending. On Vercel, upgrade plan or reduce batch size; campaign may be stuck on “Sending” for a few minutes then reset to draft.'
            : 'Failed to send campaign')
        showToast(msg, 'error')
        loadCampaign(true)
        return
      }

      if (data?.mode === 'drip') {
        showToast(`Campaign started. ${preset.label} mode active (~${preset.approxPerMinute}/min).`, 'success')
      } else {
        showToast(data?.message || 'Campaign sent', 'success')
      }
      loadCampaign(true)
    } finally {
      setIsSending(false)
    }
  }

  const resendFailed = async () => {
    if (isResending) return  // Prevent double-click
    const ok = await confirm({ title: 'Resend Failed', message: 'Resend emails to all failed recipients for this campaign?', confirmLabel: 'Resend', variant: 'default' })
    if (!ok) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Not authenticated', 'error')
      return
    }

    setIsResending(true)
    try {
      const preset = getDeliveryPresetFromStorage()
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, userId: user.id, includeFailed: true, maxRecipients: preset.batchSize }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        showToast(data?.error || 'Failed to resend failed recipients', 'error')
        return
      }

      showToast(data?.message || 'Resend complete', 'success')
      loadCampaign(true)
    } finally {
      setIsResending(false)
    }
  }

  const duplicateCampaign = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Not authenticated', 'error')
      return
    }

    const res = await fetch('/api/campaigns/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(data?.error || 'Failed to duplicate campaign', 'error')
      return
    }
    showToast(data?.message || 'Campaign duplicated', 'success')
    onNavigate('campaigns')
  }

  const deleteCampaign = async () => {
    const ok = await confirm({ title: 'Delete Campaign', message: 'Delete this campaign and all its data? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
    
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
    { name: 'Unopened', value: Math.max(0, campaign.sent - (campaign.opened || 0)), color: 'var(--border)' },
  ]

  const canContinueSend =
    campaign.status === 'draft' ||
    campaign.status === 'failed' ||
    (campaign.status === 'sending' &&
      campaign.total > 0 &&
      campaign.sent + campaign.failed < campaign.total)

  return (
    <>
      {modal}
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

            {canContinueSend && (
              <button
                className="btn-bmail btn-bmail-success text-sm"
                onClick={sendCampaign}
                disabled={isSending}
                style={{ opacity: isSending ? 0.6 : 1, cursor: isSending ? 'not-allowed' : 'pointer' }}
              >
                {isSending
                  ? '⏳ Sending...'
                  : campaign.status === 'sending'
                    ? '▶ Continue sending'
                    : '▶ Send Now'}
              </button>
            )}

            {campaign.status === 'sending' && !isSending && !canContinueSend && (
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <svg
                  className="animate-spin"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Finalizing…
              </span>
            )}
            <button
              className="btn-bmail btn-bmail-outline text-sm"
              onClick={duplicateCampaign}
            >
              ⧉ Duplicate
            </button>
            {campaign.failed > 0 && (
              <button
                className="btn-bmail btn-bmail-outline text-sm"
                onClick={resendFailed}
                disabled={isResending}
                style={{ opacity: isResending ? 0.6 : 1, cursor: isResending ? 'not-allowed' : 'pointer' }}
              >
                {isResending ? '⏳ Resending...' : `↻ Resend Failed (${campaign.failed})`}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {/* Delivered */}
        <div className="stat-card">
          <div className="stat-label">📤 Delivered</div>
          <div style={{ fontSize: 'clamp(1.75rem,4vw,2.25rem)', fontWeight: 700, lineHeight: 1, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {campaign.sent}
          </div>
          <div className="stat-sub">of {campaign.total} recipients</div>
        </div>

        {/* Opens: total loads + unique contacts */}
        <div className="stat-card">
          <div className="stat-label">👁️ Opens</div>
          <div style={{ fontSize: 'clamp(1.75rem,4vw,2.25rem)', fontWeight: 700, lineHeight: 1, color: 'var(--accent2)', fontVariantNumeric: 'tabular-nums' }}>
            {campaign.total_opens ?? campaign.opened}
          </div>
          <div className="stat-sub">
            {campaign.opened} contacts · {campaign.open_rate}% unique rate
          </div>
        </div>

        {/* Clicked */}
        <div className="stat-card">
          <div className="stat-label">🔗 Clicked</div>
          <div style={{ fontSize: 'clamp(1.75rem,4vw,2.25rem)', fontWeight: 700, lineHeight: 1, color: 'var(--purple)', fontVariantNumeric: 'tabular-nums' }}>
            {campaign.clicked}
          </div>
          <div className="stat-sub">{campaign.click_rate}% click rate</div>
        </div>

        {/* Donut chart */}
        <div className="stat-card flex items-center justify-center">
          {campaign.sent > 0 ? (
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={45} paddingAngle={2} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', lineHeight: 1 }}>📊</div>
              <div className="stat-sub mt-1">No data yet</div>
            </div>
          )}
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
                  <th>Opens</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium">{c.display_name || c.display_email || 'Unknown recipient'}</div>
                      <div className="text-xs text-[var(--muted)]">{c.display_email || '—'}</div>
                    </td>
                    <td>{statusPill(c.status)}</td>
                    <td className="text-[var(--muted)] text-xs">
                      {c.sent_at ? new Date(c.sent_at).toLocaleString() : '—'}
                    </td>
                    <td className="text-xs font-medium tabular-nums">
                      {c.open_count ?? 0}
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
