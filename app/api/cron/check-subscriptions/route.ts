import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This endpoint should be called by a cron job (e.g., Vercel Cron) daily
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/check-subscriptions", "schedule": "0 0 * * *" }] }

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const now = new Date().toISOString()

    // Find expired subscriptions
    const { data: expiredUsers, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, subscription_plan, subscription_end_date')
      .eq('subscription_status', 'active')
      .lt('subscription_end_date', now)

    if (fetchError) {
      console.error('Error fetching expired subscriptions:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return NextResponse.json({ message: 'No expired subscriptions found', count: 0 })
    }

    // Update expired subscriptions to 'expired' status
    const userIds = expiredUsers.map(u => u.id)
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'expired',
        subscription_plan: null,
      })
      .in('id', userIds)

    if (updateError) {
      console.error('Error updating subscriptions:', updateError)
      return NextResponse.json({ error: 'Failed to update subscriptions' }, { status: 500 })
    }

    // Log activity for each expired user
    for (const user of expiredUsers) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'subscription_expired',
        details: { 
          previous_plan: user.subscription_plan,
          expired_at: user.subscription_end_date,
        },
      })
    }

    console.log(`Expired ${expiredUsers.length} subscriptions`)

    return NextResponse.json({ 
      message: 'Subscriptions checked',
      expired_count: expiredUsers.length,
      expired_users: expiredUsers.map(u => u.email),
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Reset daily email counts at midnight
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Reset daily email counts for all users
    const { error } = await supabase
      .from('profiles')
      .update({ daily_emails_sent: 0 })
      .neq('daily_emails_sent', 0)

    if (error) {
      console.error('Error resetting daily counts:', error)
      return NextResponse.json({ error: 'Failed to reset counts' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Daily email counts reset' })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
