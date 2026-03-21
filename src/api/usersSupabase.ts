/**
 * Usuarios y 2FA vía Supabase Auth + tabla public.profiles.
 * Los proxies (Binance, Solana, Jupiter, LNbits, etc.) siguen en VITE_API_URL.
 */
import { authenticator } from 'otplib'
import { getSupabase, normalizeSupabaseUrl } from '../lib/supabaseClient'
import { profileRowToUser, type ProfileRow } from './profileMapper'
import { loadProfileWithRepair } from './supabaseProfileLoader'
import type {
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  UpdateUserPayload,
  UpdateWalletsPayload,
  User,
} from './users'

export type { ProfileRow } from './profileMapper'
export { profileRowToUser } from './profileMapper'

export const BACKEND_NOT_RUNNING_MSG_SB =
  'No se pudo conectar con Supabase. Revisá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel.'

async function fetchOwnProfile(sb: ReturnType<typeof getSupabase>): Promise<ProfileRow> {
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Sesión no válida')
  return loadProfileWithRepair(sb, user.id)
}

export async function registerUser(data: RegisterPayload): Promise<RegisterResponse> {
  const sb = getSupabase()
  const email = data.email.trim().toLowerCase()
  const { data: authData, error } = await sb.auth.signUp({
    email,
    password: data.password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      data: {
        first_name: data.firstName.trim(),
        second_name: data.secondName?.trim() ?? '',
        first_surname: data.firstSurname.trim(),
        second_surname: data.secondSurname?.trim() ?? '',
      },
    },
  })
  if (error) {
    if (/already registered|already been registered|User already/i.test(error.message)) {
      throw new Error('Ya existe un usuario con ese email.')
    }
    throw new Error(error.message || 'Error al registrar')
  }
  if (!authData.user) throw new Error('No se pudo crear el usuario.')
  if (!authData.session) {
    throw new Error(
      'Supabase no devolvió sesión al registrarte. En Authentication → Email desactivá “Confirm email” para usar la wallet al instante, o confirmá el correo e iniciá sesión.'
    )
  }
  const prof = await loadProfileWithRepair(sb, authData.user.id)
  return {
    message: 'Usuario registrado correctamente.',
    user: profileRowToUser(prof),
  }
}

export async function loginUser(data: LoginPayload): Promise<{ user: User }> {
  const sb = getSupabase()
  const { data: authData, error } = await sb.auth.signInWithPassword({
    email: data.email.trim().toLowerCase(),
    password: data.password,
  })
  if (error || !authData.user) {
    throw new Error('Email o contraseña incorrectos.')
  }
  const row = await loadProfileWithRepair(sb, authData.user.id)
  const { error: logErr } = await sb.from('access_log').insert({
    user_numeric_id: row.numeric_id,
    email: row.email,
    first_name: row.first_name,
    first_surname: row.first_surname,
  })
  if (logErr) {
    console.warn('[access_log]', logErr.message)
  }
  return { user: profileRowToUser(row) }
}

export async function getUserById(id: number): Promise<{ user: User }> {
  const sb = getSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Usuario no encontrado')
  const row = await loadProfileWithRepair(sb, user.id)
  if (Number(row.numeric_id) !== id) {
    throw new Error('Usuario no encontrado')
  }
  return { user: profileRowToUser(row) }
}

export async function getUserByEmail(_email: string): Promise<{ user: User }> {
  throw new Error('Consulta por email no disponible en modo Supabase.')
}

