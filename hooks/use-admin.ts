import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Hardcoded admin email - this user always gets admin access
const ADMIN_EMAIL = 'alimoavia80@gmail.com'

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // Check if this is the hardcoded admin email
        const isHardcodedAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
        
        if (isHardcodedAdmin) {
          setIsAdmin(true)
          setLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        setIsAdmin(profile?.is_admin ?? false)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [supabase])

  return { isAdmin, loading }
}
