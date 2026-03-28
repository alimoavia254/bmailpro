/** Sync SPA view with the address bar so refresh keeps the same screen (root `/` app). */

const ALL_VIEWS = new Set([
  'dashboard',
  'campaigns',
  'contacts',
  'new',
  'templates',
  'settings',
  'detail',
  'upgrade',
  'admin-dashboard',
  'admin-users',
  'admin-payments',
  'admin-settings',
  'admin-activity',
])

export function parseShellSearch(search: string): { view: string | null; cid: string | null } {
  const q = search.startsWith('?') ? search.slice(1) : search
  const p = new URLSearchParams(q)
  const view = p.get('view')
  const cid = p.get('cid')
  if (!view || !ALL_VIEWS.has(view)) return { view: null, cid: null }
  if (view === 'detail' && (!cid || cid.length < 10)) return { view: null, cid: null }
  return { view, cid: cid || null }
}

export function replaceShellUrl(view: string, cid?: string | null) {
  if (typeof window === 'undefined') return
  const p = new URLSearchParams()
  p.set('view', view)
  if (view === 'detail' && cid) p.set('cid', cid)
  const path = window.location.pathname || '/'
  const qs = p.toString()
  window.history.replaceState(window.history.state, '', qs ? `${path}?${qs}` : path)
}