export async function updateUser(_id: number, payload: UpdateUserPayload): Promise<{ message: string; user: User }> {
  const sb = getSupabase()
  const row = await fetchOwnProfile(sb)
  const patch: Record<string, unknown> = {}
  if (payload.firstName != null) patch.first_name = String(payload.firstName).trim()
  if (payload.secondName !== undefined) {
    patch.second_name = payload.secondName != null ? String(payload.secondName).trim() : null
  }
  if (payload.firstSurname != null) patch.first_surname = String(payload.firstSurname).trim()
  if (payload.secondSurname !== undefined) {
    patch.second_surname = payload.secondSurname != null ? String(payload.secondSurname).trim() : null
  }
  if (payload.lightningAddress !== undefined) {
    patch.lightning_address = payload.lightningAddress != null ? String(payload.lightningAddress).trim() : null
  }
  const { data, error } = await sb.from('profiles').update(patch).eq('id', row.id).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Error al actualizar')
  return { message: 'Datos actualizados correctamente.', user: profileRowToUser(data as ProfileRow) }
}

function hasAnyWallet(row: ProfileRow): boolean {
  return Boolean(
    (row.btc_address && row.btc_address.trim()) ||
      (row.usdt_address && row.usdt_address.trim()) ||
      (row.doge_address && row.doge_address.trim()) ||
      (row.ltc_address && row.ltc_address.trim()) ||
      (row.eth_address && row.eth_address.trim()) ||
      (row.sol_address && row.sol_address.trim())
  )
}

export async function updateUserWallets(
  _id: number,
  data: UpdateWalletsPayload
): Promise<{ message: string; user: User }> {
  const sb = getSupabase()
  const row = await fetchOwnProfile(sb)
  if (hasAnyWallet(row)) {
    if (!data.password?.trim()) {
      throw new Error('Para generar una nueva frase semilla tenés que ingresar tu contraseña.')
    }
    const { error: reErr } = await sb.auth.signInWithPassword({
      email: row.email,
      password: data.password,
    })
    if (reErr) throw new Error('Contraseña incorrecta.')
  }
  const patch: Record<string, unknown> = {
    btc_address: data.btcAddress.trim(),
    usdt_address: data.usdtAddress.trim(),
    doge_address: data.dogeAddress?.trim() ?? null,
    ltc_address: data.ltcAddress?.trim() ?? null,
    eth_address: data.ethAddress?.trim() ?? null,
    sol_address: data.solAddress?.trim() ?? null,
  }
  if (data.encryptedSeed !== undefined) patch.encrypted_seed = data.encryptedSeed ?? null
  if (data.seedSalt !== undefined) patch.seed_salt = data.seedSalt ?? null

  const { data: updated, error } = await sb.from('profiles').update(patch).eq('id', row.id).select('*').single()
  if (error || !updated) throw new Error(error?.message ?? 'Error al vincular las direcciones')
  return { message: 'Direcciones actualizadas.', user: profileRowToUser(updated as ProfileRow) }
}

export async function getEncryptedSeed(_id: number): Promise<{ encryptedSeed: string; seedSalt: string }> {
  const sb = getSupabase()
  const row = await fetchOwnProfile(sb)
  if (!row.encrypted_seed || !row.seed_salt) {
    throw new Error('No hay frase cifrada guardada.')
  }
  return { encryptedSeed: row.encrypted_seed, seedSalt: row.seed_salt }
}

export async function deleteUser(_id: number): Promise<{ message: string }> {
  throw new Error('Usá eliminar cuenta con contraseña (deleteUserWithPassword).')
}

