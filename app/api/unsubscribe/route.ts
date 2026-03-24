// app/api/unsubscribe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { verifyUnsubscribeToken } from '@/lib/email'

const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    const token = searchParams.get('token')

    if (!email || !token) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Verify the HMAC token to prevent malicious unsubscribes
    if (!verifyUnsubscribeToken(email, token)) {
        return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 400 })
    }

    try {
        // Update contact to be unsubscribed
        const { error } = await supabaseAdmin
            .from('contacts')
            .update({ is_unsubscribed: true })
            .eq('email', email.toLowerCase())

        if (error) {
            console.error('Unsubscribe error:', error)
            return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
        }

        // Redirect to a confirmation page
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        return NextResponse.redirect(`${baseUrl}/unsubscribe/confirmed`)
    } catch (error) {
        console.error('Unexpected error in unsubscribe:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
