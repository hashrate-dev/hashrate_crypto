/** True si el front debe usar Supabase (Auth + Postgres) en lugar del API Node para usuarios/monitor. */
export function isSupabaseBackend(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return Boolean(url && key && String(url).trim() && String(key).trim())
}
