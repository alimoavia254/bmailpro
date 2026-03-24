import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useEmailLimit() {
  const [limit, setLimit] = useState(0)
  const [dailySent, setDailySent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [canSendEmail, setCanSendEmail] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkLimit = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_status, subscription_plan, daily_emails_sent, last_email_date')
          .eq('id', user.id)
          .single()

        if (!profile) return

        // Get app settings
        const { data: settings } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'free_email_limit')
          .single()

        const freeLimit = parseInt(settings?.value || '5')

        // Check if user has active subscription
        if (profile.subscription_status === 'active') {
          setLimit(999999) // Unlimited for paid users
          setCanSendEmail(true)
        } else {
          // Free user - check if reached limit today
          const today = new Date().toISOString().split('T')[0]
          const lastEmailDate = profile.last_email_date
          const emailsSentToday = lastEmailDate === today ? profile.daily_emails_sent : 0

          setLimit(freeLimit)
          setDailySent(emailsSentToday)
          setCanSendEmail(emailsSentToday < freeLimit)
        }
      } catch (error) {
        console.error('Error checking email limit:', error)
      } finally {
        setLoading(false)
      }
    }

    checkLimit()
  }, [supabase])

  return { limit, dailySent, canSendEmail, loading }
}
