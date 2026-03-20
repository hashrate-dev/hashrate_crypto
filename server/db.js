import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { randomBytes, pbkdf2Sync } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const SALT_BYTES = 16
const HASH_ITERATIONS = 100000
const HASH_KEYLEN = 64

function hashPassword(password, saltHex) {
  const saltBuf = Buffer.isBuffer(saltHex) ? saltHex : Buffer.from(saltHex, 'hex')
  return pbkdf2Sync(password, saltBuf, HASH_ITERATIONS, HASH_KEYLEN, 'sha256').toString('hex')
}

function verifyPassword(password, saltHex, storedHash) {
  const computed = hashPassword(password, saltHex)
  return computed === storedHash
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dataDir = join(__dirname, 'data')
const dbPath = join(dataDir, 'users.json')
const accessLogPath = join(dataDir, 'access_log.json')
const swapLogPath = join(dataDir, 'swap_log.json')
const operationsLogPath = join(dataDir, 'operations_log.json')
const balanceSnapshotsPath = join(dataDir, 'balance_snapshots.json')

/** @type {{ id: number, email: string, first_name: string, second_name: string | null, first_surname: string, second_surname: string | null, password_salt: string, password_hash: string, pin_salt?: string, pin_hash?: string, created_at: string }[]} */
let users = []

function load() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  if (!existsSync(dbPath)) {
    users = []
    return
  }
  const raw = readFileSync(dbPath, 'utf-8')
  try {
    users = JSON.parse(raw)
  } catch {
    users = []
  }
}

function save() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  writeFileSync(dbPath, JSON.stringify(users, null, 2), 'utf-8')
}

load()

const FIRST_ID = 500010 // Primera cuenta: ID de 6 cifras que empieza por 50010

/**
 * Añade un usuario y devuelve la fila creada con su ID NUMBER (6 cifras, desde 500010).
 * row debe incluir password (texto plano); se guarda salt + hash.
 */
export function addUser(row) {
  load()
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const passwordHash = hashPassword(row.password, salt)
  const maxId = users.length === 0 ? FIRST_ID - 1 : Math.max(...users.map((u) => u.id))
  const nextId = Math.max(maxId + 1, FIRST_ID)
  const created = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const user = {
    id: nextId,
    email: row.email,
    first_name: row.first_name,
    second_name: row.second_name ?? null,
    first_surname: row.first_surname,
    second_surname: row.second_surname ?? null,
    password_salt: salt,
    password_hash: passwordHash,
    created_at: created,
  }
  users.push(user)
  save()
  return user
}

/**
 * Busca usuario por email. Devuelve null si no existe.
 */
export function getUserByEmail(email) {
  load()
  const normalized = email.trim().toLowerCase()
  return users.find((u) => u.email === normalized) ?? null
}

/**
 * Busca usuario por ID NUMBER. Devuelve null si no existe.
 */
export function getUserById(id) {
  load()
  return users.find((u) => u.id === id) ?? null
}

/**
 * Verifica email + contraseña. Devuelve el usuario (sin password_salt/password_hash) o null.
 */
export function verifyUserPassword(email, password) {
  load()
  const normalized = email.trim().toLowerCase()
  const user = users.find((u) => u.email === normalized) ?? null
  if (!user || !user.password_salt || !user.password_hash) return null
  if (!verifyPassword(password, user.password_salt, user.password_hash)) return null
  return user
}

/**
 * Actualiza un usuario por ID. Devuelve la fila actualizada o null si no existe.
 * Persiste en disco (users.json). row puede incluir: btc_address, usdt_address, doge_address, ltc_address, eth_address, lightning_address, encrypted_seed, seed_salt, etc.
 */
