/**
 * Cifrado de la frase semilla con la contraseña del usuario (solo en cliente).
 * PBKDF2 + AES-GCM. El servidor solo guarda el blob cifrado.
 */

const PBKDF2_ITERATIONS = 100000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_LENGTH = 256

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

export async function encryptSeed(phrase: string, password: string): Promise<{ salt: string; encrypted: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const keyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH
  )
  const key = await crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    enc.encode(phrase)
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return {
    salt: bufferToBase64(salt),
    encrypted: bufferToBase64(combined),
  }
}

export async function decryptSeed(encrypted: string, salt: string, password: string): Promise<string> {
  const saltBuf = new Uint8Array(base64ToBuffer(salt))
  const combined = new Uint8Array(base64ToBuffer(encrypted))
  const iv = combined.slice(0, IV_BYTES)
  const ciphertext = combined.slice(IV_BYTES)
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const keyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH
  )
  const key = await crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    ciphertext
  )
  return new TextDecoder().decode(decrypted)
}