async function invokeDeleteAccount(): Promise<void> {
  const sb = getSupabase()
  const { data: { session } } = await sb.auth.getSession()
  if (!session?.access_token) throw new Error('Sesión no válida')
  const raw = import.meta.env.VITE_SUPABASE_URL
  if (!raw) throw new Error('VITE_SUPABASE_URL no configurada')
  const base = normalizeSupabaseUrl(raw)
  const res = await fetch(`${base}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!res.ok) {
    throw new Error(json.error || 'No se pudo eliminar la cuenta. Desplegá la Edge Function delete-account en Supabase.')
  }
}

export async function deleteUserWithPassword(_id: number, password: string): Promise<{ message: string }> {
  const sb = getSupabase()
  const row = await fetchOwnProfile(sb)
  const { error } = await sb.auth.signInWithPassword({ email: row.email, password: password.trim() })
  if (error) throw new Error('Contraseña incorrecta.')
  await invokeDeleteAccount()
  await sb.auth.signOut()
  return { message: 'Cuenta eliminada.' }
}

export async function changePassword(_id: number, data: ChangePasswordPayload): Promise<{ message: string }> {
  const sb = getSupabase()
  const row = await fetchOwnProfile(sb)
  if (!data.newPassword) throw new Error('Falta la nueva contraseña.')

  if (data.pin != null) {
    const { data: ok, error: rpcErr } = await sb.rpc('verify_user_pin', { _pin: data.pin.replace(/\s/g, '') })
    if (rpcErr || !ok) throw new Error('PIN incorrecto.')
  } else if (data.currentPassword != null) {
    const { error: reErr } = await sb.auth.signInWithPassword({
      email: row.email,
      password: data.currentPassword,
    })
    if (reErr) throw new Error('Contraseña actual incorrecta.')
  } else {
    throw new Error('Ingresá tu contraseña actual o tu PIN.')
  }

  const { error: upErr } = await sb.auth.updateUser({ password: data.newPassword })
  if (upErr) throw new Error(upErr.message || 'Error al cambiar la contraseña')
  return { message: 'Contraseña actualizada correctamente.' }
}

export async function setUserPin(_id: number, pin: string): Promise<{ message: string }> {
  const sb = getSupabase()
  const { error } = await sb.rpc('set_user_pin', { _pin: pin })
  if (error) throw new Error(error.message || 'Error al guardar el PIN')
  return { message: 'PIN guardado.' }
}

export async function clearUserPin(_id: number): Promise<{ message: string }> {
  const sb = getSupabase()
  const { error } = await sb.rpc('clear_user_pin')
  if (error) throw new Error(error.message || 'Error al eliminar el PIN')
  return { message: 'PIN eliminado.' }
}

export async function getTotpSetup(_id: number): Promise<{ secret: string; otpauthUrl: string }> {
  const sb = getSupabase()
  const { data: { user } } = await sb.auth.getUser()
  const email = user?.email ?? 'usuario'
  const secret = authenticator.generateSecret()
  const otpauthUrl = authenticator.keyuri(email, 'Imperium Wallet', secret)
  return { secret, otpauthUrl }
}

export async function enableTotp(_id: number, secret: string, token: string): Promise<{ message: string; user: User }> {
  const sb = getSupabase()
  const row = await fetchOwnProfile(sb)
  const ok = authenticator.verify({ token: token.replace(/\s/g, ''), secret: secret.trim() })
  if (!ok) throw new Error('Código incorrecto. Verificá el código de 6 dígitos de Google Authenticator.')
  const { data, error } = await sb
    .from('profiles')
    .update({ totp_secret: secret.trim() })
    .eq('id', row.id)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Error al activar 2FA')
  return { message: 'Google Authenticator activado.', user: profileRowToUser(data as ProfileRow) }
}

export async function verifyTotp(_id: number, token: string): Promise<{ ok: boolean }> {
  const sb = getSupabase()
  const row = await fetchOwnProfile(sb)
  if (!row.totp_secret) throw new Error('La cuenta no tiene 2FA activado.')
  const ok = authenticator.verify({
    token: token.replace(/\s/g, ''),
    secret: row.totp_secret,
  })
  if (!ok) throw new Error('Código incorrecto.')
  return { ok: true }
}

export async function disableTotp(_id: number, password: string): Promise<{ message: string; user: User }> {
  const sb = getSupabase()
  const row = await fetchOwnProfile(sb)
  const { error: reErr } = await sb.auth.signInWithPassword({
    email: row.email,
    password: password.trim(),
  })
  if (reErr) throw new Error('Contraseña incorrecta.')
  const { data, error } = await sb
    .from('profiles')
    .update({ totp_secret: null })
    .eq('id', row.id)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Error al desactivar 2FA')
  return { message: 'Google Authenticator desactivado.', user: profileRowToUser(data as ProfileRow) }
}
