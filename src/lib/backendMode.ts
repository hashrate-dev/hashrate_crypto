import { getSupabaseCredentials } from './runtimeBackendConfig'

/** True si el front debe usar Supabase (Auth + Postgres) en lugar del API Node para usuarios/monitor. */
export function isSupabaseBackend(): boolean {
  const { url, key } = getSupabaseCredentials()
  return Boolean(url && key && String(url).trim() && String(key).trim())
}
