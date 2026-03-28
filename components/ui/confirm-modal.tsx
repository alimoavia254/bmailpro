'use client'

import { useCallback, useState } from 'react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'success' | 'default'
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((v: boolean) => void) | null
}

const ICONS = {
  danger: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  success: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13M22 2 15 22 11 13 2 9l20-7z"/>
    </svg>
  ),
  default: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
    </svg>
  ),
}

const COLORS = {
  danger:  { icon: '#ef4444', bg: 'rgba(239,68,68,0.1)',  btn: '#ef4444', btnHover: '#dc2626' },
  success: { icon: '#10b981', bg: 'rgba(16,185,129,0.1)', btn: '#10b981', btnHover: '#059669' },
  default: { icon: '#7c5cfc', bg: 'rgba(124,92,252,0.1)', btn: '#7c5cfc', btnHover: '#6d4ef0' },
}

function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const c = COLORS[variant]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'cmFadeIn 0.15s ease',
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-title"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          background: 'var(--card, #ffffff)',
          borderRadius: 18,
          padding: '2rem',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 24px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
          pointerEvents: 'auto',
          animation: 'cmSlideUp 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
        }}>
          {/* Icon + Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: c.bg, color: c.icon,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {ICONS[variant]}
            </div>
            <div style={{ paddingTop: 2 }}>
              <div id="cm-title" style={{
                fontWeight: 700, fontSize: '1.0625rem',
                color: 'var(--foreground, #0e0e16)',
                lineHeight: 1.3, marginBottom: '0.35rem',
              }}>
                {title}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--muted, #64748b)',
                lineHeight: 1.55,
              }}>
                {message}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '9px 20px', borderRadius: 9, border: '1.5px solid var(--border, #e2e4f0)',
                background: 'transparent', color: 'var(--muted, #64748b)',
                fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg, #f7f8fc)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              autoFocus
              style={{
                padding: '9px 22px', borderRadius: 9, border: 'none',
                background: c.btn, color: '#fff',
                fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                boxShadow: `0 4px 16px ${c.btn}44`,
                transition: 'opacity 0.15s, transform 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cmFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cmSlideUp { from { opacity: 0; transform: scale(0.94) translateY(10px) } to { opacity: 1; transform: none } }
      `}</style>
    </>
  )
}

/** Promise-based confirm hook. Call `await confirm({...})` anywhere inside the component. */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false, title: '', message: '', resolve: null,
  })

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, resolve, ...opts })
    })
  }, [])

  const handle = (result: boolean) => {
    state.resolve?.(result)
    setState((s) => ({ ...s, open: false, resolve: null }))
  }

  const modal = state.open ? (
    <ConfirmModal
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={() => handle(true)}
      onCancel={() => handle(false)}
    />
  ) : null

  return { confirm, modal }
}
