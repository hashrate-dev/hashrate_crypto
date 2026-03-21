/**
 * Carga de public.profiles con sesión Supabase + reparación si falta la fila (RPC ensure_my_profile).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { profileRowToUser, type ProfileRow } from './profileMapper'
import type { User } from './users'

function explainProfileError(err: { message?: string; code?: string } | null): string {
  const msg = err?.message ?? ''
  const code = err?.code ?? ''
  if (/could not find the table|schema cache|PGRST205|42P01/i.test(msg + code)) {
    return 'No existe la tabla profiles en Supabase. Ejecutá el SQL de supabase/migrations/20250308120000_wallet_profiles.sql (guía en supabase/README.md).'
  }
  if (code === 'PGRST116' || /0 rows|contains 0 rows/i.test(msg)) {
    return 'No hay perfil para tu usuario. Ejecutá en Supabase el SQL de 20250309100000_ensure_profile_rpc.sql y volvé a entrar.'
  }
  return msg || 'Error al leer el perfil'
}

export async function loadProfileWithRepair(sb: SupabaseClient, userId: string): Promise<ProfileRow> {
  let { data: prof, error: pe } = await sb.from('profiles').select('*').eq('id', userId).single()
  const missingRow =
    pe?.code === 'PGRST116' || (pe != null && /0 rows|contains 0 rows/i.test(pe.message))
  if (missingRow) {
    const { error: rpcErr } = await sb.rpc('ensure_my_profile')
    if (rpcErr) {
      throw new Error(
        `No se pudo crear el perfil automáticamente. Ejecutá las migraciones SQL en supabase/migrations/. Detalle: ${rpcErr.message}`
      )
    }
    const second = await sb.from('profiles').select('*').eq('id', userId).single()
    prof = second.data
    pe = second.error
  }
  if (pe || !prof) throw new Error(explainProfileError(pe))
  return prof as ProfileRow
}

export async function loadUserFromSupabaseSession(sb: SupabaseClient, userId: string): Promise<User> {
  const row = await loadProfileWithRepair(sb, userId)
  return profileRowToUser(row)
}
