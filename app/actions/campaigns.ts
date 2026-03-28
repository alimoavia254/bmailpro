'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import * as Sentry from "@sentry/nextjs";
import { v4 as uuidv4 } from 'uuid'

export async function createCampaign(data: {
  name: string
  subject: string
  body_html: string
  scheduled_at?: string | null
  status?: string
  is_ab_test?: boolean
  variants?: { name: string; subject: string; body_html: string }[]
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name: data.name,
        subject: data.subject,
        body_html: data.body_html,
        scheduled_at: data.scheduled_at,
        status: data.status || 'draft',
        is_ab_test: data.is_ab_test || false,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    // Handle variants if A/B test
    if (data.is_ab_test && data.variants && data.variants.length > 0) {
      const variantInserts = data.variants.map((v) => ({
        campaign_id: campaign.id,
        name: v.name,
        subject: v.subject,
        body_html: v.body_html,
      }))

      const { error: variantError } = await supabase
        .from('campaign_variants')
        .insert(variantInserts)

      if (variantError) {
        console.error('Error inserting variants:', variantError)
        Sentry.captureException(variantError)
      }
    }

    return { data: campaign }
  } catch (err: any) {
    console.error('Create campaign error:', err)
    Sentry.captureException(err)
    return { error: err.message }
  }
}

export async function updateCampaign(id: string, data: Partial<{
  name: string
  subject: string
  body_html: string
  status: string
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: campaign }
}

export async function deleteCampaign(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function getCampaigns() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: campaigns }
}

export async function getCampaign(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data: campaign }
}

export async function addContactsToCampaign(campaignId: string, emails: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify campaign ownership
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, total_recipients')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (campaignError || !campaign) {
    return { error: 'Campaign not found' }
  }

  // Get or create contacts
  const contactInserts = emails.map((email) => ({
    user_id: user.id,
    email,
    name: email.split('@')[0],
  }))

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .upsert(contactInserts, { onConflict: 'user_id,email' })
    .select()

  if (contactsError) {
    return { error: contactsError.message }
  }

  // Add contacts to campaign
  const campaignContactInserts = contacts.map((contact) => ({
    campaign_id: campaignId,
    contact_id: contact.id,
    email: contact.email,
    tracking_id: uuidv4(),
  }))

  const { error: addError } = await supabase
    .from('campaign_contacts')
    .insert(campaignContactInserts)

  if (addError) {
    return { error: addError.message }
  }

  // Update campaign total_recipients
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      total_recipients: (campaign.total_recipients || 0) + campaignContactInserts.length,
    })
    .eq('id', campaignId)

  if (updateError) {
    return { error: updateError.message }
  }

  return { success: true, count: campaignContactInserts.length }
}

export async function addTagContactsToCampaign(campaignId: string, tagId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  // 1. Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, total_recipients')
    .eq('id', campaignId)
    .single()

  if (!campaign) return { error: 'Campaign not found' }

  // 2. Get contacts with this tag
  const { data: tagContacts } = await supabase
    .from('contact_tags')
    .select('contact_id, contacts(email)')
    .eq('tag_id', tagId)

  if (!tagContacts || tagContacts.length === 0) {
    return { error: 'No contacts found with this tag' }
  }

  // 3. Filter out contacts already in campaign
  const { data: existing } = await supabase
    .from('campaign_contacts')
    .select('contact_id')
    .eq('campaign_id', campaignId)

  const existingIds = new Set(existing?.map(e => e.contact_id) || [])
  const newContacts = tagContacts.filter(tc => !existingIds.has(tc.contact_id))

  if (newContacts.length === 0) {
    return { error: 'All contacts from this tag are already in the campaign' }
  }

  // 4. Add to campaign_contacts
  const inserts = newContacts.map(tc => ({
    campaign_id: campaignId,
    contact_id: tc.contact_id,
    tracking_id: uuidv4(),
    email: (tc.contacts as any)?.email
  }))

  const { error: insertError } = await supabase
    .from('campaign_contacts')
    .insert(inserts)

  if (insertError) return { error: insertError.message }

  // 5. Update total_recipients
  await supabase
    .from('campaigns')
    .update({
      total_recipients: (campaign.total_recipients || 0) + inserts.length
    })
    .eq('id', campaignId)

  return { success: true, count: inserts.length }
}

export async function getCampaignContacts(campaignId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: contacts, error } = await supabase
    .from('campaign_contacts')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data: contacts }
}

export async function sendCampaign(campaignId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (campaignError || !campaign) {
    return { error: 'Campaign not found' }
  }

  // Instead of manual updates, call the internal API route that handles real SMTP sending
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const reqHeaders = await headers()
    const cookie = reqHeaders.get('cookie')
    const response = await fetch(`${baseUrl}/api/campaigns/enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({
        campaignId,
        userId: user.id,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      return { error: result.error || 'Failed to send campaign' }
    }

    return { success: true, ...result }
  } catch (err) {
    console.error('Error calling send API:', err)
    Sentry.captureException(err)
    return { error: 'Failed to initiate campaign sending' }
  }
}
