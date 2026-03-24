'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  sent_count: number
  opened_count: number
  clicked_count: number
  created_at: string
}

interface Profile {
  subscription_tier: string
  emails_sent_this_month: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        // Get profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileData) {
          setProfile(profileData)
        }

        // Get ALL campaigns for total stats
        const { data: allCampaigns } = await supabase
          .from('campaigns')
          .select('*')
          .eq('user_id', user.id)

        if (allCampaigns) {
          setCampaigns(allCampaigns)
        }

        // Get daily events for chart
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: events } = await supabase
          .from('tracking_events')
          .select('created_at, event_type, campaign_contacts!inner(campaign_id)')
          .eq('campaign_contacts.campaigns.user_id', user.id) // This join might be tricky in Supabase without proper view
          .gte('created_at', thirtyDaysAgo.toISOString())

        // Simplified approach for now: aggregate from campaigns for chart if events join is hard
        // But let's try to get events for better granularity. 
        // If the join fails, we'll fallback to campaign created_at.
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)
  const totalOpened = campaigns.reduce((sum, c) => sum + (c.opened_count || 0), 0)
  const totalClicked = campaigns.reduce((sum, c) => sum + (c.clicked_count || 0), 0)
  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0'
  const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0'

  // Generate chart data from campaigns (fallback if events aren't granular enough)
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return {
      name: dateStr,
      opened: campaigns
        .filter(c => new Date(c.created_at).toDateString() === d.toDateString())
        .reduce((sum, c) => sum + (c.opened_count || 0), 0),
      clicked: campaigns
        .filter(c => new Date(c.created_at).toDateString() === d.toDateString())
        .reduce((sum, c) => sum + (c.clicked_count || 0), 0),
    }
  })

  const getTierBadgeColor = (tier: string) => {
    return tier === 'pro' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  return (
    <div className="space-y-8">
      {/* Subscription Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Subscription Status</CardTitle>
            <CardDescription>Your current plan and usage</CardDescription>
          </div>
          <Badge className={getTierBadgeColor(profile?.subscription_tier || 'free')}>
            {profile?.subscription_tier || 'free'} Plan
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Emails Sent This Month</div>
              <div className="text-3xl font-bold mt-2">{profile?.emails_sent_this_month || 0}</div>
              <div className="text-sm text-muted-foreground mt-2">
                {profile?.subscription_tier === 'pro' ? 'Unlimited' : 'Max 100/month'}
              </div>
            </div>
            {profile?.subscription_tier === 'free' && (
              <Link href="/protected/settings" className="flex items-end">
                <Button className="w-full">Upgrade to Pro</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardDescription>Total Sent</CardDescription>
            <CardTitle className="text-3xl font-bold">{totalSent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardDescription>Open Rate</CardDescription>
            <CardTitle className="text-3xl font-bold">{openRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardDescription>Click Rate</CardDescription>
            <CardTitle className="text-3xl font-bold">{clickRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
          <CardDescription>Overview of your email campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend />
                <Line type="monotone" dataKey="opened" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Opens" />
                <Line type="monotone" dataKey="clicked" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Clicks" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>Your latest email campaigns</CardDescription>
          </div>
          <Link href="/protected/campaigns/new">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Campaign
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No campaigns yet. Create your first campaign to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.slice(0, 5).map((campaign) => (
                <Link key={campaign.id} href={`/protected/campaigns/${campaign.id}`}>
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex-1">
                      <div className="font-medium">{campaign.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{campaign.sent_count} sent</div>
                        <div className="text-xs text-muted-foreground">
                          {campaign.opened_count} opens ({campaign.clicked_count} clicks)
                        </div>
                      </div>
                      <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
