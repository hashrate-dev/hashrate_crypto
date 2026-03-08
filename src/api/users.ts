const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3001'
  : (typeof import.meta.env?.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '')

export interface RegisterPayload {
  email: string
  password: string
  firstName: string
  secondName?: string
  firstSurname: string
  secondSurname?: string
}

/** Mínimo 6 caracteres, letras o números, al menos una mayúscula */
export function isPasswordValid(password: string): boolean {
  if (typeof password !== 'string' || password.length < 6) return false
  return /^(?=.*[A-Z])[A-Za-z0-9]+$/.test(password)
}

export interface User {
  id: number
  email: string
  firstName: string
  secondName: string | null
  firstSurname: string
  secondSurname: string | null
  createdAt: string
  btcAddress?: string | null
  usdtAddress?: string | null
  dogeAddress?: string | null
  lightningAddress?: string | null
  totpEnabled?: boolean
}

export interface RegisterResponse {
  message: string
  user: User
}

export async function registerUser(data: RegisterPayload): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok) {
    throw new Error((json?.error as string) ?? 'Error al registrar')
  }
  return json as unknown as RegisterResponse
}

export async function getUserById(id: number): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/api/users/${id}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? 'Usuario no encontrado')
  return json
}

export async function getUserByEmail(email: string): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/api/users/by-email/${encodeURIComponent(email)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? 'Usuario no encontrado')
  return json
}

export interface LoginPayload {
  email: string
  password: string
}

export async function loginUser(data: LoginPayload): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: data.email.trim(), password: data.password }),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al iniciar sesión')
  return json as { user: User }
}

export interface UpdateUserPayload {
  email?: string
  firstName?: string
  secondName?: string | null
  firstSurname?: string
  secondSurname?: string | null
  lightningAddress?: string | null
}

export async function updateUser(id: number, data: UpdateUserPayload): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? 'Error al actualizar')
  return json
}

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json') || text.trim().startsWith('<')) {
    throw new Error(
      'El servidor de usuarios no respondió. Comprobá que el backend esté en marcha: desde la raíz del proyecto ejecutá npm run dev:server, o desde la carpeta server ejecutá npm run dev.'
    )
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(
      'El servidor de usuarios no respondió. Comprobá que el backend esté en marcha: desde la raíz del proyecto ejecutá npm run dev:server, o desde la carpeta server ejecutá npm run dev.'
    )
  }
}

export async function deleteUser(id: number): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/users/${id}`, { method: 'DELETE' })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al eliminar la cuenta')
  return json as { message: string }
}

export interface ChangePasswordPayload {
  currentPassword?: string
  pin?: string
  newPassword: string
}

export async function changePassword(id: number, data: ChangePasswordPayload): Promise<{ message: string }> {
  const body: Record<string, string> = { newPassword: data.newPassword }
  if (data.pin != null) body.pin = data.pin
  else if (data.currentPassword != null) body.currentPassword = data.currentPassword
  const res = await fetch(`${API_BASE}/api/users/${id}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al cambiar la contraseña')
  return json as { message: string }
}

export async function setUserPin(id: number, pin: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/users/${id}/pin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al guardar el PIN')
  return json as { message: string }
}

export async function clearUserPin(id: number): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/users/${id}/pin`, { method: 'DELETE' })
  const json = await parseJsonResponse(res)
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al eliminar el PIN')
  return json as { message: string }
}

export interface UpdateWalletsPayload {
  btcAddress: string
  usdtAddress: string
  dogeAddress?: string
  encryptedSeed?: string
  seedSalt?: string
  password?: string
}

export async function updateUserWallets(id: number, data: UpdateWalletsPayload): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/users/${id}/wallets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al vincular las direcciones')
  return json as { message: string; user: User }
}

export async function getEncryptedSeed(id: number): Promise<{ encryptedSeed: string; seedSalt: string }> {
  const res = await fetch(`${API_BASE}/api/users/${id}/encrypted-seed`)
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al obtener la frase')
  return json as { encryptedSeed: string; seedSalt: string }
}

/** Google Authenticator: obtener secreto y URL para QR (no activa hasta enable). */
export async function getTotpSetup(id: number): Promise<{ secret: string; otpauthUrl: string }> {
  const res = await fetch(`${API_BASE}/api/users/${id}/totp-setup`)
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al generar 2FA')
  return json as { secret: string; otpauthUrl: string }
}

/** Activar 2FA: enviar secret + código de 6 dígitos. */
export async function enableTotp(id: number, secret: string, token: string): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/users/${id}/totp-enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, token }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al activar 2FA')
  return json as { message: string; user: User }
}

/** Verificar código TOTP (para enviar fondos). */
export async function verifyTotp(id: number, token: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/users/${id}/totp-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Código incorrecto')
  return json as { ok: boolean }
}

/** Desactivar 2FA. Requiere contraseña. */
export async function disableTotp(id: number, password: string): Promise<{ message: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/users/${id}/totp-disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json?.error as string) ?? 'Error al desactivar 2FA')
  return json as { message: string; user: User }
}
