'use client'

interface SidebarProps {
  user: any
  profile: any
  currentPage: string
  onNavigate: (page: any) => void
  onLogout: () => void
  smtpStatus: 'ok' | 'fail' | 'warn'
}

export default function Sidebar({ user, profile, currentPage, onNavigate, onLogout, smtpStatus }: SidebarProps) {
  const userMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'campaigns', label: 'Campaigns', icon: '📧' },
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

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="s-logo">
        <div className="s-logo-mark">✉</div>
        <span className="s-logo-name">
          Bmail<span className="text-[#60a5fa]">Pro</span>
        </span>
        {profile?.is_admin && (
          <span className="ml-auto text-xs bg-red-500 text-white px-2 py-1 rounded">ADMIN</span>
        )}
      </div>

      {/* Navigation */}
      <div className="s-section">
        {profile?.is_admin ? 'Administration' : 'Main'}
      </div>
      {menuItems.map(item => (
        <button
          key={item.id}
          className={`s-item ${currentPage === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="w-[18px] text-center text-sm">{item.icon}</span>
          {item.label}
        </button>
      ))}

      {!profile?.is_admin && (
        <>
          <div className="s-section">Account</div>
          <button
            className={`s-item ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => onNavigate('settings')}
          >
            <span className="w-[18px] text-center text-sm">⚙️</span>
            Settings
          </button>
        </>
      )}

      {/* Footer */}
      <div className="s-footer">
        <div className="s-user">
          <div className="font-semibold text-white text-[13px] mb-[2px]">
            {profile?.full_name || user?.email?.split('@')[0] || 'User'}
          </div>
          <div className="text-[11.5px] text-white/35 break-all">
            {user?.email}
          </div>
        </div>

        {!profile?.is_admin && (
          <>
            {/* SMTP Status */}
            <div className={`s-smtp ${smtpStatus}`}>
              {smtpStatus === 'ok' && '✅ Gmail Connected'}
              {smtpStatus === 'fail' && '❌ Gmail Error'}
              {smtpStatus === 'warn' && '⚠️ Gmail Not Set'}
            </div>

            {/* Subscription Badge */}
            <div className="mt-2 px-[10px]">
              <button
                onClick={() => onNavigate('upgrade')}
                className={`pill w-full text-center cursor-pointer hover:opacity-80 transition-opacity ${
                  profile?.subscription_status === 'active' ? 'p-purple' : 'p-draft'
                }`}
              >
                {profile?.subscription_status === 'active' 
                  ? `${profile?.subscription_tier?.toUpperCase() || 'PRO'}` 
                  : profile?.subscription_status === 'pending'
                    ? 'PENDING'
                    : 'FREE - Upgrade'
                }
              </button>
            </div>
          </>
        )}

        {/* Logout Button */}
        <button
          className="s-item mt-3 text-[#fca5a5] hover:bg-[rgba(224,49,49,0.13)]"
          onClick={onLogout}
        >
          <span className="w-[18px] text-center text-sm">🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  )
}
