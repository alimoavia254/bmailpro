'use server'

import { createClient } from '@/lib/supabase/server'

export async function activateUserSubscription(userId: string, planName: string, amount: string) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Check if current user is admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', currentUser.id)
    .single()

  if (!adminProfile?.is_admin) {
    return { error: 'Not authorized' }
  }

  try {
    const planDays = planName === 'quarterly' ? 90 : 30
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + planDays * 24 * 60 * 60 * 1000)

    // Update user subscription
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        subscription_plan: planName,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate.toISOString(),
        payment_verified_at: new Date().toISOString(),
        payment_verified_by: currentUser.id,
        is_active: true,
      })
      .eq('id', userId)

    if (updateError) {
      return { error: updateError.message }
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'subscription_approved',
      details: {
        plan: planName,
        amount,
        admin_id: currentUser.id,
        approved_at: new Date().toISOString(),
      },
    })

    return { success: true, message: 'Subscription activated successfully' }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function rejectPayment(paymentId: string, userId: string, reason: string) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Check if current user is admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', currentUser.id)
    .single()

  if (!adminProfile?.is_admin) {
    return { error: 'Not authorized' }
  }

  try {
    // Update payment status
    const { error: updateError } = await supabase
      .from('payment_requests')
      .update({
        status: 'rejected',
        notes: reason,
        processed_by: currentUser.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', paymentId)

    if (updateError) {
      return { error: updateError.message }
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'payment_rejected',
      details: {
        payment_id: paymentId,
        reason,
        admin_id: currentUser.id,
      },
    })

    return { success: true, message: 'Payment rejected' }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function updateUserStatus(userId: string, isActive: boolean) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Check if current user is admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', currentUser.id)
    .single()

  if (!adminProfile?.is_admin) {
    return { error: 'Not authorized' }
  }

  try {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: !isActive })
      .eq('id', userId)

    if (updateError) {
      return { error: updateError.message }
    }

    return { success: true, message: `User ${!isActive ? 'activated' : 'deactivated'}` }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function updateAppSetting(key: string, value: string) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Check if current user is admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', currentUser.id)
    .single()

  if (!adminProfile?.is_admin) {
    return { error: 'Not authorized' }
  }

  try {
    const { error: updateError } = await supabase
      .from('app_settings')
      .update({
        value: JSON.stringify(value),
        updated_by: currentUser.id,
      })
      .eq('key', key)

    if (updateError) {
      return { error: updateError.message }
    }

    return { success: true, message: 'Setting updated successfully' }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function updateSubscriptionPlan(
  planId: string,
  displayName: string,
  price: number,
  durationDays: number,
  description: string,
  isActive: boolean
) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  // Check if current user is admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', currentUser.id)
    .single()

  if (!adminProfile?.is_admin) {
    return { error: 'Not authorized' }
  }

  try {
    const { error: updateError } = await supabase
      .from('subscription_plans')
      .update({
        display_name: displayName,
        price,
        duration_days: durationDays,
        description,
        is_active: isActive,
      })
      .eq('id', planId)

    if (updateError) {
      return { error: updateError.message }
    }

    return { success: true, message: 'Plan updated successfully' }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function logActivity(action: string, details: any) {
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase.from('activity_logs').insert({
      user_id: currentUser.id,
      action,
      details,
    })

    if (error) {
      console.error('Error logging activity:', error)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in logActivity:', error)
    return { error: error.message }
  }
}
