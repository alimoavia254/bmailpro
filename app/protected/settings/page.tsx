'use client'

import { useEffect, useState } from 'react'
import { createClient, getCurrentUserSafe } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Check, Lock } from 'lucide-react'

interface Profile {
  id: string
  email: string
  full_name: string | null
  subscription_tier: 'free' | 'pro'
  emails_sent_this_month: number
  smtp_email: string | null
  smtp_password: string | null
  smtp_email_2: string | null
  smtp_password_2: string | null
  active_smtp: number | null
  created_at: string
}

interface Webhook {
  id: string
  url: string
  event_types: string[]
  is_active: boolean
}

const SUBSCRIPTION_LIMITS = {
  free: {
    emailsPerMonth: 100,
    campaigns: 3,
    contacts: 500,
    features: ['Basic campaign creation', 'Email tracking', 'Simple analytics'],
  },
  pro: {
    emailsPerMonth: 'Unlimited',
    campaigns: 'Unlimited',
    contacts: 'Unlimited',
    features: [
      'Advanced analytics',
      'Cloudflare Tunnel integration',
      'Priority support',
      'API access',
      'Custom templates',
      'A/B testing',
    ],
  },
}

export default function SettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    smtp_email: '',
    smtp_password: '',
    smtp_email_2: '',
    smtp_password_2: '',
    active_smtp: 1,
  })
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [newWebhookUrl, setNewWebhookUrl] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = await getCurrentUserSafe(supabase, 10000)

        if (!user) return

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (data) {
          setProfile(data)
          setFormData({
            full_name: data.full_name || '',
            smtp_email: data.smtp_email || '',
            smtp_password: data.smtp_password || '',
            smtp_email_2: data.smtp_email_2 || '',
            smtp_password_2: data.smtp_password_2 || '',
            active_smtp: data.active_smtp || 1,
          })
        }

        // Get webhooks
        const { data: webhooksData } = await supabase
          .from('webhooks')
          .select('*')
          .eq('user_id', user.id)

        if (webhooksData) setWebhooks(webhooksData)
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          smtp_email: formData.smtp_email,
          smtp_password: formData.smtp_password || null,
          smtp_email_2: formData.smtp_email_2,
          smtp_password_2: formData.smtp_password_2 || null,
          active_smtp: formData.active_smtp,
        })
        .eq('id', profile.id)
        .select()
        .single()

      if (data) {
        setProfile(data)
        alert('Profile updated successfully!')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newWebhookUrl) return

    try {
      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          user_id: profile.id,
          url: newWebhookUrl,
          event_types: ['open', 'click']
        })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setWebhooks([...webhooks, data])
        setNewWebhookUrl('')
        alert('Webhook added!')
      }
    } catch (err) {
      console.error(err)
      alert('Failed to add webhook')
    }
  }

  const handleDeleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase.from('webhooks').delete().eq('id', id)
      if (error) throw error
      setWebhooks(webhooks.filter(w => w.id !== id))
    } catch (err) {
      console.error(err)
      alert('Failed to delete webhook')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading settings...</div>
  }

  if (!profile) {
    return <div className="text-center py-12">Profile not found</div>
  }

  const currentTier = SUBSCRIPTION_LIMITS[profile.subscription_tier]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="smtp">SMTP Configuration</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="cloudflare">Cloudflare Tunnel</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Update your profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={profile.email} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground mt-1">Your login email cannot be changed</p>
                </div>

                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={handleInputChange}
                  />
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle>SMTP Configuration</CardTitle>
              <CardDescription>Configure multiple Gmail SMTP accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <Label>Active SMTP Slot:</Label>
                <div className="flex gap-2">
                  <Button
                    variant={formData.active_smtp === 1 ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, active_smtp: 1 })}
                    size="sm"
                  >
                    Slot 1
                  </Button>
                  <Button
                    variant={formData.active_smtp === 2 ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, active_smtp: 2 })}
                    size="sm"
                  >
                    Slot 2
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground ml-auto italic">
                  Currently using Slot {formData.active_smtp} for all sending.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Slot 1 */}
                <div className="space-y-4 p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    SMTP Slot 1
                  </h3>
                  <div>
                    <Label htmlFor="smtp_email">Gmail Address</Label>
                    <Input
                      id="smtp_email"
                      name="smtp_email"
                      placeholder="smtp1@gmail.com"
                      value={formData.smtp_email}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_password">App Password</Label>
                    <Input
                      id="smtp_password"
                      name="smtp_password"
                      type="password"
                      placeholder="••••••••••••••••"
                      value={formData.smtp_password}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Slot 2 */}
                <div className="space-y-4 p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    SMTP Slot 2
                  </h3>
                  <div>
                    <Label htmlFor="smtp_email_2">Gmail Address</Label>
                    <Input
                      id="smtp_email_2"
                      name="smtp_email_2"
                      placeholder="smtp2@gmail.com"
                      value={formData.smtp_email_2}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smtp_password_2">App Password</Label>
                    <Input
                      id="smtp_password_2"
                      name="smtp_password_2"
                      type="password"
                      placeholder="••••••••••••••••"
                      value={formData.smtp_password_2}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save All SMTP Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <div className="space-y-6">
            {/* Current Plan */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Current Plan: {profile.subscription_tier.toUpperCase()}</CardTitle>
                    <CardDescription className="mt-2">
                      You're on the {profile.subscription_tier} plan. {profile.subscription_tier === 'free' ? 'Upgrade to access more features.' : 'Thank you for your support!'}
                    </CardDescription>
                  </div>
                  <Badge className="bg-blue-600 text-white">{profile.subscription_tier}</Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Plan Comparison */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Free Plan */}
              <Card className={profile.subscription_tier === 'free' ? 'border-blue-500' : ''}>
                <CardHeader>
                  <CardTitle>Free Plan</CardTitle>
                  <CardDescription>Perfect for getting started</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">$0</div>
                    <div className="text-sm text-muted-foreground">per month</div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2 items-start">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <strong>{SUBSCRIPTION_LIMITS.free.emailsPerMonth}</strong> emails/month
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <strong>{SUBSCRIPTION_LIMITS.free.campaigns}</strong> active campaigns
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <strong>{SUBSCRIPTION_LIMITS.free.contacts}</strong> contacts
                      </div>
                    </div>
                    {SUBSCRIPTION_LIMITS.free.features.map((feature) => (
                      <div key={feature} className="flex gap-2 items-start">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">{feature}</div>
                      </div>
                    ))}
                  </div>

                  {profile.subscription_tier === 'free' && (
                    <Button className="w-full" disabled>
                      Current Plan
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className={`${profile.subscription_tier === 'pro' ? 'border-purple-500 bg-purple-50' : ''}`}>
                <CardHeader>
                  <CardTitle>Pro Plan</CardTitle>
                  <CardDescription>For growing businesses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">$29</div>
                    <div className="text-sm text-muted-foreground">per month</div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2 items-start">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <strong>Unlimited</strong> emails/month
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <strong>Unlimited</strong> campaigns
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <strong>Unlimited</strong> contacts
                      </div>
                    </div>
                    {SUBSCRIPTION_LIMITS.pro.features.map((feature) => (
                      <div key={feature} className="flex gap-2 items-start">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">{feature}</div>
                      </div>
                    ))}
                  </div>

                  {profile.subscription_tier === 'pro' ? (
                    <Button className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button className="w-full bg-purple-600 hover:bg-purple-700">
                      Upgrade to Pro
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            <p className="text-sm text-muted-foreground">
              💡 <strong>Note:</strong> Payment integration is currently disabled. Upgrade functionality will be available soon.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Receive real-time notifications to your server</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddWebhook} className="flex gap-2">
                <Input
                  placeholder="https://your-api.com/webhooks"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  required
                />
                <Button type="submit">Add Webhook</Button>
              </form>

              <div className="space-y-4">
                {webhooks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground italic">
                    No webhooks configured yet.
                  </div>
                ) : (
                  webhooks.map((w) => (
                    <div key={w.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{w.url}</div>
                        <div className="flex gap-2 mt-1">
                          {w.event_types.map(et => (
                            <Badge key={et} variant="secondary" className="text-[10px] px-1 py-0">{et}</Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteWebhook(w.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cloudflare">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Cloudflare Tunnel Configuration
              </CardTitle>
              <CardDescription>
                Generate public tracking URLs for your email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <p className="font-medium text-amber-900">Cloudflare Tunnel Status</p>
                <p className="text-amber-800 mt-2">
                  To enable Cloudflare Tunnel integration, you'll need to set up a tunnel on your Cloudflare account.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Tunnel URL (Optional)</Label>
                  <Input
                    type="text"
                    placeholder="https://your-tunnel.example.com"
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be automatically generated when you set up a tunnel
                  </p>
                </div>

                <div>
                  <Label>Status</Label>
                  <div className="mt-2 p-3 bg-gray-100 rounded-lg text-sm text-gray-600">
                    Not configured - Tracking URLs will use your main domain
                  </div>
                </div>

                <Button disabled className="gap-2">
                  <Lock className="w-4 h-4" />
                  Configure Cloudflare Tunnel
                </Button>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <p className="font-medium text-blue-900">How it works:</p>
                  <ol className="mt-2 list-decimal list-inside space-y-1 text-blue-800">
                    <li>Set up a Cloudflare Tunnel on your account</li>
                    <li>Configure it to point to this application</li>
                    <li>Your tracking URLs will use the tunnel domain</li>
                    <li>All tracking is performed securely through the tunnel</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
