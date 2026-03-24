'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle } from 'lucide-react'

interface NewCampaignProps {
  onNavigate: (page: any, id?: string) => void
  showToast: (msg: string, type?: any) => void
  profile?: any
  onShowUpgrade?: () => void
}

interface Contact {
  email: string
  name: string
}

interface AppSettings {
  free_email_limit: number
  daily_send_suggestion: number
  whatsapp_number: string
}

export default function NewCampaign({ onNavigate, showToast, profile, onShowUpgrade }: NewCampaignProps) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeTab, setActiveTab] = useState<'manual' | 'csv' | 'paste'>('manual')
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [csvMsg, setCsvMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Fetch app settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', ['free_email_limit', 'daily_send_suggestion', 'whatsapp_number'])
      
      if (data) {
        const settings: any = {}
        const parseSetting = (value: any) => {
          if (typeof value !== 'string') return value
          const trimmed = value.trim()
          // Only parse values that look like JSON literals; plain strings (like +923...)
          // should remain strings.
          const looksLikeJson =
            trimmed.startsWith('{') ||
            trimmed.startsWith('[') ||
            trimmed.startsWith('"') ||
            trimmed === 'true' ||
            trimmed === 'false' ||
            trimmed === 'null' ||
            /^-?\d+(\.\d+)?$/.test(trimmed)
          if (!looksLikeJson) return value
          try {
            return JSON.parse(trimmed)
          } catch {
            return value
          }
        }
        data.forEach(s => {
          settings[s.key] = parseSetting(s.value)
        })
        setAppSettings(settings as AppSettings)
      }
    }
    fetchSettings()
  }, [supabase])

  // Check if user has exceeded free limit
  const isFreeUser = profile?.subscription_status === 'free' || !profile?.subscription_status
  const emailsSentToday = profile?.daily_emails_sent || 0
  const freeLimit = appSettings?.free_email_limit || 5
  const remainingFreeEmails = Math.max(0, freeLimit - emailsSentToday)

  const addContact = () => {
    if (!manualEmail.includes('@')) {
      showToast('Enter a valid email')
      return
    }
    if (contacts.find(c => c.email === manualEmail)) {
      showToast('Already added')
      return
    }
    setContacts([...contacts, { email: manualEmail, name: manualName }])
    setManualEmail('')
    setManualName('')
  }

  const removeContact = (email: string) => {
    setContacts(contacts.filter(c => c.email !== email))
  }

  const loadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      let added = 0
      
      lines.forEach((line, i) => {
        const parts = line.split(',').map(p => p.trim().replace(/"/g, ''))
        const email = parts[0]
        const name = parts[1] || ''
        
        if (email && email.includes('@') && (i > 0 || !line.toLowerCase().includes('email'))) {
          if (!contacts.find(c => c.email === email)) {
            setContacts(prev => [...prev, { email, name }])
            added++
          }
        }
      })
      
      setCsvMsg(`${added} contacts loaded`)
    }
    reader.readAsText(file)
  }

  const parsePaste = () => {
    const emails = pasteText.split('\n').map(e => e.trim()).filter(e => e.includes('@'))
    return emails.length
  }

  const getAllContacts = (): Contact[] => {
    const all = [...contacts]
    if (activeTab === 'paste') {
      pasteText.split('\n')
        .map(e => e.trim())
        .filter(e => e.includes('@'))
        .forEach(email => {
          if (!all.find(c => c.email === email)) {
            all.push({ email, name: '' })
          }
        })
    }
    return all
  }

  const openWhatsApp = () => {
    const whatsappNumber = appSettings?.whatsapp_number || '+923254139900'
    const message = 'Hi, I would like to upgrade my BmailPro account to send unlimited emails.'
    const url = `https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const createCampaign = async () => {
    const allContacts = getAllContacts()
    
    if (!name) { showToast('Enter campaign name'); return }
    if (!subject) { showToast('Enter subject line'); return }
    if (!body) { showToast('Write email body'); return }
    if (!allContacts.length) { showToast('Add at least one recipient'); return }

    // Check email limit for free users
    if (isFreeUser && allContacts.length > remainingFreeEmails) {
      setShowLimitWarning(true)
      return
    }

    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Not authenticated')
      setLoading(false)
      return
    }

    // Create campaign
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        subject,
        body_html: body,
        status: 'draft',
        total_recipients: allContacts.length,
      })
      .select()
      .single()

    if (campError || !campaign) {
      showToast('Failed to create campaign')
      setLoading(false)
      return
    }

    // First, ensure contacts exist
    let linkedRecipients = 0
    for (const contact of allContacts) {
      // Try to get existing contact
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('email', contact.email)
        .single()

      let contactId: string

      if (existingContact) {
        contactId = existingContact.id
      } else {
        // Create new contact
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            email: contact.email,
            name: contact.name,
          })
          .select()
          .single()

        if (contactError || !newContact) continue
        contactId = newContact.id
      }

      // Add to campaign_contacts
      const trackingId = crypto.randomUUID().slice(0, 14)
      const { error: linkError } = await supabase
        .from('campaign_contacts')
        .insert({
          campaign_id: campaign.id,
          contact_id: contactId,
          status: 'pending',
          tracking_id: trackingId,
        })
      if (!linkError) linkedRecipients++
    }

    await supabase
      .from('campaigns')
      .update({ total_recipients: linkedRecipients })
      .eq('id', campaign.id)

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'campaign_created',
      details: { campaign_id: campaign.id, name, recipients: allContacts.length },
    })

    if (linkedRecipients === 0) {
      showToast('Campaign created, but no recipients were linked. Please check contacts and try again.', 'error')
      setLoading(false)
      onNavigate('campaigns')
      return
    }

    showToast(`Campaign created with ${linkedRecipients} recipient(s)`)
    
    if (confirm(`Campaign "${name}" created with ${linkedRecipients} recipient(s).\n\nSend now?`)) {
      const sendResponse = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, userId: user.id }),
      })
      const sendData = await sendResponse.json().catch(() => ({}))

      if (!sendResponse.ok) {
        showToast(sendData?.error || 'Campaign created, but sending failed', 'error')
      } else {
        showToast(sendData?.message || 'Campaign sent successfully', 'success')
      }
      onNavigate('dashboard')
    } else {
      onNavigate('campaigns')
    }
    
    setLoading(false)
  }

  const recipientCount = getAllContacts().length

  return (
    <div className="two-col">
      {/* Left Column - Campaign Details */}
      <div>
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="bmail-card-title">Campaign Details</div>
          </div>
          <div className="bmail-card-body">
            <div className="form-row">
              <label className="form-label">Campaign Name</label>
              <input 
                className="form-input"
                placeholder="e.g. Q1 Product Launch"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Subject Line</label>
              <input 
                className="form-input"
                placeholder="e.g. Exclusive offer, {{name}}!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <div className="form-hint">Use <code>{'{{name}}'}</code> for recipient&apos;s name.</div>
            </div>
            <div className="form-row">
              <label className="form-label">Email Body</label>
              <textarea 
                className="form-input"
                placeholder={`Hi {{name}},\n\nYour message here...\n\n<a href='https://yoursite.com'>Click here</a>\n\nRegards,\nYour Name`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
              />
              <div className="form-hint">Full HTML supported. Links are tracked automatically.</div>
            </div>
          </div>
        </div>

        {/* Email Limit Warning for Free Users */}
        {isFreeUser && appSettings && (
          <div className="bmail-card mt-4" style={{ borderColor: remainingFreeEmails === 0 ? '#ef4444' : '#f59e0b' }}>
            <div className="bmail-card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {remainingFreeEmails === 0 ? 'Daily Limit Reached' : 'Free Plan Limit'}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {remainingFreeEmails} of {freeLimit} emails remaining today
                  </p>
                </div>
                <button 
                  className="btn-bmail btn-bmail-primary text-sm"
                  onClick={openWhatsApp}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Upgrade
                </button>
              </div>
              {appSettings.daily_send_suggestion && profile?.subscription_status === 'active' && (
                <p className="text-xs text-[var(--muted)] mt-2">
                  Tip: We suggest sending max {appSettings.daily_send_suggestion} emails/day for best deliverability
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Recipients */}
      <div>
        <div className="bmail-card">
          <div className="bmail-card-head">
            <div className="bmail-card-title">Recipients</div>
          </div>
          <div className="bmail-card-body">
            {/* Tabs */}
            <div className="c-tabs">
              <button 
                className={`c-tab ${activeTab === 'manual' ? 'active' : ''}`}
                onClick={() => setActiveTab('manual')}
              >
                Manual
              </button>
              <button 
                className={`c-tab ${activeTab === 'csv' ? 'active' : ''}`}
                onClick={() => setActiveTab('csv')}
              >
                CSV
              </button>
              <button 
                className={`c-tab ${activeTab === 'paste' ? 'active' : ''}`}
                onClick={() => setActiveTab('paste')}
              >
                Paste
              </button>
            </div>

            {/* Tab Content */}
            <div className="mt-3">
              {/* Manual */}
              {activeTab === 'manual' && (
                <div>
                  <div className="flex gap-2 mb-3">
                    <input 
                      className="form-input"
                      placeholder="email@example.com"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <input 
                      className="form-input"
                      placeholder="Name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      style={{ flex: 1.5 }}
                    />
                    <button 
                      className="btn-bmail btn-bmail-outline text-sm"
                      onClick={addContact}
                    >
                      Add
                    </button>
                  </div>
                  <div className="min-h-[30px] flex flex-wrap">
                    {contacts.map(c => (
                      <span key={c.email} className="tag">
                        {c.name || c.email}
                        <span className="tag-x" onClick={() => removeContact(c.email)}>x</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CSV */}
              {activeTab === 'csv' && (
                <div>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={loadCSV}
                    className="w-full py-2"
                  />
                  <div className="form-hint">Column 1: email - Column 2: name (optional)</div>
                  {csvMsg && (
                    <div className="mt-2 text-sm text-[var(--accent2)] font-semibold">{csvMsg}</div>
                  )}
                </div>
              )}

              {/* Paste */}
              {activeTab === 'paste' && (
                <div>
                  <textarea 
                    className="form-input"
                    placeholder={`One email per line:\njohn@example.com\nsara@company.com`}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={5}
                  />
                  <div className="form-hint">{parsePaste()} valid email(s) detected</div>
                </div>
              )}
            </div>

            {/* Recipient Count */}
            {recipientCount > 0 && (
              <div className={`text-[13px] font-semibold mt-3 ${
                isFreeUser && recipientCount > remainingFreeEmails 
                  ? 'text-red-500' 
                  : 'text-[var(--accent)]'
              }`}>
                {isFreeUser && recipientCount > remainingFreeEmails 
                  ? `Exceeds limit! ${recipientCount} recipients, only ${remainingFreeEmails} allowed`
                  : `${recipientCount} recipient(s) ready`
                }
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button 
            className="btn-bmail btn-bmail-primary flex-1 justify-center"
            onClick={createCampaign}
            disabled={loading || (isFreeUser && remainingFreeEmails === 0)}
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
          <button 
            className="btn-bmail btn-bmail-outline"
            onClick={() => onNavigate('campaigns')}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Limit Warning Modal */}
      {showLimitWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-2">Email Limit Reached</h3>
            <p className="text-[var(--muted)] mb-4">
              You can only send {freeLimit} emails per day on the free plan. 
              You&apos;re trying to send {recipientCount} emails but only have {remainingFreeEmails} remaining.
            </p>
            <div className="bg-blue-50 p-4 rounded mb-4">
              <p className="font-semibold text-sm">Upgrade for Unlimited Emails</p>
              <p className="text-xs text-[var(--muted)]">
                Contact us on WhatsApp to upgrade your account
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                className="btn-bmail btn-bmail-primary flex-1"
                onClick={() => {
                  openWhatsApp()
                  setShowLimitWarning(false)
                }}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Contact on WhatsApp
              </button>
              <button 
                className="btn-bmail btn-bmail-outline"
                onClick={() => setShowLimitWarning(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
