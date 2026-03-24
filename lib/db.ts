import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

// Initialize database schema if needed
export async function initializeDatabase() {
  const supabase = await createClient()

  try {
    // Create profiles table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          full_name TEXT,
          subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
          emails_sent_this_month INTEGER NOT NULL DEFAULT 0,
          month_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          smtp_email TEXT,
          smtp_password TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    // Additional table creations would go here
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization error:', error)
    throw error
  }
}

// Get user profile
export async function getUserProfile(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: {
    full_name?: string
    smtp_email?: string
    smtp_password?: string
    subscription_tier?: 'free' | 'pro'
    subscription_status?: 'free' | 'active' | 'expired'
    is_admin?: boolean
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Create campaign
export async function createCampaign(
  userId: string,
  campaign: {
    name: string
    subject: string
    body_html: string  // Bug #6 fixed: standardized to body_html
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: userId,
      ...campaign,
      status: 'draft'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Get user campaigns
export async function getUserCampaigns(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// Get campaign by ID
export async function getCampaignById(campaignId: string, userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data
}

// Add contact
export async function addContact(
  userId: string,
  contact: {
    email: string
    name?: string
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      user_id: userId,
      ...contact
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Get user contacts
export async function getUserContacts(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// Add contacts to campaign
export async function addContactsToCampaign(
  campaignId: string,
  contactIds: string[]
) {
  const supabase = await createClient()

  const trackingIds = contactIds.map(() => crypto.randomUUID())

  const { data, error } = await supabase
    .from('campaign_contacts')
    .insert(
      contactIds.map((contactId, index) => ({
        campaign_id: campaignId,
        contact_id: contactId,
        status: 'pending',
        tracking_id: trackingIds[index]
      }))
    )
    .select()

  if (error) throw error
  return data
}

// Get campaign contacts with email
export async function getCampaignContacts(campaignId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaign_contacts')
    .select(`
      id,
      status,
      sent_at,
      opened_at,
      clicked_at,
      tracking_id,
      contacts!inner (
        email,
        name
      )
    `)
    .eq('campaign_id', campaignId)

  if (error) throw error
  return data
}

// Update campaign status
export async function updateCampaignStatus(
  campaignId: string,
  status: 'draft' | 'sending' | 'sent' | 'paused' | 'failed' | 'scheduled' // Bug #9: added 'failed' + 'scheduled'
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .update({ status, updated_at: new Date() })
    .eq('id', campaignId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Update campaign stats
export async function updateCampaignStats(
  campaignId: string,
  stats: {
    sent_count?: number
    opened_count?: number
    clicked_count?: number
    failed_count?: number
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .update({ ...stats, updated_at: new Date() })
    .eq('id', campaignId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Log tracking event
export async function logTrackingEvent(
  campaignContactId: string,
  eventType: 'open' | 'click',
  ipAddress?: string,
  userAgent?: string,
  linkUrl?: string
) {
  const serviceRoleClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await serviceRoleClient
    .from('tracking_events')
    .insert({
      campaign_contact_id: campaignContactId,
      event_type: eventType,
      ip_address: ipAddress,
      user_agent: userAgent,
      link_url: linkUrl
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Get campaign analytics
export async function getCampaignAnalytics(campaignId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (error) throw error
  return data
}
