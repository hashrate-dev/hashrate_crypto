import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseBackend } from './backendMode'

let client: SupabaseClient | null = null

/** Evita URLs mal copiadas (…/rest/v1 o …/auth/v1) que rompen Auth y devuelven 404. */
export function normalizeSupabaseUrl(raw: string): string {
  let u = String(raw).trim().replace(/\/+$/, '')
  u = u.replace(/\/rest\/v1$/i, '')
  u = u.replace(/\/auth\/v1$/i, '')
  return u.replace(/\/+$/, '')
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseBackend()) {
    throw new Error('VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY no están configurados')
  }
  if (!client) {
    const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL!)
    client = createClient(url, import.meta.env.VITE_SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
