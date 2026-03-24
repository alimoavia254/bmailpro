import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin ? user : null
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get app settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('*')

  // Get subscription plans
  const { data: plans } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .order('price', { ascending: true })

  return NextResponse.json({ settings, plans })
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { type, data } = body

  try {
    if (type === 'settings') {
      // Update app settings
      for (const [key, value] of Object.entries(data)) {
        await supabaseAdmin
          .from('app_settings')
          .upsert({
            key,
            value: JSON.stringify(value),
            updated_at: new Date().toISOString(),
            updated_by: admin.id
          })
      }

      // Log activity
      await supabaseAdmin.from('activity_logs').insert({
        user_id: admin.id,
        action: 'settings_updated',
        details: { updated_keys: Object.keys(data) }
      })

    } else if (type === 'plan') {
      // Update subscription plan
      const { id, features, ...planData } = data

      // Convert features array to JSON if present
      const updateData: any = {
        ...planData
      }
      
      if (features) {
        updateData.features = JSON.stringify(features)
      }

      await supabaseAdmin
        .from('subscription_plans')
        .update(updateData)
        .eq('id', id)

      // Log activity
      await supabaseAdmin.from('activity_logs').insert({
        user_id: admin.id,
        action: 'plan_updated',
        details: { plan_id: id, changes: planData }
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
