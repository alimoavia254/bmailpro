'use server'

import { createClient } from '@/lib/supabase/server'

export async function addContact(email: string, name?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      {
        user_id: user.id,
        email,
        name: name || email.split('@')[0],
      },
      { onConflict: 'user_id,email' }
    )
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function getContacts() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function deleteContact(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function importContacts(emails: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const contactInserts = emails.map((email) => ({
    user_id: user.id,
    email: email.trim(),
    name: email.split('@')[0],
  }))

  const { data, error } = await supabase
    .from('contacts')
    .upsert(contactInserts, { onConflict: 'user_id,email' })
    .select()

  if (error) {
    return { error: error.message }
  }

  return { data, count: data?.length || 0 }
}
