/**
 * API de usuarios vía servidor Node (fetch). Ver users.ts para el modo Supabase.
 */
import { apiUrl, getApiBase } from '../lib/apiBase'
import type {
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  UpdateUserPayload,
  UpdateWalletsPayload,
  User,
} from './users'

export const BACKEND_NOT_RUNNING_MSG_LEGACY =
  'No se pudo conectar con el API. En local: npm run dev. En producción: configurá VITE_API_URL con la URL del backend (proxies blockchain).'

/** En Vercel, sin VITE_API_URL, /api/* devuelve 404: evitamos el fetch y mostramos mensaje claro. */
function requireApiBaseInProduction(): void {
  if (import.meta.env.PROD && !getApiBase()) {
    throw new Error(
      'Falta configurar el backend en Vercel: añadí VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (recomendado), o VITE_API_URL apuntando a tu servidor Node. Luego redeploy del proyecto.'
    )
  }
}

function throwIfApi404(res: Response, what: string): void {
  if (res.status === 404) {
    throw new Error(
      `${what} respondió 404. Si usás VITE_API_URL, revisá que sea la raíz del servidor (sin /api). Si solo usás Vercel sin Node, usá Supabase (VITE_SUPABASE_*).`
    )
  }
}

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json') || text.trim().startsWith('<')) {
    throw new Error(
      'El servidor no respondió JSON. Comprobá que el backend esté en marcha (npm run dev:server).'
    )
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error('El servidor no respondió JSON válido.')
  }
}

export async function registerUser(data: RegisterPayload): Promise<RegisterResponse> {
  requireApiBaseInProduction()
  try {
    const res = await fetch(apiUrl('/api/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    throwIfApi404(res, 'Registro')
    const json = await parseJsonResponse(res)
    if (!res.ok) throw new Error((json?.error as string) ?? 'Error al registrar')
    return json as unknown as RegisterResponse
  } catch (err) {
    if (err instanceof Error && /failed to fetch|network error|connection refused|err_connection_refused/i.test(err.message)) {
      throw new Error(BACKEND_NOT_RUNNING_MSG_LEGACY)
    }
    throw err
  }
}

export async function getUserById(id: number): Promise<{ user: User }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}`))
  throwIfApi404(res, 'Usuario')
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? 'Usuario no encontrado')
  return json
}

export async function getUserByEmail(email: string): Promise<{ user: User }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/by-email/${encodeURIComponent(email)}`))
  throwIfApi404(res, 'Usuario por email')
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? 'Usuario no encontrado')
  return json
}

export async function loginUser(data: LoginPayload): Promise<{ user: User }> {
  requireApiBaseInProduction()
  try {
    const res = await fetch(apiUrl('/api/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email.trim(), password: data.password }),
    })
    throwIfApi404(res, 'Login')
    const json = await parseJsonResponse(res)
    if (!res.ok) throw new Error((json?.error as string) ?? 'Error al iniciar sesión')
    return json as { user: User }
  } catch (err) {
    if (err instanceof Error && /failed to fetch|network error|connection refused|err_connection_refused/i.test(err.message)) {
      throw new Error(BACKEND_NOT_RUNNING_MSG_LEGACY)
    }
    throw err
  }
}

export async function updateUser(id: number, data: UpdateUserPayload): Promise<{ message: string; user: User }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? 'Error al actualizar')
  return json
}

export async function deleteUser(id: number): Promise<{ message: string }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}`), { method: 'DELETE' })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al eliminar la cuenta')
  return json as { message: string }
}

export async function deleteUserWithPassword(id: number, password: string): Promise<{ message: string }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: password.trim() }),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al eliminar la cuenta')
  return json as { message: string }
}

export async function changePassword(id: number, data: ChangePasswordPayload): Promise<{ message: string }> {
  requireApiBaseInProduction()
  const body: Record<string, string> = { newPassword: data.newPassword }
  if (data.pin != null) body.pin = data.pin
  else if (data.currentPassword != null) body.currentPassword = data.currentPassword
  const res = await fetch(apiUrl(`/api/users/${id}/password`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al cambiar la contraseña')
  return json as { message: string }
}

export async function setUserPin(id: number, pin: string): Promise<{ message: string }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/pin`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al guardar el PIN')
  return json as { message: string }
}

export async function clearUserPin(id: number): Promise<{ message: string }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/pin`), { method: 'DELETE' })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al eliminar el PIN')
  return json as { message: string }
}

export async function updateUserWallets(id: number, data: UpdateWalletsPayload): Promise<{ message: string; user: User }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/wallets`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al vincular las direcciones')
  return json as { message: string; user: User }
}

export async function getEncryptedSeed(id: number): Promise<{ encryptedSeed: string; seedSalt: string }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/encrypted-seed`))
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al obtener la frase')
  return json as { encryptedSeed: string; seedSalt: string }
}

export async function createLightningInvoice(
  id: number,
  options?: { amountSats?: number; description?: string }
): Promise<{ invoice: string; expiresIn?: number }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/lightning-invoice`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amountSats: options?.amountSats,
      description: options?.description,
    }),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al generar el código de pago')
  return json as { invoice: string; expiresIn?: number }
}

export async function getTotpSetup(id: number): Promise<{ secret: string; otpauthUrl: string }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/totp-setup`))
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al generar 2FA')
  return json as { secret: string; otpauthUrl: string }
}

export async function enableTotp(id: number, secret: string, token: string): Promise<{ message: string; user: User }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/totp-enable`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, token }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al activar 2FA')
  return json as { message: string; user: User }
}

export async function verifyTotp(id: number, token: string): Promise<{ ok: boolean }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/totp-verify`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Código incorrecto')
  return json as { ok: boolean }
}

export async function disableTotp(id: number, password: string): Promise<{ message: string; user: User }> {
  requireApiBaseInProduction()
  const res = await fetch(apiUrl(`/api/users/${id}/totp-disable`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al desactivar 2FA')
  return json as { message: string; user: User }
}
