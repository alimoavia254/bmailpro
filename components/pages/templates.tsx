'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/ui/confirm-modal'

interface TemplatesProps {
  showToast: (msg: string, type?: any) => void
}

interface Template {
  id: string
  name: string
  subject: string
  body: string
  is_default?: boolean
}

export default function Templates({ showToast }: TemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const { confirm, modal: confirmModal } = useConfirm()
  const [showModal, setShowModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [formName, setFormName] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formBody, setFormBody] = useState('')
  const supabase = createClient()

  // Default templates
  const defaultTemplates: Template[] = [
    {
      id: 'def-welcome',
      name: 'Welcome Email',
      subject: 'Welcome, {{name}}!',
      body: `<p>Hi {{name}},</p>
<p>Thank you for signing up. We're glad to have you.</p>
<p>Here's what you can do next:</p>
<ul><li>Complete your profile</li><li>Explore our features</li><li>Reach out if you need help</li></ul>
<p>Best regards,<br>The Team</p>`,
      is_default: true,
    },
    {
      id: 'def-newsletter',
      name: 'Monthly Newsletter',
      subject: 'Your monthly update — {{name}}',
      body: `<p>Hi {{name}},</p>
<p>Here's your monthly round-up.</p>
<h3>What's new</h3>
<p>Updates and highlights from this month.</p>
<h3>Tips & resources</h3>
<p>Useful links and tips for you.</p>
<p>Thanks for reading!</p>
<p>— The Team</p>`,
      is_default: true,
    },
    {
      id: 'def-product',
      name: 'Product Update',
      subject: 'New feature: something you\'ll love, {{name}}',
      body: `<p>Hi {{name}},</p>
<p>We've released a new feature we think you'll find useful.</p>
<p><strong>What's new:</strong></p>
<ul><li>Feature one</li><li>Feature two</li></ul>
<p><a href="https://yoursite.com/updates">Learn more here</a>.</p>
<p>Questions? Just reply to this email.</p>
<p>— The Team</p>`,
      is_default: true,
    },
  ]

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    // For now, just use default templates
    // In production, you'd also load user-created templates from DB
    setTemplates(defaultTemplates)
    setLoading(false)
  }

  const openNewTemplate = () => {
    setEditTemplate(null)
    setFormName('')
    setFormSubject('')
    setFormBody('')
    setShowModal(true)
  }

  const saveTemplate = async () => {
    if (!formName || !formSubject || !formBody) {
      showToast('Fill all template fields')
      return
    }

    // For now, just show success - in production, save to DB
    showToast('✅ Template saved')
    setShowModal(false)
    
    // Add to local state
    const newTemplate: Template = {
      id: `user-${Date.now()}`,
      name: formName,
      subject: formSubject,
      body: formBody,
    }
    setTemplates([newTemplate, ...templates])
  }

  const deleteTemplate = async (id: string) => {
    const ok = await confirm({ title: 'Delete Template', message: 'Delete this template? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
    setTemplates(templates.filter(t => t.id !== id))
    showToast('🗑 Template deleted')
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-[var(--muted)]">
        Loading templates...
      </div>
    )
  }

  return (
    <>
      {confirmModal}
      <div className="bmail-card">
        <div className="bmail-card-head">
          <div className="bmail-card-title">Email Templates</div>
          <button 
            className="btn-bmail btn-bmail-primary text-sm"
            onClick={openNewTemplate}
          >
            + New Template
          </button>
        </div>
        <div className="bmail-card-body">
          {templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="bmail-card m-0">
                  <div className="bmail-card-head py-3">
                    <div className="bmail-card-title text-[13px]">
                      {t.name}
                      {t.is_default && (
                        <span className="text-[10px] text-[var(--muted)] font-normal ml-2">(Default)</span>
                      )}
                    </div>
                    {!t.is_default && (
                      <button 
                        className="btn-bmail btn-bmail-danger text-[10px] py-0.5 px-2"
                        onClick={() => deleteTemplate(t.id)}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-xs text-[var(--muted)] mb-2">{t.subject}</div>
                    <div 
                      className="text-xs text-[var(--ink)] max-h-[60px] overflow-hidden opacity-70"
                      dangerouslySetInnerHTML={{ __html: t.body.replace(/<[^>]+>/g, '').slice(0, 120) + '...' }}
                    />
                    <button 
                      className="btn-bmail btn-bmail-outline text-xs w-full mt-3 justify-center"
                      onClick={() => {
                        // Copy to clipboard or open in new campaign
                        navigator.clipboard.writeText(t.body)
                        showToast('✅ Template copied to clipboard')
                      }}
                    >
                      Use This Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3 className="font-semibold mb-2">No templates yet</h3>
              <p className="text-sm">Save an email as a template while composing.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-[var(--surface)] rounded-2xl w-[600px] max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-[var(--border)] flex justify-between items-center sticky top-0 bg-[var(--surface)] z-10">
              <h3 className="font-heading font-bold text-base">New Template</h3>
              <button 
                className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--muted)] hover:bg-[var(--paper)]"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="form-row">
                <label className="form-label">Template Name</label>
                <input 
                  className="form-input"
                  placeholder="e.g. Welcome Email"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Subject</label>
                <input 
                  className="form-input"
                  placeholder="Subject line"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Body</label>
                <textarea 
                  className="form-input"
                  placeholder="Email body (HTML supported)"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={8}
                />
              </div>
            </div>
            <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2">
              <button 
                className="btn-bmail btn-bmail-outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-bmail btn-bmail-primary"
                onClick={saveTemplate}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