export function updateUser(id, row) {
  load()
  const index = users.findIndex((u) => u.id === id)
  if (index === -1) return null
  const current = users[index]
  const updated = {
    ...current,
    email: row.email != null ? String(row.email).trim().toLowerCase() : current.email,
    first_name: row.first_name != null ? String(row.first_name).trim() : current.first_name,
    second_name: row.second_name !== undefined ? (row.second_name != null ? String(row.second_name).trim() : null) : current.second_name,
    first_surname: row.first_surname != null ? String(row.first_surname).trim() : current.first_surname,
    second_surname: row.second_surname !== undefined ? (row.second_surname != null ? String(row.second_surname).trim() : null) : current.second_surname,
    btc_address: row.btc_address !== undefined ? (row.btc_address != null ? String(row.btc_address).trim() : null) : current.btc_address,
    usdt_address: row.usdt_address !== undefined ? (row.usdt_address != null ? String(row.usdt_address).trim() : null) : current.usdt_address,
    doge_address: row.doge_address !== undefined ? (row.doge_address != null ? String(row.doge_address).trim() : null) : current.doge_address,
    ltc_address: row.ltc_address !== undefined ? (row.ltc_address != null ? String(row.ltc_address).trim() : null) : current.ltc_address,
    eth_address: row.eth_address !== undefined ? (row.eth_address != null ? String(row.eth_address).trim() : null) : current.eth_address,
    sol_address: row.sol_address !== undefined ? (row.sol_address != null ? String(row.sol_address).trim() : null) : current.sol_address,
    lightning_address: row.lightning_address !== undefined ? (row.lightning_address != null ? String(row.lightning_address).trim() : null) : current.lightning_address,
    encrypted_seed: row.encrypted_seed !== undefined ? (row.encrypted_seed != null ? String(row.encrypted_seed) : null) : current.encrypted_seed,
    seed_salt: row.seed_salt !== undefined ? (row.seed_salt != null ? String(row.seed_salt) : null) : current.seed_salt,
    totp_secret: row.totp_secret !== undefined ? (row.totp_secret != null ? String(row.totp_secret) : null) : current.totp_secret,
  }
  users[index] = updated
  save()
  return updated
}

/**
 * Cambia la contraseña del usuario por ID.
 * Devuelve true si se actualizó; false si el usuario no existe, no tiene contraseña o la actual no coincide.
 */
export function updateUserPassword(id, currentPassword, newPassword) {
  load()
  const index = users.findIndex((u) => u.id === id)
  if (index === -1) return false
  const user = users[index]
  if (!user.password_salt || !user.password_hash) return false
  if (!verifyPassword(currentPassword, user.password_salt, user.password_hash)) return false
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const passwordHash = hashPassword(newPassword, salt)
  users[index] = { ...user, password_salt: salt, password_hash: passwordHash }
  save()
  return true
}

/** Verifica el PIN del usuario. PIN: 4-6 dígitos. */
function isValidPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4,6}$/.test(pin)
}

/**
 * Guarda el PIN del usuario (hash + salt). Para usar como alternativa al cambiar contraseña.
 */
export function setUserPin(id, pin) {
  if (!isValidPin(pin)) return false
  load()
  const index = users.findIndex((u) => u.id === id)
  if (index === -1) return false
  const user = users[index]
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const pinHash = hashPassword(pin, salt)
  users[index] = { ...user, pin_salt: salt, pin_hash: pinHash }
  save()
  return true
}

/** Borra el PIN del usuario. */
export function clearUserPin(id) {
  load()
  const index = users.findIndex((u) => u.id === id)
  if (index === -1) return false
  const user = users[index]
  users[index] = { ...user, pin_salt: undefined, pin_hash: undefined }
  save()
  return true
}

/** Verifica el PIN del usuario. Devuelve true si coincide. */
export function verifyUserPin(id, pin) {
  load()
  const user = users.find((u) => u.id === id) ?? null
  if (!user || !user.pin_salt || !user.pin_hash) return false
  return verifyPassword(pin, user.pin_salt, user.pin_hash)
}

/**
 * Cambia la contraseña usando el PIN en lugar de la contraseña actual.
 */
export function updateUserPasswordWithPin(id, pin, newPassword) {
  load()
  const index = users.findIndex((u) => u.id === id)
  if (index === -1) return false
  const user = users[index]
  if (!user.pin_salt || !user.pin_hash) return false
  if (!verifyPassword(pin, user.pin_salt, user.pin_hash)) return false
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const passwordHash = hashPassword(newPassword, salt)
  users[index] = { ...user, password_salt: salt, password_hash: passwordHash }
  save()
  return true
}

/**
 * Elimina un usuario por ID. Devuelve true si existía y se eliminó, false si no existía.
 */
export function deleteUserById(id) {
  load()
  const index = users.findIndex((u) => u.id === id)
  if (index === -1) return false
  users.splice(index, 1)
  save()
  return true
}

