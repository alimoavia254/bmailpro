'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Send, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { addTagContactsToCampaign } from '@/app/actions/campaigns'

interface Campaign {
  id: string
  name: string
  subject: string
  body: string
  status: string
  total_recipients: number
  sent_count: number
  opened_count: number
  clicked_count: number
  failed_count?: number
  created_at: string
  body_html?: string
}

interface Tag {
  id: string
  name: string
}

interface CampaignContact {
  id: string
  status: string
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  contacts: {
    email: string
    name: string | null
  }
}

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [contacts, setContacts] = useState<CampaignContact[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [newContactEmail, setNewContactEmail] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [tags, setTags] = useState<Tag[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        // Get campaign
        const { data: campaignData } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .eq('user_id', user.id)
          .single()

        if (campaignData) {
          setCampaign(campaignData)
        }

        // Get campaign contacts
        const { data: contactsData } = await supabase
          .from('campaign_contacts')
          .select(`
            id,
            status,
            sent_at,
            opened_at,
            clicked_at,
            contacts (
              email,
              name
            )
          `)
          .eq('campaign_id', campaignId)

        if (contactsData) {
          const formatted = (contactsData as any[]).map(c => ({
            ...c,
            contacts: Array.isArray(c.contacts) ? c.contacts[0] : c.contacts
          }))
          setContacts(formatted)
        }

        // Get Tags
        const { data: tagsData } = await supabase.from('tags').select('id, name').eq('user_id', user.id)
        if (tagsData) setTags(tagsData)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [campaignId, supabase])

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!campaign || !newContactEmail) return

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      // Add contact
      const { data: contactData } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          email: newContactEmail,
          name: newContactName,
        })
        .select()
        .single()

      if (contactData) {
        // Add contact to campaign
        const { data: campaignContactData } = await supabase
          .from('campaign_contacts')
          .insert({
            campaign_id: campaign.id,
            contact_id: contactData.id,
            status: 'pending',
            tracking_id: crypto.randomUUID(),
          })
          .select('*, contacts(*)')
          .single()

        if (campaignContactData) {
          setContacts([...contacts, campaignContactData])
          setNewContactEmail('')
          setNewContactName('')
        }
      }
    } catch (error) {
      console.error('Error adding contact:', error)
    }
  }

  const handleSendCampaign = async () => {
    if (!campaign || contacts.length === 0) {
      alert('Please add contacts before sending')
      return
    }

    setSending(true)
    try {
      // Update campaign status
      await supabase
        .from('campaigns')
        .update({
          status: 'sent',
          sent_count: contacts.length,
          total_recipients: contacts.length,
        })
        .eq('id', campaign.id)

      // Update campaign contacts to sent
      await supabase
        .from('campaign_contacts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('campaign_id', campaign.id)

      setCampaign({ ...campaign, status: 'sent', sent_count: contacts.length })
      alert('Campaign sent successfully!')
    } catch (error) {
      console.error('Error sending campaign:', error)
      alert('Failed to send campaign')
    } finally {
      setSending(false)
    }
  }

  const handleRemoveContact = async (contactId: string) => {
    try {
      await supabase.from('campaign_contacts').delete().eq('id', contactId)
      setContacts(contacts.filter((c) => c.id !== contactId))
    } catch (error) {
      console.error('Error removing contact:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading campaign...</div>
  }

  if (!campaign) {
    return <div className="text-center py-12">Campaign not found</div>
  }

  return (
    <div className="space-y-6">
      <Link href="/protected/campaigns" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Back to Campaigns
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <p className="text-muted-foreground mt-2">{campaign.subject}</p>
        </div>
        <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'}>
          {campaign.status}
        </Badge>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email Body</Label>
                <div className="mt-2 p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap break-words">
                  {campaign.body_html}
                </div>
              </div>
              {campaign.status === 'draft' && (
                <Button
                  onClick={handleSendCampaign}
                  disabled={sending || contacts.length === 0}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send Campaign'}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients">
          <Card>
            <CardHeader>
              <CardTitle>Recipients ({contacts.length})</CardTitle>
              <CardDescription>Manage campaign recipients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <Label>Quick Add from Tag</Label>
                  <select
                    className="w-full mt-1 bg-background border border-input rounded-md px-3 py-2 text-sm"
                    onChange={async (e) => {
                      const tagId = e.target.value
                      if (!tagId) return
                      const result = await addTagContactsToCampaign(campaignId, tagId)
                      if (result.success) {
                        alert(`Added ${result.count} contacts from tag`)
                        window.location.reload()
                      } else {
                        alert(result.error)
                      }
                      e.target.value = ""
                    }}
                  >
                    <option value="">Select a tag...</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="text-muted-foreground text-xs pt-5 italic">
                  Adds all contacts tagged with this tag.
                </div>
              </div>

              <form onSubmit={handleAddContact} className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="recipient@example.com"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Name (Optional)</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full gap-2">
                      <Plus className="w-4 h-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </form>

              <div className="space-y-2">
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recipients yet</p>
                ) : (
                  contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{contact.contacts.email}</div>
                        {contact.contacts.name && (
                          <div className="text-sm text-muted-foreground">{contact.contacts.name}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{contact.status}</Badge>
                        <button
                          onClick={() => handleRemoveContact(contact.id)}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 border border-border rounded-lg">
                  <div className="text-sm text-muted-foreground">Sent</div>
                  <div className="text-2xl font-bold mt-2">{campaign.sent_count}</div>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <div className="text-sm text-muted-foreground">Opened</div>
                  <div className="text-2xl font-bold mt-2">{campaign.opened_count}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {campaign.sent_count > 0
                      ? ((campaign.opened_count / campaign.sent_count) * 100).toFixed(1)
                      : 0}
                    %
                  </div>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <div className="text-sm text-muted-foreground">Clicked</div>
                  <div className="text-2xl font-bold mt-2">{campaign.clicked_count}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {campaign.sent_count > 0
                      ? ((campaign.clicked_count / campaign.sent_count) * 100).toFixed(1)
                      : 0}
                    %
                  </div>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <div className="text-sm text-muted-foreground">Failed</div>
                  <div className="text-2xl font-bold mt-2">{campaign.failed_count || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
