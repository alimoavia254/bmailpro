import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      data,
      total: count,
      limit,
      offset
    })
  } catch (error: any) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name, bulkImport } = body

    if (bulkImport && Array.isArray(bulkImport)) {
      // Bulk import
      const contacts = bulkImport.map((contact: any) => ({
        user_id: user.id,
        email: contact.email || contact,
        name: contact.name || ''
      }))

      const { error } = await supabase
        .from('contacts')
        .upsert(contacts, { onConflict: 'user_id,email' })

      if (error) throw error

      return NextResponse.json({
        success: true,
        imported: contacts.length
      })
    } else {
      // Single contact
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          email,
          name: name || ''
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json(data, { status: 201 })
    }
  } catch (error: any) {
    console.error('Error creating contact:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('id')

    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting contact:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
