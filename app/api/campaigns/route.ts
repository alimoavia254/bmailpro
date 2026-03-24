import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    let query = supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      data,
      total: count,
      limit,
      offset
    })
  } catch (error: any) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, subject, body_html } = body

    // Check email limit for free users
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, daily_emails_sent')
      .eq('id', user.id)
      .single()

    if (profile?.subscription_tier === 'free' && profile?.daily_emails_sent >= 5) {
      return NextResponse.json(
        { error: 'Free plan limit reached. Maximum 5 emails per day.' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name,
        subject,
        body_html,
        status: 'draft',
        total_recipients: 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
