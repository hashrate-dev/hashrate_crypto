/**
 * WebAuthn: registro y verificación con autenticador de plataforma
 * (Windows Hello, Touch ID, Face ID en dispositivos compatibles).
 */

function randomChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): ArrayBuffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = str.length % 4
  if (pad) str += '===='.slice(0, 4 - pad)
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator?.credentials?.create === 'function' &&
    typeof navigator?.credentials?.get === 'function'
}

/** Indica si el dispositivo puede tener autenticador de plataforma (rostro/huella). */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return true
  }
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
}

const RP_NAME = 'Wallet'
const USER_NAME = 'wallet-user'
const USER_DISPLAY = 'Wallet'

/**
 * Registra un nuevo autenticador (Windows Hello, Touch ID, etc.).
 * Devuelve el credential ID en base64url para guardarlo y usarlo en verify().
 */
export async function registerWebAuthn(): Promise<string> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn no está disponible en este navegador.')
  }

  const challenge = randomChallenge()
  const userId = new TextEncoder().encode('volt-wallet-' + Date.now())

  const options: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: { name: RP_NAME },
      user: {
        id: userId,
        name: USER_NAME,
        displayName: USER_DISPLAY,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60000,
    },
  }

  const credential = (await navigator.credentials.create(options)) as PublicKeyCredential | null
  if (!credential) {
    throw new Error('No se pudo crear la credencial. Intentá de nuevo.')
  }

  const id = (credential as PublicKeyCredential).rawId
  return base64urlEncode(id)
}

/**
 * Verifica con el autenticador (rostro, huella, PIN del dispositivo).
 * credentialId: el ID guardado al registrar (base64url).
 */
export async function verifyWebAuthn(credentialId: string): Promise<boolean> {
  if (!isWebAuthnSupported()) return false

  const challenge = randomChallenge()
  let idBuffer: ArrayBuffer
  try {
    idBuffer = base64urlDecode(credentialId)
  } catch {
    return false
  }

  const options: CredentialRequestOptions = {
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: idBuffer,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  }

  const credential = (await navigator.credentials.get(options)) as PublicKeyCredential | null
  return !!credential
}
