const STORAGE_KEY = 'volt_security'

export interface SecurityState {
  pinHash: string | null
  faceIdEnabled: boolean
  webauthnCredentialId: string | null
}

function getStored(): SecurityState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { pinHash: null, faceIdEnabled: false, webauthnCredentialId: null }
    const data = JSON.parse(raw) as SecurityState
    return {
      pinHash: data.pinHash ?? null,
      faceIdEnabled: Boolean(data.faceIdEnabled),
      webauthnCredentialId: data.webauthnCredentialId ?? null,
    }
  } catch {
    return { pinHash: null, faceIdEnabled: false, webauthnCredentialId: null }
  }
}

function save(state: SecurityState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** Hash del PIN con SHA-256 (solo para no guardar el PIN en claro). */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hasPin(): boolean {
  return Boolean(getStored().pinHash)
}

export function isFaceIdEnabled(): boolean {
  return getStored().faceIdEnabled
}

export async function setPin(pin: string): Promise<void> {
  const h = await hashPin(pin)
  const state = getStored()
  state.pinHash = h
  save(state)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = getStored().pinHash
  if (!stored) return false
  const h = await hashPin(pin)
  return h === stored
}

export function removePin(): void {
  const state = getStored()
  state.pinHash = null
  save(state)
}

export function setFaceIdEnabled(enabled: boolean): void {
  const state = getStored()
  state.faceIdEnabled = enabled
  if (!enabled) state.webauthnCredentialId = null
  save(state)
}

export function getWebAuthnCredentialId(): string | null {
  return getStored().webauthnCredentialId
}

export function setWebAuthnCredential(credentialId: string): void {
  const state = getStored()
  state.webauthnCredentialId = credentialId
  state.faceIdEnabled = true
  save(state)
}

export function hasWebAuthnCredential(): boolean {
  return Boolean(getStored().webauthnCredentialId)
}

/** Verifica con el autenticador (rostro/huella/PIN del dispositivo). Devuelve true si el usuario se autenticó. */
export async function verifyBiometric(): Promise<boolean> {
  const id = getStored().webauthnCredentialId
  if (!id) return false
  const { verifyWebAuthn } = await import('../lib/webauthn')
  return verifyWebAuthn(id)
}

/** PIN válido: 4 a 6 dígitos numéricos */
export function isPinValid(pin: string): boolean {
  return /^[0-9]{4,6}$/.test(pin)
}
