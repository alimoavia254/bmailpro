import Cookies from 'js-cookie'

export const COOKIE_KEYS = {
  USER_PLAN: 'bmail_plan',
  USER_NAME: 'bmail_name',
  SMTP_VERIFIED: 'bmail_smtp_ok',
  EMAILS_THIS_MONTH: 'bmail_emails_count',
  IS_ADMIN: 'bmail_is_admin',
  USER_ID: 'bmail_user_id',
}

export interface Profile {
  id: string
  email: string
  full_name?: string
  subscription_tier: 'free' | 'monthly' | 'quarterly'
  subscription_status: 'active' | 'inactive' | 'expired' | 'pending'
  emails_sent_this_month: number
  smtp_verified: boolean
  is_admin: boolean
  is_active: boolean
}

export function syncUserCookies(profile: Profile) {
  try {
    Cookies.set(COOKIE_KEYS.USER_PLAN, profile.subscription_tier, {
      expires: 30,
    })
    Cookies.set(COOKIE_KEYS.USER_NAME, profile.full_name || '', {
      expires: 30,
    })
    Cookies.set(COOKIE_KEYS.SMTP_VERIFIED, String(profile.smtp_verified), {
      expires: 30,
    })
    Cookies.set(
      COOKIE_KEYS.EMAILS_THIS_MONTH,
      String(profile.emails_sent_this_month),
      { expires: 30 }
    )
    Cookies.set(COOKIE_KEYS.IS_ADMIN, String(profile.is_admin), {
      expires: 30,
    })
    Cookies.set(COOKIE_KEYS.USER_ID, profile.id, {
      expires: 30,
    })
  } catch (error) {
    console.error('[v0] Error syncing cookies:', error)
  }
}

export function clearUserCookies() {
  Object.values(COOKIE_KEYS).forEach((key) => {
    Cookies.remove(key)
  })
}

export function getUserCookie(key: string) {
  try {
    return Cookies.get(key)
  } catch (error) {
    return undefined
  }
}

export function isAdminFromCookie(): boolean {
  try {
    const isAdmin = Cookies.get(COOKIE_KEYS.IS_ADMIN)
    return isAdmin === 'true'
  } catch {
    return false
  }
}
