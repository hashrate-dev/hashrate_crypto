/** Utilidades compartidas (sin depender de @supabase/supabase-js ni backendMode). */

export function normalizeSupabaseUrl(raw: string): string {
  let u = String(raw).trim().replace(/\/+$/, '')
  u = u.replace(/\/rest\/v1$/i, '')
  u = u.replace(/\/auth\/v1$/i, '')
  return u.replace(/\/+$/, '')
}

export function sanitizeSupabaseAnonKey(raw: string): string {
  let k = String(raw).trim().replace(/^\uFEFF/, '')
  k = k.replace(/\r?\n|\r/g, '')
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  return k.replace(/\s+/g, '')
}