/**
 * Lista todos los usuarios (sin password_salt/password_hash) para el monitor.
 */
export function getAllUsers() {
  load()
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    first_name: u.first_name,
    second_name: u.second_name ?? null,
    first_surname: u.first_surname,
    second_surname: u.second_surname ?? null,
    created_at: u.created_at,
  }))
}

/**
 * Lista usuarios con direcciones de wallet para que el monitor pueda calcular saldos.
 */
export function getUsersWithAddresses() {
  load()
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    first_name: u.first_name,
    second_name: u.second_name ?? null,
    first_surname: u.first_surname,
    second_surname: u.second_surname ?? null,
    created_at: u.created_at,
    btc_address: u.btc_address ?? null,
    usdt_address: u.usdt_address ?? null,
    doge_address: u.doge_address ?? null,
    ltc_address: u.ltc_address ?? null,
    eth_address: u.eth_address ?? null,
    sol_address: u.sol_address ?? null,
  }))
}

/** @type {{ user_id: number, email: string, first_name?: string, first_surname?: string, at: string }[]} */
let accessLog = []

function loadAccessLog() {
  if (!existsSync(accessLogPath)) {
    accessLog = []
    return
  }
  try {
    const raw = readFileSync(accessLogPath, 'utf-8')
    accessLog = JSON.parse(raw)
  } catch {
    accessLog = []
  }
}

function saveAccessLog() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  writeFileSync(accessLogPath, JSON.stringify(accessLog, null, 2), 'utf-8')
}

/**
 * Registra un acceso (login) para el histórico.
 */
export function logAccess({ userId, email, firstName, firstSurname }) {
  loadAccessLog()
  accessLog.push({
    user_id: userId,
    email: email || '',
    first_name: firstName ?? null,
    first_surname: firstSurname ?? null,
    at: new Date().toISOString(),
  })
  if (accessLog.length > 5000) accessLog = accessLog.slice(-4000)
  saveAccessLog()
}

/**
 * Devuelve el histórico de accesos (últimos primero).
 */
export function getAccessLog(limit = 200) {
  loadAccessLog()
  return [...accessLog].reverse().slice(0, limit)
}

// ——— Swap log (Jupiter: swaps realizados y comisiones) ———
let swapLog = []
function loadSwapLog() {
  if (!existsSync(swapLogPath)) { swapLog = []; return }
  try {
    swapLog = JSON.parse(readFileSync(swapLogPath, 'utf-8'))
  } catch { swapLog = [] }
}
function saveSwapLog() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  writeFileSync(swapLogPath, JSON.stringify(swapLog, null, 2), 'utf-8')
}

/**
 * Registra un swap completado (userId, email, par, montos, comisión estimada, txSignature).
 */
export function logSwap(entry) {
  loadSwapLog()
  swapLog.push({
    user_id: entry.userId,
    email: entry.email || '',
    input_mint: entry.inputMint || '',
    output_mint: entry.outputMint || '',
    in_amount: entry.inAmount || '',
    out_amount: entry.outAmount || '',
    platform_fee_bps: entry.platformFeeBps ?? 0,
    commission_approx: entry.commissionApprox ?? '',
    tx_signature: entry.txSignature || '',
    at: new Date().toISOString(),
  })
  if (swapLog.length > 5000) swapLog = swapLog.slice(-4000)
  saveSwapLog()
}

export function getSwapLog(limit = 200) {
  loadSwapLog()
  return [...swapLog].reverse().slice(0, limit)
}

// ——— Operations log (actividad: envíos, páginas visitadas, etc.) ———
let operationsLog = []
function loadOperationsLog() {
  if (!existsSync(operationsLogPath)) { operationsLog = []; return }
  try {
    operationsLog = JSON.parse(readFileSync(operationsLogPath, 'utf-8'))
  } catch { operationsLog = [] }
}
function saveOperationsLog() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  writeFileSync(operationsLogPath, JSON.stringify(operationsLog, null, 2), 'utf-8')
}

/**
 * Registra una operación o evento (tipo: login, swap, send_page, receive_page, etc.).
 */
export function logOperation(entry) {
  loadOperationsLog()
  operationsLog.push({
    user_id: entry.userId,
    email: entry.email || '',
    type: entry.type || 'unknown',
    detail: entry.detail || null,
    at: new Date().toISOString(),
  })
  if (operationsLog.length > 5000) operationsLog = operationsLog.slice(-4000)
  saveOperationsLog()
}

