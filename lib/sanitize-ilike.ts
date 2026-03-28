/**
 * Neutralize `%`, `_`, and `,` for safe use inside PostgREST `.or(...ilike...)` filters.
 */
export function sanitizeIlikeSearchTerm(raw: string, maxLen = 200): string {
  return raw.trim().slice(0, maxLen).replace(/[%_,]/g, ' ').replace(/\s+/g, ' ')
}
