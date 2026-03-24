'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminPaymentsProps {
  onNavigate: (page: string) => void
  showToast: (msg: string, type?: string) => void
}

export default function AdminPayments({ onNavigate, showToast }: AdminPaymentsProps) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [notes, setNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchPayments()
  }, [statusFilter])

  const fetchPayments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/admin/payments?status=${statusFilter}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      showToast('Failed to load payments', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentAction = async (paymentId: string, action: 'approve' | 'reject') => {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paymentId, action, notes })
      })

      if (response.ok) {
        showToast(`Payment ${action}d successfully`, 'success')
        fetchPayments()
        setShowModal(false)
        setSelectedPayment(null)
        setNotes('')
      } else {
        showToast('Action failed', 'error')
      }
    } catch (error) {
      showToast('Error performing action', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const pendingCount = payments.filter(p => p.status === 'pending').length
  const approvedCount = payments.filter(p => p.status === 'approved').length
  const rejectedCount = payments.filter(p => p.status === 'rejected').length

  const PaymentModal = () => {
    if (!selectedPayment) return null
    
    return (
      <div className="modal-overlay" onClick={() => setShowModal(false)}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Payment Request Details</h3>
            <button onClick={() => setShowModal(false)}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--muted)]">User Email</label>
                <p className="font-semibold">{selectedPayment.profiles?.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--muted)]">Plan</label>
                  <p className="font-semibold text-[var(--accent)]">{selectedPayment.plan_name?.toUpperCase()}</p>
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">Amount</label>
                  <p className="font-bold text-[var(--accent2)] text-xl">${selectedPayment.amount}</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Requested At</label>
                <p>{formatDate(selectedPayment.created_at)}</p>
              </div>
              
              {selectedPayment.status === 'pending' && (
                <>
                  <div>
                    <label className="text-xs text-[var(--muted)]">Admin Notes (optional)</label>
                    <textarea
                      className="bmail-input w-full mt-1"
                      rows={3}
                      placeholder="Add notes about this payment..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button 
                      className="btn-bmail btn-bmail-primary flex-1 py-3"
                      onClick={() => handlePaymentAction(selectedPayment.id, 'approve')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Processing...' : 'Approve Payment'}
                    </button>
                    <button 
                      className="btn-bmail btn-bmail-outline flex-1 py-3 text-red-500 border-red-300 hover:bg-red-50"
                      onClick={() => handlePaymentAction(selectedPayment.id, 'reject')}
                      disabled={actionLoading}
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
              
              {selectedPayment.status !== 'pending' && (
                <div className="p-4 bg-[var(--surface)] rounded-lg">
                  <p className="text-sm">
                    This payment has been <strong>{selectedPayment.status}</strong>
                    {selectedPayment.processed_at && (
                      <span> on {formatDate(selectedPayment.processed_at)}</span>
                    )}
                  </p>
                  {selectedPayment.notes && (
                    <p className="text-xs text-[var(--muted)] mt-2">Notes: {selectedPayment.notes}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-val text-[var(--warning)]">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-val text-[var(--accent2)]">{approvedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected</div>
          <div className="stat-val text-red-500">{rejectedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          className="bmail-input w-[180px]"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Payments Table */}
      <div className="bmail-card">
        <div className="bmail-card-head">
          <div className="bmail-card-title">
            Payment Requests 
            {statusFilter === 'pending' && payments.length > 0 && (
              <span className="ml-2 bg-[var(--warning)] text-white px-2 py-0.5 rounded-full text-xs">
                {payments.length} pending
              </span>
            )}
          </div>
        </div>
        <div className="bmail-card-body p-0">
          {loading ? (
            <div className="text-center py-8 text-[var(--muted)]">Loading...</div>
          ) : payments.length > 0 ? (
            <table className="bmail-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => (
                  <tr key={payment.id}>
                    <td>
                      <div className="font-semibold text-[13px]">{payment.profiles?.email}</div>
                      <div className="text-xs text-[var(--muted)]">{payment.profiles?.full_name || ''}</div>
                    </td>
                    <td>
                      <span className="pill p-running">{payment.plan_name?.toUpperCase()}</span>
                    </td>
                    <td className="font-bold text-[var(--accent2)]">${payment.amount}</td>
                    <td>
                      <span className={`pill ${
                        payment.status === 'approved' ? 'p-complete' :
                        payment.status === 'rejected' ? 'p-failed' : 'p-running'
                      }`}>
                        {payment.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--muted)]">{formatDate(payment.created_at)}</td>
                    <td>
                      <button 
                        className="btn-bmail btn-bmail-outline text-xs py-1 px-3"
                        onClick={() => { setSelectedPayment(payment); setShowModal(true) }}
                      >
                        {payment.status === 'pending' ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state py-8">
              <div className="empty-icon text-3xl">💳</div>
              <p className="text-sm">No {statusFilter} payments</p>
            </div>
          )}
        </div>
      </div>

      {showModal && <PaymentModal />}
    </>
  )
}
