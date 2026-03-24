'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, CreditCard, Phone, Shield, Mail, Edit2, Save, X, Plus, Trash2 } from 'lucide-react'

interface AdminSettingsProps {
  onNavigate: (page: string) => void
  showToast: (msg: string, type?: string) => void
}

interface SubscriptionPlan {
  id: string
  name: string
  display_name: string
  price: number
  duration_days: number
  email_limit: number
  daily_limit: number
  description: string
  features: string[]
  is_active: boolean
  sort_order: number
}

export default function AdminSettings({ onNavigate, showToast }: AdminSettingsProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [activeTab, setActiveTab] = useState<'plans' | 'payment' | 'config' | 'security'>('plans')
  const [saving, setSaving] = useState(false)
  const [newFeature, setNewFeature] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setPlans(data.plans?.map((p: any) => ({
          ...p,
          features: typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || [])
        })) || [])
        
        const settingsObj: Record<string, any> = {}
        data.settings?.forEach((s: any) => {
          try {
            settingsObj[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value
          } catch {
            settingsObj[s.key] = s.value
          }
        })
        setSettings(settingsObj)
      }
    } catch (error) {
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const savePlan = async (plan: SubscriptionPlan) => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'plan', data: plan })
      })

      if (response.ok) {
        showToast('Plan updated successfully', 'success')
        fetchData()
        setEditingPlan(null)
      } else {
        showToast('Failed to update plan', 'error')
      }
    } catch (error) {
      showToast('Error saving plan', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'settings', data: settings })
      })

      if (response.ok) {
        showToast('Settings saved successfully', 'success')
      } else {
        showToast('Failed to save settings', 'error')
      }
    } catch (error) {
      showToast('Error saving settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addFeature = () => {
    if (editingPlan && newFeature.trim()) {
      setEditingPlan({
        ...editingPlan,
        features: [...(editingPlan.features || []), newFeature.trim()]
      })
      setNewFeature('')
    }
  }

  const removeFeature = (index: number) => {
    if (editingPlan) {
      const newFeatures = [...(editingPlan.features || [])]
      newFeatures.splice(index, 1)
      setEditingPlan({ ...editingPlan, features: newFeatures })
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-[var(--muted)]">Loading settings...</div>
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          className={`btn-bmail ${activeTab === 'plans' ? 'btn-bmail-primary' : 'btn-bmail-outline'}`}
          onClick={() => setActiveTab('plans')}
        >
          <CreditCard className="w-4 h-4 mr-1" />
          Subscription Plans
        </button>
        <button
          className={`btn-bmail ${activeTab === 'payment' ? 'btn-bmail-primary' : 'btn-bmail-outline'}`}
          onClick={() => setActiveTab('payment')}
        >
          <Phone className="w-4 h-4 mr-1" />
          Payment Settings
        </button>
        <button
          className={`btn-bmail ${activeTab === 'config' ? 'btn-bmail-primary' : 'btn-bmail-outline'}`}
          onClick={() => setActiveTab('config')}
        >
          <Settings className="w-4 h-4 mr-1" />
          App Config
        </button>
        <button
          className={`btn-bmail ${activeTab === 'security' ? 'btn-bmail-primary' : 'btn-bmail-outline'}`}
          onClick={() => setActiveTab('security')}
        >
          <Shield className="w-4 h-4 mr-1" />
          Security
        </button>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div key={plan.id} className={`bmail-card ${!plan.is_active ? 'opacity-60' : ''}`}>
                <div className="bmail-card-body">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{plan.display_name}</h3>
                      <p className="text-xs text-[var(--muted)]">ID: {plan.id}</p>
                    </div>
                    <span className={`pill ${plan.is_active ? 'p-complete' : 'p-draft'}`}>
                      {plan.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div className="text-center py-4 mb-4 bg-[var(--surface)] rounded-lg">
                    <p className="text-3xl font-bold text-[var(--accent)]">${plan.price}</p>
                    <p className="text-sm text-[var(--muted)]">{plan.duration_days} days</p>
                  </div>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Email Limit:</span>
                      <span className="font-semibold">{plan.email_limit === -1 ? 'Unlimited' : plan.email_limit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Daily Limit:</span>
                      <span className="font-semibold">{plan.daily_limit === -1 ? 'Unlimited' : plan.daily_limit}</span>
                    </div>
                  </div>

                  <p className="text-sm text-[var(--muted)] mb-4">{plan.description}</p>

                  <button
                    className="btn-bmail btn-bmail-outline w-full"
                    onClick={() => setEditingPlan(plan)}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit Plan
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit Plan Modal */}
          {editingPlan && (
            <div className="modal-overlay" onClick={() => setEditingPlan(null)}>
              <div className="modal-box max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Edit Plan: {editingPlan.display_name}</h3>
                  <button onClick={() => setEditingPlan(null)}>&times;</button>
                </div>
                <div className="modal-body max-h-[70vh] overflow-y-auto">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-[var(--muted)]">Plan ID</label>
                        <input
                          className="bmail-input w-full mt-1"
                          value={editingPlan.id}
                          disabled
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted)]">Display Name</label>
                        <input
                          className="bmail-input w-full mt-1"
                          value={editingPlan.display_name}
                          onChange={e => setEditingPlan({ ...editingPlan, display_name: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-[var(--muted)]">Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="bmail-input w-full mt-1"
                          value={editingPlan.price}
                          onChange={e => setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted)]">Duration (days)</label>
                        <input
                          type="number"
                          className="bmail-input w-full mt-1"
                          value={editingPlan.duration_days}
                          onChange={e => setEditingPlan({ ...editingPlan, duration_days: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-[var(--muted)]">Email Limit (-1 = unlimited)</label>
                        <input
                          type="number"
                          className="bmail-input w-full mt-1"
                          value={editingPlan.email_limit}
                          onChange={e => setEditingPlan({ ...editingPlan, email_limit: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted)]">Daily Limit (-1 = unlimited)</label>
                        <input
                          type="number"
                          className="bmail-input w-full mt-1"
                          value={editingPlan.daily_limit}
                          onChange={e => setEditingPlan({ ...editingPlan, daily_limit: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[var(--muted)]">Description</label>
                      <textarea
                        className="bmail-input w-full mt-1"
                        rows={2}
                        value={editingPlan.description}
                        onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })}
                      />
                    </div>

                    {/* Features */}
                    <div>
                      <label className="text-xs text-[var(--muted)]">Features</label>
                      <div className="space-y-2 mt-2">
                        {(editingPlan.features || []).map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              className="bmail-input flex-1"
                              value={feature}
                              onChange={e => {
                                const newFeatures = [...(editingPlan.features || [])]
                                newFeatures[index] = e.target.value
                                setEditingPlan({ ...editingPlan, features: newFeatures })
                              }}
                            />
                            <button
                              className="p-2 text-red-500 hover:bg-red-50 rounded"
                              onClick={() => removeFeature(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <input
                            className="bmail-input flex-1"
                            placeholder="Add new feature..."
                            value={newFeature}
                            onChange={e => setNewFeature(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addFeature()}
                          />
                          <button
                            className="btn-bmail btn-bmail-outline p-2"
                            onClick={addFeature}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-lg">
                      <input
                        type="checkbox"
                        id="planActive"
                        checked={editingPlan.is_active}
                        onChange={e => setEditingPlan({ ...editingPlan, is_active: e.target.checked })}
                      />
                      <label htmlFor="planActive" className="flex-1">
                        <span className="font-semibold">Plan is active</span>
                        <span className="text-xs text-[var(--muted)] block">Visible to users on upgrade page</span>
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
                      <button
                        className="btn-bmail btn-bmail-primary flex-1"
                        onClick={() => savePlan(editingPlan)}
                        disabled={saving}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {saving ? 'Saving...' : 'Save Plan'}
                      </button>
                      <button
                        className="btn-bmail btn-bmail-outline"
                        onClick={() => setEditingPlan(null)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Settings Tab */}
      {activeTab === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Nayapay Settings */}
          <div className="bmail-card">
            <div className="bmail-card-head">
              <div className="bmail-card-title flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Nayapay Account
              </div>
            </div>
            <div className="bmail-card-body">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Account Number</label>
                  <input
                    type="text"
                    className="bmail-input w-full mt-2"
                    value={settings.nayapay_account || '03254139900'}
                    onChange={e => setSettings({ ...settings, nayapay_account: e.target.value })}
                    placeholder="03254139900"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">
                    This will be shown to users for payment
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Account Holder Name</label>
                  <input
                    type="text"
                    className="bmail-input w-full mt-2"
                    value={settings.nayapay_name || 'BmailPro'}
                    onChange={e => setSettings({ ...settings, nayapay_name: e.target.value })}
                    placeholder="BmailPro"
                  />
                </div>

                <div className="p-4 bg-[var(--surface)] rounded-lg">
                  <p className="text-sm font-semibold mb-2">Preview:</p>
                  <div className="text-center">
                    <p className="font-mono text-xl font-bold">{settings.nayapay_account || '03254139900'}</p>
                    <p className="text-sm text-[var(--muted)]">{settings.nayapay_name || 'BmailPro'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp Settings */}
          <div className="bmail-card">
            <div className="bmail-card-head">
              <div className="bmail-card-title flex items-center gap-2">
                <Phone className="w-5 h-5" />
                WhatsApp Contact
              </div>
            </div>
            <div className="bmail-card-body">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">WhatsApp Number</label>
                  <input
                    type="text"
                    className="bmail-input w-full mt-2"
                    value={settings.whatsapp_number || '+923254139900'}
                    onChange={e => setSettings({ ...settings, whatsapp_number: e.target.value })}
                    placeholder="+923254139900"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Include country code (e.g., +92 for Pakistan)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Default Message Template</label>
                  <textarea
                    className="bmail-input w-full mt-2"
                    rows={3}
                    value={settings.contact_message || 'Hi, I want to subscribe to BmailPro. My email is: {{email}}'}
                    onChange={e => setSettings({ ...settings, contact_message: e.target.value })}
                    placeholder="Hi, I want to subscribe..."
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Use {'{{email}}'} as placeholder for user's email
                  </p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-semibold text-green-800 mb-2">WhatsApp Preview:</p>
                  <p className="text-green-700">{settings.whatsapp_number || '+923254139900'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="lg:col-span-2">
            <button
              className="btn-bmail btn-bmail-primary w-full py-3"
              onClick={saveSettings}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving Payment Settings...' : 'Save Payment Settings'}
            </button>
          </div>
        </div>
      )}

      {/* App Config Tab */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bmail-card">
            <div className="bmail-card-head">
              <div className="bmail-card-title">Email Limits</div>
            </div>
            <div className="bmail-card-body">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Free User Daily Limit</label>
                  <input
                    type="number"
                    className="bmail-input w-full mt-2"
                    value={settings.free_email_limit || 5}
                    onChange={e => setSettings({ ...settings, free_email_limit: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Maximum emails per day for free users
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Pro User Daily Limit (-1 = unlimited)</label>
                  <input
                    type="number"
                    className="bmail-input w-full mt-2"
                    value={settings.pro_email_limit || -1}
                    onChange={e => setSettings({ ...settings, pro_email_limit: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bmail-card">
            <div className="bmail-card-head">
              <div className="bmail-card-title">Branding</div>
            </div>
            <div className="bmail-card-body">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">App Name</label>
                  <input
                    type="text"
                    className="bmail-input w-full mt-2"
                    value={settings.app_name || 'BmailPro'}
                    onChange={e => setSettings({ ...settings, app_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Support Email</label>
                  <input
                    type="email"
                    className="bmail-input w-full mt-2"
                    value={settings.support_email || ''}
                    onChange={e => setSettings({ ...settings, support_email: e.target.value })}
                    placeholder="support@bmailpro.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <button
              className="btn-bmail btn-bmail-primary w-full py-3"
              onClick={saveSettings}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save App Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bmail-card">
            <div className="bmail-card-head">
              <div className="bmail-card-title">Access Control</div>
            </div>
            <div className="bmail-card-body">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-semibold">Maintenance Mode</p>
                    <p className="text-xs text-[var(--muted)]">Disable user access temporarily</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.maintenance_mode || false}
                      onChange={e => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-semibold">Allow New Registrations</p>
                    <p className="text-xs text-[var(--muted)]">Enable/disable new user signups</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.registration_enabled !== false}
                      onChange={e => setSettings({ ...settings, registration_enabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
                  <div>
                    <p className="font-semibold">Require Email Verification</p>
                    <p className="text-xs text-[var(--muted)]">Users must verify email before sending</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.require_email_verification !== false}
                      onChange={e => setSettings({ ...settings, require_email_verification: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bmail-card">
            <div className="bmail-card-head">
              <div className="bmail-card-title">Rate Limiting</div>
            </div>
            <div className="bmail-card-body">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Max Login Attempts</label>
                  <input
                    type="number"
                    className="bmail-input w-full mt-2"
                    value={settings.max_login_attempts || 5}
                    onChange={e => setSettings({ ...settings, max_login_attempts: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Lockout Duration (minutes)</label>
                  <input
                    type="number"
                    className="bmail-input w-full mt-2"
                    value={settings.lockout_duration || 30}
                    onChange={e => setSettings({ ...settings, lockout_duration: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">API Rate Limit (requests/min)</label>
                  <input
                    type="number"
                    className="bmail-input w-full mt-2"
                    value={settings.api_rate_limit || 60}
                    onChange={e => setSettings({ ...settings, api_rate_limit: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <button
              className="btn-bmail btn-bmail-primary w-full py-3"
              onClick={saveSettings}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving Security Settings...' : 'Save Security Settings'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
