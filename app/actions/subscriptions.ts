'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAppSettings() {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
    
    if (error) throw error
    
    const settings = {
      freeEmailLimit: 5,
      dailySuggestion: 500,
      whatsappNumber: '+923254139900',
      contactMessage: 'Contact us on WhatsApp to upgrade your account'
    }
    
    if (data) {
      data.forEach((setting: any) => {
        if (setting.key === 'free_email_limit') {
          settings.freeEmailLimit = parseInt(setting.value)
        } else if (setting.key === 'daily_send_suggestion') {
          settings.dailySuggestion = parseInt(setting.value)
        } else if (setting.key === 'whatsapp_number') {
          settings.whatsappNumber = setting.value
        }
      })
    }
    
    return { data: settings, error: null }
  } catch (error: any) {
    return { data: null, error: error.message }
  }
}

export async function getSubscriptionPlans() {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error: any) {
    return { data: null, error: error.message }
  }
}

export async function createPaymentRequest(planName: string) {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', planName)
      .single()
    
    if (!plan) throw new Error('Plan not found')
    
    const { data, error } = await supabase
      .from('payment_requests')
      .insert({
        user_id: user.id,
        plan_name: planName,
        amount: plan.price,
        status: 'pending'
      })
      .select()
      .single()
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error: any) {
    return { data: null, error: error.message }
  }
}

export async function getUserPaymentRequests() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return { data, error: null }
  } catch (error: any) {
    return { data: null, error: error.message }
  }
}

export async function logActivity(action: string, details?: any) {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action,
        details: details || null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
      })
    
    if (error) throw error
    
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function resetDailyEmailCount() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const today = new Date().toISOString().split('T')[0]
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_email_date')
      .eq('id', user.id)
      .single()
    
    if (profile?.last_email_date !== today) {
      await supabase
        .from('profiles')
        .update({
          daily_emails_sent: 0,
          last_email_date: today
        })
        .eq('id', user.id)
    }
    
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}