export function getOperationsLog(limit = 300) {
  loadOperationsLog()
  return [...operationsLog].reverse().slice(0, limit)
}

// ——— Balance snapshots (por usuario: montos en monedas y total USD para el monitor) ———
/** @type {Record<number, { userId: number, email: string, totalUsd: string, balances: Record<string, string>, at: string }>} */
let balanceSnapshots = {}

function loadBalanceSnapshots() {
  if (!existsSync(balanceSnapshotsPath)) {
    balanceSnapshots = {}
    return
  }
  try {
    const raw = readFileSync(balanceSnapshotsPath, 'utf-8')
    balanceSnapshots = JSON.parse(raw)
  } catch {
    balanceSnapshots = {}
  }
}

function saveBalanceSnapshots() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  writeFileSync(balanceSnapshotsPath, JSON.stringify(balanceSnapshots, null, 2), 'utf-8')
}

/**
 * Guarda el snapshot de saldos de un usuario (actualizado cuando el usuario carga su Dashboard).
 */
export function setBalanceSnapshot({ userId, email, totalUsd, balances }) {
  loadBalanceSnapshots()
  balanceSnapshots[Number(userId)] = {
    userId: Number(userId),
    email: email || '',
    totalUsd: totalUsd != null ? String(totalUsd) : '0',
    balances: balances && typeof balances === 'object' ? { ...balances } : {},
    at: new Date().toISOString(),
  }
  saveBalanceSnapshots()
}

/**
 * Devuelve todos los snapshots de saldos (para el monitor).
 */
export function getBalanceSnapshots() {
  loadBalanceSnapshots()
  return Object.values(balanceSnapshots)
}

// ——— Configuración Jupiter (comisión, wallet, slippage por defecto) ———
const swapConfigPath = join(dataDir, 'swap_config.json')
const DEFAULT_FEE_WALLET = '9PMkkTEdEPyrACphv1sEqjJvtC51y6qr224EBcRN6fxc'
const DEFAULT_PLATFORM_FEE_BPS = 20 // 0.2%
const DEFAULT_SLIPPAGE_BPS = 50 // 0.5%

let swapConfigCache = null

function loadSwapConfig() {
  if (!existsSync(swapConfigPath)) {
    swapConfigCache = {
      platformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
      feeWallet: DEFAULT_FEE_WALLET,
      slippageBps: DEFAULT_SLIPPAGE_BPS,
    }
    return swapConfigCache
  }
  try {
    const raw = readFileSync(swapConfigPath, 'utf-8')
    const data = JSON.parse(raw)
    swapConfigCache = {
      platformFeeBps: Math.min(10000, Math.max(0, Number(data.platformFeeBps) ?? DEFAULT_PLATFORM_FEE_BPS)),
      feeWallet: typeof data.feeWallet === 'string' && data.feeWallet.trim() ? data.feeWallet.trim() : DEFAULT_FEE_WALLET,
      slippageBps: Math.min(10000, Math.max(1, Number(data.slippageBps) ?? DEFAULT_SLIPPAGE_BPS)),
    }
    return swapConfigCache
  } catch {
    swapConfigCache = {
      platformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
      feeWallet: DEFAULT_FEE_WALLET,
      slippageBps: DEFAULT_SLIPPAGE_BPS,
    }
    return swapConfigCache
  }
}

function saveSwapConfig(config) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  writeFileSync(swapConfigPath, JSON.stringify(config, null, 2), 'utf-8')
  swapConfigCache = config
}

export function getSwapConfig() {
  if (swapConfigCache) return swapConfigCache
  return loadSwapConfig()
}

export function setSwapConfig(updates) {
  const current = getSwapConfig()
  const next = {
    platformFeeBps: updates.platformFeeBps !== undefined
      ? Math.min(10000, Math.max(0, Number(updates.platformFeeBps)))
      : current.platformFeeBps,
    feeWallet: updates.feeWallet !== undefined && String(updates.feeWallet).trim()
      ? String(updates.feeWallet).trim()
      : current.feeWallet,
    slippageBps: updates.slippageBps !== undefined
      ? Math.min(10000, Math.max(1, Number(updates.slippageBps)))
      : current.slippageBps,
  }
  saveSwapConfig(next)
  return next
}
