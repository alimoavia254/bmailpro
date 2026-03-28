import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sanitizeIlikeSearchTerm } from '@/lib/sanitize-ilike'

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
    return NextResponse.json({ error: 'Supabase Service Role Key is missing in .env.local' }, { status: 500 })
  }

  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const searchRaw = searchParams.get('search') || ''
  const search = searchRaw ? sanitizeIlikeSearchTerm(searchRaw, 200) : ''
  const status = searchParams.get('status') || ''

  let query = supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (search.length > 0) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
  }

  if (status && status !== 'all') {
    if (status === 'inactive') {
      query = query.or('subscription_status.is.null,subscription_status.eq.inactive,subscription_status.eq.free')
    } else {
      query = query.eq('subscription_status', status)
    }
  }

  const { data: users, error } = await query

  if (error) {
    console.error('Fetch users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  return NextResponse.json({ users })
}

export async function PATCH(request: NextRequest) {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase Service Role Key is missing in .env.local' }, { status: 500 })
  }

  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { userId, action, data } = body

  if (!userId || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    switch (action) {
      case 'activate_subscription': {
        const { plan, durationDays, dailyLimit } = data
        const startDate = new Date()
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + durationDays)

        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: 'active',
            subscription_tier: 'pro',
            subscription_plan: plan,
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            can_send_bulk: true,
            daily_email_limit: typeof dailyLimit === 'number' ? dailyLimit : -1,
            payment_verified_at: new Date().toISOString(),
            payment_verified_by: admin.id
          })
          .eq('id', userId)

        // Update any pending payment requests to approved
        await supabaseAdmin
          .from('payment_requests')
          .update({
            status: 'approved',
            processed_by: admin.id,
            processed_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('status', 'pending')

        // Log activity
        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: 'subscription_activated',
          details: { plan, durationDays, activated_by: admin.id }
        })

        break
      }

      case 'extend_subscription': {
        const { days } = data
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('subscription_end_date')
          .eq('id', userId)
          .single()

        const currentEnd = user?.subscription_end_date ? new Date(user.subscription_end_date) : new Date()
        currentEnd.setDate(currentEnd.getDate() + days)

        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_end_date: currentEnd.toISOString(),
            subscription_status: 'active'
          })
          .eq('id', userId)

        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: 'subscription_extended',
          details: { days, extended_by: admin.id }
        })

        break
      }

      case 'deactivate_subscription': {
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: 'inactive',
            subscription_tier: 'free',
            can_send_bulk: false,
            daily_email_limit: 5
          })
          .eq('id', userId)

        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: 'subscription_deactivated',
          details: { deactivated_by: admin.id }
        })

        break
      }

      case 'toggle_active': {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('is_active')
          .eq('id', userId)
          .single()

        const newStatus = user?.is_active === false ? true : false

        await supabaseAdmin
          .from('profiles')
          .update({ is_active: newStatus })
          .eq('id', userId)

        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: newStatus ? 'user_unblocked' : 'user_blocked',
          details: { by: admin.id }
        })

        break
      }

      case 'toggle_bulk_access': {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('can_send_bulk')
          .eq('id', userId)
          .single()

        await supabaseAdmin
          .from('profiles')
          .update({ can_send_bulk: !user?.can_send_bulk })
          .eq('id', userId)

        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: user?.can_send_bulk ? 'bulk_access_disabled' : 'bulk_access_enabled',
          details: { by: admin.id }
        })

        break
      }

      case 'toggle_admin': {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('is_admin')
          .eq('id', userId)
          .single()

        await supabaseAdmin
          .from('profiles')
          .update({ is_admin: !user?.is_admin })
          .eq('id', userId)

        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: user?.is_admin ? 'admin_removed' : 'admin_granted',
          details: { by: admin.id }
        })

        break
      }

      case 'set_daily_limit': {
        const parsedLimit = Number(data?.daily_email_limit)
        if (Number.isNaN(parsedLimit)) {
          return NextResponse.json({ error: 'Invalid daily limit value' }, { status: 400 })
        }
        await supabaseAdmin
          .from('profiles')
          .update({ daily_email_limit: parsedLimit })
          .eq('id', userId)

        break
      }

      case 'update_notes': {
        await supabaseAdmin
          .from('profiles')
          .update({ notes: data.notes })
          .eq('id', userId)

        break
      }

      case 'reset_daily_limit': {
        await supabaseAdmin
          .from('profiles')
          .update({ 
            daily_emails_sent: 0,
            last_email_date: null 
          })
          .eq('id', userId)

        break
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Admin user action error:', error)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
