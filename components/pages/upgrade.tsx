'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Check, Star, Zap, Copy, CreditCard, Phone, Shield, Clock } from 'lucide-react'

interface Plan {
  id: string
  name: string
  display_name: string
  price: number
  duration_days: number
  description: string
  features: string[]
  is_active: boolean
}

interface UpgradeProps {
  profile: any
  showToast: (msg: string, type?: any) => void
}

export default function Upgrade({ profile, showToast }: UpgradeProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [appSettings, setAppSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      // Fetch plans
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (plansData) {
        setPlans(plansData.map(p => ({
          ...p,
          features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features
        })))
      }

      // Fetch settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*')

      if (settingsData) {
        const settings: any = {}
        settingsData.forEach(s => {
          try {
            settings[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value
          } catch {
            settings[s.key] = s.value
          }
        })
        setAppSettings(settings)
      }

      // Check for existing payment request
      if (profile?.id) {
        const { data: existingRequest } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('user_id', profile.id)
          .eq('status', 'pending')
          .maybeSingle()

        if (existingRequest) {
          setRequestSent(true)
        }
      }

      setLoading(false)
    }
    fetchData()
  }, [supabase, profile?.id])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showToast(`${label} copied to clipboard`, 'success')
  }

  const openWhatsApp = (plan?: Plan) => {
    const whatsappNumber = appSettings?.whatsapp_number || '+923254139900'
    const message = plan 
      ? `Hi, I want to subscribe to the ${plan.display_name} ($${plan.price}) for BmailPro.\n\nMy email is: ${profile?.email}\n\nI have sent the payment to your Nayapay account.`
      : `Hi, I would like to upgrade my BmailPro account.\n\nMy email is: ${profile?.email}`
    const url = `https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan)
    setShowPaymentModal(true)
  }

  const submitPaymentRequest = async () => {
    if (!selectedPlan || !profile?.id) return

    setSubmitting(true)
    try {
      const { error } = await supabase.from('payment_requests').insert({
        user_id: profile.id,
        plan_name: selectedPlan.id,
        amount: selectedPlan.price,
        status: 'pending',
        payment_method: 'nayapay'
      })

      if (error) throw error

      // Update profile status to pending
      await supabase
        .from('profiles')
        .update({ subscription_status: 'pending' })
        .eq('id', profile.id)

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: profile.id,
        action: 'payment_request_submitted',
        details: { plan: selectedPlan.id, amount: selectedPlan.price }
      })

      setRequestSent(true)
      showToast('Payment request submitted! Now contact us on WhatsApp to confirm.', 'success')
      openWhatsApp(selectedPlan)
      setShowPaymentModal(false)
    } catch (error: any) {
      showToast(error.message || 'Failed to submit request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-[var(--muted)]">Loading plans...</div>
      </div>
    )
  }

  const isActive = profile?.subscription_status === 'active'
  const nayapayAccount = appSettings?.nayapay_account || '03254139900'
  const nayapayName = appSettings?.nayapay_name || 'BmailPro'
  const whatsappNumber = appSettings?.whatsapp_number || '+923254139900'

  // Payment Modal
  const PaymentModal = () => {
    if (!selectedPlan) return null

    return (
      <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
        <div className="modal-box max-w-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Complete Your Payment</h3>
            <button onClick={() => setShowPaymentModal(false)}>&times;</button>
          </div>
          <div className="modal-body">
            {/* Selected Plan Summary */}
            <div className="bg-[var(--accent-bg)] rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-lg">{selectedPlan.display_name}</h4>
                  <p className="text-sm text-[var(--muted)]">{selectedPlan.duration_days} days access</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[var(--accent)]">${selectedPlan.price}</p>
                  <p className="text-xs text-[var(--muted)]">one-time payment</p>
                </div>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-xs">1</span>
                Send payment via Nayapay
              </div>

              {/* Nayapay Account Details */}
              <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[var(--accent2)] rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-[var(--accent2)]">Nayapay Account</p>
                    <p className="text-xs text-[var(--muted)]">Send exact amount shown above</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[var(--border)]">
                    <div>
                      <p className="text-xs text-[var(--muted)]">Account Number</p>
                      <p className="font-mono font-bold text-lg">{nayapayAccount}</p>
                    </div>
                    <button 
                      className="btn-bmail btn-bmail-outline text-xs py-1 px-3"
                      onClick={() => copyToClipboard(nayapayAccount, 'Account number')}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[var(--border)]">
                    <div>
                      <p className="text-xs text-[var(--muted)]">Account Name</p>
                      <p className="font-semibold">{nayapayName}</p>
                    </div>
                    <button 
                      className="btn-bmail btn-bmail-outline text-xs py-1 px-3"
                      onClick={() => copyToClipboard(nayapayName, 'Account name')}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[var(--accent-bg)] rounded-lg">
                    <div>
                      <p className="text-xs text-[var(--muted)]">Amount to Send</p>
                      <p className="font-bold text-xl text-[var(--accent)]">${selectedPlan.price}</p>
                    </div>
                    <button 
                      className="btn-bmail btn-bmail-outline text-xs py-1 px-3"
                      onClick={() => copyToClipboard(String(selectedPlan.price), 'Amount')}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-xs">2</span>
                Contact us on WhatsApp to confirm
              </div>

              {/* WhatsApp Contact */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-green-700">WhatsApp Support</p>
                    <p className="text-sm text-green-600">{whatsappNumber}</p>
                  </div>
                </div>
                <p className="text-xs text-green-700 mb-3">
                  After sending payment, message us on WhatsApp with your email address to activate your subscription instantly.
                </p>
                <button 
                  className="btn-bmail w-full justify-center py-3"
                  style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: 'white' }}
                  onClick={() => openWhatsApp(selectedPlan)}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Open WhatsApp Chat
                </button>
              </div>

              {/* Submit Request Button */}
              <button 
                className="btn-bmail btn-bmail-primary w-full justify-center py-3"
                onClick={submitPaymentRequest}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : "I've Sent the Payment - Submit Request"}
              </button>

              <p className="text-xs text-center text-[var(--muted)]">
                Your subscription will be activated within 24 hours after payment verification
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
          {isActive ? 'Your Subscription' : 'Upgrade to Pro'}
        </h1>
        <p className="text-[var(--muted)] max-w-md mx-auto">
          {isActive 
            ? `You're enjoying the ${profile?.subscription_tier || 'Pro'} plan`
            : 'Unlock unlimited email campaigns with real-time tracking and analytics'
          }
        </p>
      </div>

      {/* Current Status Banner */}
      {isActive && (
        <div className="bmail-card mb-6" style={{ borderColor: 'var(--accent2)', borderWidth: '2px' }}>
          <div className="bmail-card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[var(--green-bg)] rounded-full flex items-center justify-center">
                  <Star className="w-7 h-7 text-[var(--accent2)]" />
                </div>
                <div>
                  <p className="font-bold text-lg text-[var(--accent2)]">Active Subscription</p>
                  <p className="text-sm text-[var(--muted)]">
                    {(profile?.subscription_plan || profile?.subscription_tier || 'PRO').toString().toUpperCase()} Plan - Expires: {profile?.subscription_end_date ? new Date(profile.subscription_end_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--muted)]">Emails Today</p>
                <p className="text-2xl font-bold text-[var(--accent)]">{profile?.daily_emails_sent || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Payment Banner */}
      {requestSent && !isActive && (
        <div className="bmail-card mb-6" style={{ borderColor: 'var(--warning)', borderWidth: '2px' }}>
          <div className="bmail-card-body">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-7 h-7 text-yellow-600" />
                </div>
                <div>
                  <p className="font-bold text-lg text-yellow-700">Payment Verification Pending</p>
                  <p className="text-sm text-[var(--muted)]">
                    Your request is being reviewed. Contact us on WhatsApp if you've already paid.
                  </p>
                </div>
              </div>
              <button 
                className="btn-bmail"
                style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: 'white' }}
                onClick={() => openWhatsApp()}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {plans.map((plan, index) => {
          const isBestValue = index === 1
          const isPopular = index === 2

          return (
            <div 
              key={plan.id}
              className={`bmail-card relative overflow-hidden transition-all hover:shadow-lg ${
                isBestValue ? 'ring-2 ring-[var(--accent2)]' : ''
              }`}
            >
              {isBestValue && (
                <div className="absolute top-0 left-0 right-0 bg-[var(--accent2)] text-white text-xs font-bold py-1.5 text-center">
                  BEST VALUE - SAVE 17%
                </div>
              )}
              {isPopular && (
                <div className="absolute top-0 left-0 right-0 bg-[var(--accent)] text-white text-xs font-bold py-1.5 text-center">
                  MOST POPULAR - SAVE 33%
                </div>
              )}
              
              <div className={`bmail-card-body ${isBestValue || isPopular ? 'pt-10' : ''}`}>
                <div className="text-center mb-5">
                  <h3 className="text-xl font-bold mb-1">{plan.display_name}</h3>
                  <p className="text-sm text-[var(--muted)]">{plan.duration_days} days</p>
                  <div className="mt-3">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-[var(--muted)] text-sm"> one-time</span>
                  </div>
                </div>
                
                <p className="text-sm text-[var(--muted)] text-center mb-5">{plan.description}</p>
                
                <ul className="space-y-2.5 mb-6">
                  {(plan.features || []).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-[var(--accent2)] flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {!isActive && !requestSent && (
                  <button 
                    className={`btn-bmail w-full justify-center py-3 ${
                      isBestValue ? 'btn-bmail-primary' : 'btn-bmail-outline'
                    }`}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    Select {plan.display_name}
                  </button>
                )}

                {isActive && profile?.subscription_plan === plan.id && (
                  <div className="text-center py-3 bg-[var(--green-bg)] rounded-lg text-[var(--accent2)] font-semibold text-sm">
                    Current Plan
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Free Plan Comparison */}
      {!isActive && (
        <div className="bmail-card mb-8">
          <div className="bmail-card-body">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--surface)] rounded-full flex items-center justify-center">
                  <Zap className="w-6 h-6 text-[var(--muted)]" />
                </div>
                <div>
                  <h3 className="font-semibold">Free Plan (Current)</h3>
                  <p className="text-sm text-[var(--muted)]">
                    {appSettings?.free_email_limit || 5} emails per day • Limited features
                  </p>
                </div>
              </div>
              <span className="pill p-draft">Limited</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods Info */}
      <div className="bmail-card">
        <div className="bmail-card-head">
          <div className="bmail-card-title">Payment Information</div>
        </div>
        <div className="bmail-card-body">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Nayapay */}
            <div className="p-4 bg-[var(--surface)] rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[var(--accent2)] rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold">Nayapay Account</p>
                  <p className="text-xs text-[var(--muted)]">Instant transfer</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted)]">Account:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{nayapayAccount}</span>
                    <button 
                      className="p-1 hover:bg-[var(--border)] rounded"
                      onClick={() => copyToClipboard(nayapayAccount, 'Account number')}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted)]">Name:</span>
                  <span className="font-semibold">{nayapayName}</span>
                </div>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-green-700">WhatsApp Support</p>
                  <p className="text-xs text-green-600">Fast response</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">Contact:</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-800">{whatsappNumber}</span>
                  <button 
                    className="p-1 hover:bg-green-100 rounded"
                    onClick={() => copyToClipboard(whatsappNumber, 'WhatsApp number')}
                  >
                    <Copy className="w-3 h-3 text-green-600" />
                  </button>
                </div>
              </div>
              <button 
                className="btn-bmail w-full justify-center mt-3 py-2 text-sm"
                style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: 'white' }}
                onClick={() => openWhatsApp()}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat on WhatsApp
              </button>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Shield className="w-4 h-4" />
              Secure Payments
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Clock className="w-4 h-4" />
              24hr Activation
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <MessageCircle className="w-4 h-4" />
              Live Support
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && <PaymentModal />}
    </div>
  )
}
