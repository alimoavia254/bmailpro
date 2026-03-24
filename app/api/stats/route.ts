import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Get campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)

    // Get contacts count
    const { count: contactsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Calculate stats
    const totalCampaigns = campaigns?.length || 0
    const sentCampaigns = campaigns?.filter(c => c.status === 'sent').length || 0
    const totalSent = campaigns?.reduce((sum, c) => sum + (c.sent_count || 0), 0) || 0
    const totalOpens = campaigns?.reduce((sum, c) => sum + (c.open_count || 0), 0) || 0
    const totalClicks = campaigns?.reduce((sum, c) => sum + (c.click_count || 0), 0) || 0

    const openRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0
    const clickRate = totalOpens > 0 ? Math.round((totalClicks / totalOpens) * 100) : 0

    // Get app settings
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')

    const settingsMap: Record<string, any> = {}
    settings?.forEach(s => {
      try {
        settingsMap[s.key] = JSON.parse(s.value)
      } catch {
        settingsMap[s.key] = s.value
      }
    })

    const freeDailyLimit = settingsMap.free_daily_limit || 5

    // Calculate remaining emails for free users
    let remainingEmails = null
    if (profile?.subscription_status !== 'active') {
      const today = new Date().toISOString().split('T')[0]
      const lastEmailDate = profile?.last_email_date?.split('T')[0]
      const dailyCount = lastEmailDate === today ? (profile?.daily_emails_sent || 0) : 0
      remainingEmails = Math.max(0, freeDailyLimit - dailyCount)
    }

    return NextResponse.json({
      profile: {
        ...profile,
        remainingEmails,
        freeDailyLimit
      },
      stats: {
        totalCampaigns,
        sentCampaigns,
        totalContacts: contactsCount || 0,
        totalSent,
        totalOpens,
        totalClicks,
        openRate,
        clickRate,
        emailsSentThisMonth: profile?.emails_sent_this_month || 0,
        totalEmailsSent: profile?.total_emails_sent || 0
      },
      recentCampaigns: campaigns?.slice(0, 5) || [],
      settings: settingsMap
    })

  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
