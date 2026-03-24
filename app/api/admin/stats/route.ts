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

export async function GET(request: NextRequest) {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase Service Role Key is missing in .env.local' }, { status: 500 })
  }

  try {
    // Verify admin using auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all users
    const { data: users, count: totalUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })

    // Calculate stats
    const activeSubscribers = users?.filter(u => u.subscription_status === 'active').length || 0
    const pendingPayments = users?.filter(u => u.subscription_status === 'pending').length || 0
    const freeUsers = users?.filter(u => u.subscription_status !== 'active').length || 0
    const totalEmailsSent = users?.reduce((sum, u) => sum + (u.total_emails_sent || 0), 0) || 0

    // Get monthly revenue (approximate from active subscriptions)
    const { data: plans } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')

    const planPrices: Record<string, number> = {}
    plans?.forEach(p => {
      planPrices[p.id] = p.price
    })

    const monthlyRevenue = users?.reduce((sum, u) => {
      if (u.subscription_status === 'active' && u.subscription_tier) {
        return sum + (planPrices[u.subscription_tier] || 0)
      }
      return sum
    }, 0) || 0

    // Get pending payment requests
    const { data: paymentRequests, count: pendingRequestsCount } = await supabaseAdmin
      .from('payment_requests')
      .select('*', { count: 'exact' })
      .eq('status', 'pending')

    // Get recent activity
    const { data: recentActivity } = await supabaseAdmin
      .from('activity_logs')
      .select('*, profiles(email, full_name)')
      .order('created_at', { ascending: false })
      .limit(20)

    // Get campaigns stats
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('*')

    const totalCampaigns = campaigns?.length || 0
    const sentCampaigns = campaigns?.filter(c => c.status === 'sent').length || 0

    return NextResponse.json({
      stats: {
        totalUsers: totalUsers || 0,
        activeSubscribers,
        pendingPayments,
        freeUsers,
        totalEmailsSent,
        monthlyRevenue,
        pendingRequests: pendingRequestsCount || 0,
        totalCampaigns,
        sentCampaigns
      },
      recentUsers: users?.slice(0, 10) || [],
      pendingPayments: paymentRequests || [],
      recentActivity: recentActivity || [],
      plans: plans || []
    })

  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 })
  }
}
