import { isSupabaseBackend } from '../lib/backendMode'
import * as legacy from './usersLegacy'
import * as sb from './usersSupabase'

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
  ltcAddress?: string | null
  ethAddress?: string | null
  solAddress?: string | null
  lightningAddress?: string | null
  totpEnabled?: boolean
}

export interface RegisterResponse {
  message: string
  user: User
}

/** Mensaje según modo backend actual (tras loadRuntimeBackendConfig en prod). */
export function getBackendNotRunningMessage(): string {
  return isSupabaseBackend() ? sb.BACKEND_NOT_RUNNING_MSG_SB : legacy.BACKEND_NOT_RUNNING_MSG_LEGACY
}

/** Valor al primer import de este módulo (después del bootstrap en main). Preferí `getBackendNotRunningMessage()` si importás users antes del arranque. */
export const BACKEND_NOT_RUNNING_MSG = getBackendNotRunningMessage()

export async function registerUser(data: RegisterPayload): Promise<RegisterResponse> {
  if (isSupabaseBackend()) return sb.registerUser(data)
  return legacy.registerUser(data)
}

export async function getUserById(id: number): Promise<{ user: User }> {
  if (isSupabaseBackend()) return sb.getUserById(id)
  return legacy.getUserById(id)
}

export async function getUserByEmail(email: string): Promise<{ user: User }> {
  if (isSupabaseBackend()) return sb.getUserByEmail(email)
  return legacy.getUserByEmail(email)
}

export interface LoginPayload {
  email: string
  password: string
}

export async function loginUser(data: LoginPayload): Promise<{ user: User }> {
  if (isSupabaseBackend()) return sb.loginUser(data)
  return legacy.loginUser(data)
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
  if (isSupabaseBackend()) return sb.updateUser(id, data)
  return legacy.updateUser(id, data)
}

export async function deleteUser(id: number): Promise<{ message: string }> {
  if (isSupabaseBackend()) return sb.deleteUser(id)
  return legacy.deleteUser(id)
}

export async function deleteUserWithPassword(id: number, password: string): Promise<{ message: string }> {
  if (isSupabaseBackend()) return sb.deleteUserWithPassword(id, password)
  return legacy.deleteUserWithPassword(id, password)
}

export interface ChangePasswordPayload {
  currentPassword?: string
  pin?: string
  newPassword: string
}

export async function changePassword(id: number, data: ChangePasswordPayload): Promise<{ message: string }> {
  if (isSupabaseBackend()) return sb.changePassword(id, data)
  return legacy.changePassword(id, data)
}

export async function setUserPin(id: number, pin: string): Promise<{ message: string }> {
  if (isSupabaseBackend()) return sb.setUserPin(id, pin)
  return legacy.setUserPin(id, pin)
}

export async function clearUserPin(id: number): Promise<{ message: string }> {
  if (isSupabaseBackend()) return sb.clearUserPin(id)
  return legacy.clearUserPin(id)
}

export interface UpdateWalletsPayload {
  btcAddress: string
  usdtAddress: string
  dogeAddress?: string
  ltcAddress?: string
  ethAddress?: string
  solAddress?: string
  encryptedSeed?: string
  seedSalt?: string
  password?: string
}

export async function updateUserWallets(
  id: number,
  data: UpdateWalletsPayload
): Promise<{ message: string; user: User }> {
  if (isSupabaseBackend()) return sb.updateUserWallets(id, data)
  return legacy.updateUserWallets(id, data)
}

export async function getEncryptedSeed(id: number): Promise<{ encryptedSeed: string; seedSalt: string }> {
  if (isSupabaseBackend()) return sb.getEncryptedSeed(id)
  return legacy.getEncryptedSeed(id)
}

/** LNbits sigue yendo al API Node / Edge proxy (VITE_API_URL). */
export async function createLightningInvoice(
  id: number,
  options?: { amountSats?: number; description?: string }
): Promise<{ invoice: string; expiresIn?: number }> {
  return legacy.createLightningInvoice(id, options)
}

export async function getTotpSetup(id: number): Promise<{ secret: string; otpauthUrl: string }> {
  if (isSupabaseBackend()) return sb.getTotpSetup(id)
  return legacy.getTotpSetup(id)
}

export async function enableTotp(
  id: number,
  secret: string,
  token: string
): Promise<{ message: string; user: User }> {
  if (isSupabaseBackend()) return sb.enableTotp(id, secret, token)
  return legacy.enableTotp(id, secret, token)
}

export async function verifyTotp(id: number, token: string): Promise<{ ok: boolean }> {
  if (isSupabaseBackend()) return sb.verifyTotp(id, token)
  return legacy.verifyTotp(id, token)
}

export async function disableTotp(
  id: number,
  password: string
): Promise<{ message: string; user: User }> {
  if (isSupabaseBackend()) return sb.disableTotp(id, password)
  return legacy.disableTotp(id, password)
}
