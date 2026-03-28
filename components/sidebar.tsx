'use client'

interface SidebarProps {
  user: any
  profile: any
  currentPage: string
  onNavigate: (page: any) => void
  onLogout: () => void
  smtpStatus: 'ok' | 'fail' | 'warn'
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({
  user,
  profile,
  currentPage,
  onNavigate,
  onLogout,
  smtpStatus,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const userMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'campaigns', label: 'Campaigns', icon: '📧' },
    { id: 'contacts', label: 'Contacts', icon: '👥' },
    { id: 'new', label: 'New Campaign', icon: '✏️' },
    { id: 'templates', label: 'Templates', icon: '📄' },
  ]

  const adminMenuItems = [
    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: '🎛️' },
    { id: 'admin-users', label: 'Manage Users', icon: '👥' },
    { id: 'admin-payments', label: 'Payments', icon: '💳' },
    { id: 'admin-activity', label: 'Activity Logs', icon: '📋' },
    { id: 'admin-settings', label: 'Admin Settings', icon: '⚙️' },
  ]

  const menuItems = profile?.is_admin ? adminMenuItems : userMenuItems

  const handleNav = (page: any) => {
    onNavigate(page)
    onClose?.()
  }

  return (
    <>
      {/* Mobile overlay — tap to close */}
      <div
        className={`sidebar-overlay ${isOpen ? 'sidebar-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="s-logo">
          <div className="s-logo-mark" aria-hidden="true">✉</div>
          <span className="s-logo-name">
            Bmail<span className="text-[#60a5fa]">Pro</span>
          </span>
          {profile?.is_admin && (
            <span className="ml-auto text-xs bg-red-500 text-white px-2 py-1 rounded" aria-label="Admin role">
              ADMIN
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Page navigation">
          <div className="s-section">
            {profile?.is_admin ? 'Administration' : 'Main'}
          </div>
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`s-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => handleNav(item.id)}
              aria-current={currentPage === item.id ? 'page' : undefined}
            >
              <span className="w-[18px] text-center text-sm" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}

          {!profile?.is_admin && (
            <>
              <div className="s-section">Account</div>
              <button
                className={`s-item ${currentPage === 'settings' ? 'active' : ''}`}
                onClick={() => handleNav('settings')}
                aria-current={currentPage === 'settings' ? 'page' : undefined}
              >
                <span className="w-[18px] text-center text-sm" aria-hidden="true">⚙️</span>
                Settings
              </button>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="s-footer">
          <div className="s-user">
            <div className="font-semibold text-white text-[13px] mb-[2px] truncate">
              {profile?.full_name || user?.email?.split('@')[0] || 'User'}
            </div>
            <div className="text-[11.5px] text-white/35 break-all">
              {user?.email}
            </div>
          </div>

          {!profile?.is_admin && (
            <>
              <div className={`s-smtp ${smtpStatus}`} role="status" aria-label={`SMTP status: ${smtpStatus}`}>
                {smtpStatus === 'ok'   && '✅ Gmail Connected'}
                {smtpStatus === 'fail' && '❌ Gmail Error'}
                {smtpStatus === 'warn' && '⚠️ Gmail Not Set'}
              </div>

              <div className="mt-2 px-[10px]">
                <button
                  onClick={() => handleNav('upgrade')}
                  className={`pill w-full text-center cursor-pointer hover:opacity-80 transition-opacity ${
                    profile?.subscription_status === 'active' ? 'p-purple' : 'p-draft'
                  }`}
                >
                  {profile?.subscription_status === 'active'
                    ? `${profile?.subscription_tier?.toUpperCase() || 'PRO'}`
                    : profile?.subscription_status === 'pending'
                      ? 'PENDING'
                      : 'FREE — Upgrade'}
                </button>
              </div>
            </>
          )}

          <button
            className="s-item mt-3 text-[#fca5a5] hover:bg-[rgba(224,49,49,0.13)]"
            onClick={onLogout}
            aria-label="Sign out"
          >
            <span className="w-[18px] text-center text-sm" aria-hidden="true">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
