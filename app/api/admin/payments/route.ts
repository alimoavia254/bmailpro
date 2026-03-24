import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Critical: Missing Supabase Environment Variables')
}

const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
)

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin ? user : null
}

export async function GET(request: NextRequest) {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase Service Role Key is missing' }, { status: 500 })
  }

  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'

  let query = supabaseAdmin
    .from('payment_requests')
    .select('*, profiles(email, full_name)')
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: payments, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }

  return NextResponse.json({ payments })
}

export async function PATCH(request: NextRequest) {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase Service Role Key is missing' }, { status: 500 })
  }

  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { paymentId, action, notes } = body

  if (!paymentId || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // Get payment request
    const { data: payment } = await supabaseAdmin
      .from('payment_requests')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (action === 'approve') {
      // Get plan details
      const { data: plan } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .eq('id', payment.plan_name)
        .single()

      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }

      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + plan.duration_days)

      // Update user subscription with full access
      await supabaseAdmin
        .from('profiles')
        .update({
          subscription_status: 'active',
          subscription_tier: plan.id,
          subscription_plan: plan.id,
          subscription_start_date: startDate.toISOString(),
          subscription_end_date: endDate.toISOString(),
          can_send_bulk: true,
          daily_email_limit: plan.daily_limit || -1,
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: admin.id
        })
        .eq('id', payment.user_id)

      // Update payment request
      await supabaseAdmin
        .from('payment_requests')
        .update({
          status: 'approved',
          processed_by: admin.id,
          processed_at: new Date().toISOString(),
          notes: notes || null
        })
        .eq('id', paymentId)

      // Log activity
      await supabaseAdmin.from('activity_logs').insert({
        user_id: payment.user_id,
        action: 'payment_approved',
        details: {
          payment_id: paymentId,
          plan: plan.id,
          amount: payment.amount,
          approved_by: admin.id
        }
      })

    } else if (action === 'reject') {
      // Update payment request
      await supabaseAdmin
        .from('payment_requests')
        .update({
          status: 'rejected',
          processed_by: admin.id,
          processed_at: new Date().toISOString(),
          notes: notes || null
        })
        .eq('id', paymentId)

      // Update user status back to inactive
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_status: 'inactive' })
        .eq('id', payment.user_id)

      // Log activity
      await supabaseAdmin.from('activity_logs').insert({
        user_id: payment.user_id,
        action: 'payment_rejected',
        details: {
          payment_id: paymentId,
          reason: notes,
          rejected_by: admin.id
        }
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Payment action error:', error)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
