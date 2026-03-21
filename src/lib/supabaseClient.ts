import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseBackend } from './backendMode'
import { getSupabaseCredentials } from './runtimeBackendConfig'
import { normalizeSupabaseUrl, sanitizeSupabaseAnonKey } from './supabaseEnv'

let client: SupabaseClient | null = null

export { normalizeSupabaseUrl, sanitizeSupabaseAnonKey } from './supabaseEnv'

/** Si las credenciales cambian tras /api/public-config, el siguiente getSupabase() crea cliente nuevo. */
export function resetSupabaseClient(): void {
  client = null
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseBackend()) {
    throw new Error('VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY no están configurados')
  }
  if (!client) {
    const { url: rawUrl, key: rawKey } = getSupabaseCredentials()
    const url = normalizeSupabaseUrl(rawUrl)
    const anonKey = sanitizeSupabaseAnonKey(rawKey)
    if (anonKey.startsWith('sb_secret_')) {
      throw new Error(
        'No podés usar la clave SECRET (sb_secret_…) en el navegador: Supabase la rechaza con 401. ' +
          'En Vercel poné la clave **Publishable** (sb_publishable_…) o la **anon** JWT (eyJ…) de Project Settings → API.'
      )
    }
    if (anonKey.length > 0) {
      const looksJwt = anonKey.startsWith('eyJ')
      const looksPublishable = anonKey.startsWith('sb_publishable_')
      if (!looksJwt && !looksPublishable) {
        console.warn(
          '[Supabase] La key no parece JWT (eyJ…) ni Publishable (sb_publishable_). Revisá API Keys en el dashboard.'
        )
      }
    }
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
