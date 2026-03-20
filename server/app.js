import './loadEnv.js'
import express from 'express'
import cors from 'cors'
import speakeasy from 'speakeasy'
import { PublicKey } from '@solana/web3.js'
import { addUser, getUserByEmail, getUserById, updateUser, updateUserPassword, updateUserPasswordWithPin, setUserPin, clearUserPin, verifyUserPin, deleteUserById, verifyUserPassword, getAllUsers, getUsersWithAddresses, logAccess, getAccessLog, getSwapLog, getOperationsLog, getBalanceSnapshots, setBalanceSnapshot, getSwapConfig, setSwapConfig, healthCheck } from './db.js'
import { sendPasswordChangedEmail } from './email.js'

const app = express()

function fetchWithTimeout(url, opts, ms = 15000) {
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), ms)
  return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(to))
}

function toUserResponse(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    secondName: row.second_name ?? null,
    firstSurname: row.first_surname,
    secondSurname: row.second_surname ?? null,
    createdAt: row.created_at,
    btcAddress: row.btc_address ?? null,
    usdtAddress: row.usdt_address ?? null,
    dogeAddress: row.doge_address ?? null,
    ltcAddress: row.ltc_address ?? null,
    ethAddress: row.eth_address ?? null,
    solAddress: row.sol_address ?? null,
    lightningAddress: row.lightning_address ?? null,
    totpEnabled: !!(row.totp_secret != null && row.totp_secret !== ''),
  }
}

function isValidPassword(pwd) {
  if (typeof pwd !== 'string' || pwd.length < 6) return false
  if (!/^(?=.*[A-Z])[A-Za-z0-9]+$/.test(pwd)) return false
  return true
}

app.use(cors({ origin: true }))
app.use(express.json())

// Balance SOL (proxy a la red Solana)
const SOLANA_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://api.mainnet.solana.com',
  'https://rpc.ankr.com/solana',
]
const LAMPORTS_PER_SOL = 1e9
app.get('/api/solana/balance', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    if (!address || address.length < 32 || address.length > 44) {
      return res.status(400).json({ error: 'Dirección Solana inválida.' })
    }
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    })
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    for (const rpc of SOLANA_RPCS) {
      try {
        const r = await fetch(rpc, opts)
        if (!r.ok) continue
        const data = await r.json()
        if (data.error) continue
        const lamports = data.result?.value ?? 0
        const balanceSol = (lamports / LAMPORTS_PER_SOL).toFixed(9)
        return res.json({ balanceSol })
      } catch {
        continue
      }
    }
    res.status(502).json({ error: 'No se pudo conectar con la red de Solana.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al consultar balance SOL.' })
  }
})

// Proxy ETH y USDT (evitan CORS)
const ETH_RPCS = [
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
  'https://rpc.ankr.com/eth',
  'https://eth.llamarpc.com',
]
app.get('/api/eth/balance', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ error: 'Dirección ETH inválida.' })
    }
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest'],
    })
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    for (const rpc of ETH_RPCS) {
      try {
        const r = await fetch(rpc, opts)
        if (!r.ok) continue
        const data = await r.json()
        if (data.error) continue
        const hex = data.result || '0x0'
        const wei = BigInt(hex)
        const eth = Number(wei) / 1e18
        return res.json({ balanceEth: eth.toFixed(8) })
      } catch {
        continue
      }
    }
    res.status(502).json({ error: 'No se pudo conectar a la red Ethereum.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al consultar balance ETH.' })
  }
})
const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
app.get('/api/usdt/balance', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ error: 'Dirección inválida.' })
    }
    const addr = address.slice(2).padStart(64, '0').toLowerCase()
    const callData = '0x70a08231' + addr
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: USDT_CONTRACT, data: callData }, 'latest'],
    })
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    for (const rpc of ETH_RPCS) {
      try {
        const r = await fetch(rpc, opts)
        if (!r.ok) continue
        const data = await r.json()
        if (data.error) continue
        const hex = data.result || '0x'
        const raw = hex === '0x' || !hex ? '0' : BigInt(hex).toString()
        const value = Number(raw) / 1e6
        return res.json({ balanceUsdt: value.toFixed(2), balanceRaw: raw })
      } catch {
        continue
      }
    }
    res.status(502).json({ error: 'No se pudo conectar a la red Ethereum.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al consultar balance USDT.' })
  }
})

// Chrome DevTools / extension pide esto; responder 204 evita 404 y ruido en consola
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end()
})

// Raíz: comprobar que el backend responde (almacenamiento local)
app.get('/', async (req, res) => {
  try {
    const status = await healthCheck()
    res.status(200).json({
      ok: true,
      message: 'Backend corriendo',
      db: status.ok ? 'Local (server/data/)' : status.error,
    })
  } catch (err) {
    res.status(503).json({ ok: false, message: 'Error', error: err.message })
  }
})

app.get('/api/health', async (req, res) => {
  try {
    const status = await healthCheck()
    if (status.ok) {
      return res.status(200).json(status)
    }
    return res.status(503).json(status)
  } catch (err) {
    res.status(503).json({ ok: false, db: 'error', error: err.message || 'Error de salud' })
  }
})

// Misma respuesta en /health por si se prueba sin /api
app.get('/health', async (req, res) => {
  try {
    const status = await healthCheck()
    if (status.ok) {
      return res.status(200).json(status)
    }
    return res.status(503).json(status)
  } catch (err) {
    res.status(503).json({ ok: false, db: 'error', error: err.message || 'Error de salud' })
  }
})

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, firstName, secondName, firstSurname, secondSurname } = req.body
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'El email es obligatorio.' })
    }
    if (!password || !isValidPassword(password)) {
      return res.status(400).json({
        error: 'La contraseña debe tener mínimo 6 caracteres, letras o números y al menos una mayúscula.',
      })
    }
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return res.status(400).json({ error: 'El primer nombre es obligatorio.' })
    }
    if (!firstSurname || typeof firstSurname !== 'string' || !firstSurname.trim()) {
      return res.status(400).json({ error: 'El primer apellido es obligatorio.' })
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (await getUserByEmail(normalizedEmail)) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email.' })
    }
    const row = await addUser({
      email: normalizedEmail,
      password: String(password),
      first_name: String(firstName).trim(),
      second_name: secondName != null ? String(secondName).trim() : null,
      first_surname: String(firstSurname).trim(),
      second_surname: secondSurname != null ? String(secondSurname).trim() : null,
    })
    res.status(201).json({
      message: 'Usuario registrado correctamente.',
      user: toUserResponse(row),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar el usuario.' })
  }
})

app.get('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = await getUserById(id)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ user: toUserResponse(row) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener el usuario.' })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const body = req.body || {}
    const email = body.email
    const password = body.password
    if (!email || typeof email !== 'string' || !String(email).trim()) {
      return res.status(400).json({ error: 'El email es obligatorio.' })
    }
    if (password === undefined || password === null || typeof password !== 'string') {
      return res.status(400).json({ error: 'La contraseña es obligatoria.' })
    }
    const user = await verifyUserPassword(String(email).trim(), password)
    if (!user) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos.' })
    }
    await logAccess({
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      firstSurname: user.first_surname,
    })
    res.json({ user: toUserResponse(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al iniciar sesión.' })
  }
})

app.get('/api/users/by-email/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).trim().toLowerCase()
    if (!email) {
      return res.status(400).json({ error: 'Email no válido.' })
    }
    const row = await getUserByEmail(email)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ user: toUserResponse(row) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener el usuario.' })
  }
})

app.put('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const current = await getUserById(id)
    if (!current) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const { firstName, secondName, firstSurname, secondSurname, lightningAddress } = req.body
    const row = await updateUser(id, {
      first_name: firstName != null ? String(firstName).trim() : current.first_name,
      second_name: secondName !== undefined ? (secondName != null ? String(secondName).trim() : null) : current.second_name,
      first_surname: firstSurname != null ? String(firstSurname).trim() : current.first_surname,
      second_surname: secondSurname !== undefined ? (secondSurname != null ? String(secondSurname).trim() : null) : current.second_surname,
      lightning_address: lightningAddress !== undefined ? (lightningAddress != null ? String(lightningAddress).trim() : null) : current.lightning_address,
    })
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({
      message: 'Datos actualizados correctamente.',
      user: toUserResponse(row),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar el usuario.' })
  }
})

app.put('/api/users/:id/wallets', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const current = await getUserById(id)
    if (!current) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const alreadyHasWallets =
      (current.btc_address && current.btc_address.trim() !== '') ||
      (current.usdt_address && current.usdt_address.trim() !== '') ||
      (current.doge_address && current.doge_address.trim() !== '') ||
      (current.ltc_address && current.ltc_address.trim() !== '') ||
      (current.eth_address && current.eth_address.trim() !== '') ||
      (current.sol_address && current.sol_address.trim() !== '')
    if (alreadyHasWallets) {
      const { password } = req.body
      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          error: 'Para generar una nueva frase semilla tenés que ingresar tu contraseña.',
        })
      }
      const verified = await verifyUserPassword(current.email, password)
      if (!verified) {
        return res.status(401).json({ error: 'Contraseña incorrecta.' })
      }
    }
    const { btcAddress, usdtAddress, dogeAddress, ltcAddress, ethAddress, solAddress, encryptedSeed, seedSalt } = req.body
    if (btcAddress != null && typeof btcAddress !== 'string') {
      return res.status(400).json({ error: 'btcAddress debe ser una cadena.' })
    }
    if (usdtAddress != null && typeof usdtAddress !== 'string') {
      return res.status(400).json({ error: 'usdtAddress debe ser una cadena.' })
    }
    if (dogeAddress != null && typeof dogeAddress !== 'string') {
      return res.status(400).json({ error: 'dogeAddress debe ser una cadena.' })
    }
    if (ltcAddress != null && typeof ltcAddress !== 'string') {
      return res.status(400).json({ error: 'ltcAddress debe ser una cadena.' })
    }
    if (ethAddress != null && typeof ethAddress !== 'string') {
      return res.status(400).json({ error: 'ethAddress debe ser una cadena.' })
    }
    if (solAddress != null && typeof solAddress !== 'string') {
      return res.status(400).json({ error: 'solAddress debe ser una cadena.' })
    }
    const isSavingSeed = encryptedSeed !== undefined && encryptedSeed != null && String(encryptedSeed).trim() !== ''
    if (isSavingSeed) {
      const allRequired = [btcAddress, usdtAddress, dogeAddress, ltcAddress, ethAddress, solAddress]
      const missing = allRequired.some((a) => a == null || typeof a !== 'string' || String(a).trim() === '')
      if (missing) {
        return res.status(400).json({
          error: 'Al vincular o reemplazar la frase semilla tenés que enviar todas las direcciones (BTC, USDT, DOGE, LTC, ETH, SOL).',
        })
      }
    }
    const row = await updateUser(id, {
      btc_address: btcAddress != null ? String(btcAddress).trim() : current.btc_address,
      usdt_address: usdtAddress != null ? String(usdtAddress).trim() : current.usdt_address,
      doge_address: dogeAddress != null ? String(dogeAddress).trim() : current.doge_address,
      ltc_address: ltcAddress != null ? String(ltcAddress).trim() : current.ltc_address,
      eth_address: ethAddress != null ? String(ethAddress).trim() : current.eth_address,
      sol_address: solAddress != null ? String(solAddress).trim() : current.sol_address,
      encrypted_seed: encryptedSeed !== undefined ? (encryptedSeed != null ? String(encryptedSeed) : null) : current.encrypted_seed,
      seed_salt: seedSalt !== undefined ? (seedSalt != null ? String(seedSalt) : null) : current.seed_salt,
    })
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({
      message: alreadyHasWallets ? 'Nueva frase semilla vinculada correctamente.' : 'Direcciones de wallet vinculadas correctamente.',
      user: toUserResponse(row),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al vincular las direcciones.' })
  }
})

app.get('/api/users/:id/encrypted-seed', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = await getUserById(id)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    if (!row.encrypted_seed || !row.seed_salt) {
      return res.status(404).json({ error: 'No hay frase semilla guardada para esta cuenta.' })
    }
    res.json({
      encryptedSeed: row.encrypted_seed,
      seedSalt: row.seed_salt,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener la frase.' })
  }
})

/**
 * Generar código de pago Lightning (factura BOLT11) para recibir.
 * Conectado a LNbits si LNBITS_URL y LNBITS_INVOICE_KEY están en .env.
 * Body: { amountSats?: number, description?: string }
 * Respuesta: { invoice: string, expiresIn?: number }
 */
app.post('/api/users/:id/lightning-invoice', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = await getUserById(id)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const { amountSats, description } = req.body || {}
    const amount = amountSats != null ? Math.max(0, parseInt(amountSats, 10) || 0) : 0
    const desc = typeof description === 'string' ? description.trim().slice(0, 200) : ''

    const { createLightningInvoiceFromLnbits } = await import('./lightning.js')
    const real = await createLightningInvoiceFromLnbits(amount || 1000, { memo: desc || 'Imperium Wallet' })
    if (real) {
      return res.json({ invoice: real.invoice, expiresIn: real.expiresIn })
    }

    const chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
    let payload = ''
    for (let i = 0; i < 200; i++) {
      payload += chars[Math.floor(Math.random() * chars.length)]
    }
    res.json({ invoice: 'lnbc1p0' + payload, expiresIn: 1800 })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al generar el código de pago.' })
  }
})

app.put('/api/users/:id/pin', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const { pin } = req.body
    if (!pin || typeof pin !== 'string' || !/^[0-9]{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos (solo números).' })
    }
    const ok = await setUserPin(id, pin)
    if (!ok) return res.status(404).json({ error: 'Usuario no encontrado.' })
    res.json({ message: 'PIN guardado correctamente.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar el PIN.' })
  }
})

app.delete('/api/users/:id/pin', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const ok = await clearUserPin(id)
    if (!ok) return res.status(404).json({ error: 'Usuario no encontrado.' })
    res.json({ message: 'PIN eliminado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar el PIN.' })
  }
})

app.get('/api/users/:id/totp-setup', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = await getUserById(id)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const secret = speakeasy.generateSecret({
      name: `Imperium Wallet (${row.email})`,
      length: 20,
    })
    res.json({
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al generar el código 2FA.' })
  }
})

app.post('/api/users/:id/totp-enable', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const { secret, token } = req.body
    if (!secret || typeof secret !== 'string' || !token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Faltan secret o código de verificación.' })
    }
    const verified = speakeasy.totp.verify({
      secret: secret.trim(),
      encoding: 'base32',
      token: token.replace(/\s/g, ''),
      window: 1,
    })
    if (!verified) {
      return res.status(400).json({ error: 'Código incorrecto. Verificá el código de 6 dígitos de Google Authenticator.' })
    }
    const row = await updateUser(id, { totp_secret: secret.trim() })
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ message: 'Google Authenticator activado.', user: toUserResponse(row) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al activar 2FA.' })
  }
})

app.post('/api/users/:id/totp-verify', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = await getUserById(id)
    if (!row || !row.totp_secret) {
      return res.status(400).json({ error: 'La cuenta no tiene 2FA activado.' })
    }
    const { token } = req.body
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Ingresá el código de 6 dígitos.' })
    }
    const verified = speakeasy.totp.verify({
      secret: row.totp_secret,
      encoding: 'base32',
      token: token.replace(/\s/g, ''),
      window: 1,
    })
    if (!verified) {
      return res.status(401).json({ error: 'Código incorrecto.' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al verificar el código.' })
  }
})

app.post('/api/users/:id/totp-disable', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = await getUserById(id)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const { password } = req.body
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Ingresá tu contraseña para desactivar 2FA.' })
    }
    const user = await verifyUserPassword(row.email, password)
    if (!user) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' })
    }
    const updated = await updateUser(id, { totp_secret: null })
    if (!updated) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ message: 'Google Authenticator desactivado.', user: toUserResponse(updated) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al desactivar 2FA.' })
  }
})

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const { currentPassword, pin, newPassword } = req.body
    if (!newPassword || !isValidPassword(newPassword)) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener mínimo 6 caracteres, letras o números y al menos una mayúscula.',
      })
    }
    let updated = false
    if (pin != null && typeof pin === 'string') {
      if (!/^[0-9]{4,6}$/.test(pin)) {
        return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos.' })
      }
      updated = await updateUserPasswordWithPin(id, pin, newPassword)
      if (!updated) {
        return res.status(401).json({ error: 'PIN incorrecto.' })
      }
    } else if (currentPassword != null && typeof currentPassword === 'string') {
      updated = await updateUserPassword(id, currentPassword, newPassword)
      if (!updated) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta.' })
      }
    } else {
      return res.status(400).json({ error: 'Ingresá tu contraseña actual o tu PIN.' })
    }
    const user = await getUserById(id)
    if (user?.email) {
      sendPasswordChangedEmail(user.email).catch((err) =>
        console.error('[Email] Fallo envío aviso cambio contraseña:', err)
      )
    }
    res.json({ message: 'Contraseña actualizada correctamente.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cambiar la contraseña.' })
  }
})

/**
 * Eliminar usuario por ID. Requiere contraseña en el body: { password: string }
 */
app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const password = req.body?.password
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'La contraseña es obligatoria para eliminar la cuenta.' })
    }
    const user = await getUserById(id)
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const verified = await verifyUserPassword(user.email, password.trim())
    if (!verified) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' })
    }
    const deleted = await deleteUserById(id)
    if (!deleted) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ message: 'Cuenta eliminada correctamente.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar la cuenta.' })
  }
})

app.get('/api/monitor/health', (_req, res) => {
  res.json({ ok: true, monitor: true })
})

app.get('/api/monitor/swap-config', (req, res) => {
  try {
    const cfg = getSwapConfig()
    res.json({
      platformFeeBps: cfg.platformFeeBps,
      feeWallet: cfg.feeWallet,
      slippageBps: cfg.slippageBps,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar configuración.' })
  }
})
app.put('/api/monitor/swap-config', (req, res) => {
  try {
    const body = req.body || {}
    const updated = setSwapConfig({
      platformFeeBps: body.platformFeeBps,
      feeWallet: body.feeWallet,
      slippageBps: body.slippageBps,
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar configuración.' })
  }
})
app.get('/api/monitor/balance-snapshots', (req, res) => {
  try {
    const snapshots = getBalanceSnapshots()
    res.json({ snapshots })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar snapshots.' })
  }
})

app.post('/api/monitor/balance-snapshot', (req, res) => {
  try {
    const body = req.body || {}
    const userId = body.userId ?? body.user_id
    if (userId == null) return res.status(400).json({ error: 'Falta userId.' })
    setBalanceSnapshot({
      userId: Number(userId),
      email: body.email || '',
      totalUsd: body.totalUsd != null ? String(body.totalUsd) : '0',
      balances: body.balances && typeof body.balances === 'object' ? body.balances : {},
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar snapshot.' })
  }
})

app.get('/api/monitor/users', async (req, res) => {
  try {
    const list = await getAllUsers()
    res.json({
      users: list.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        secondName: u.second_name,
        firstSurname: u.first_surname,
        secondSurname: u.second_surname,
        createdAt: u.created_at,
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar usuarios.' })
  }
})

app.get('/api/monitor/access-log', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500)
    const log = await getAccessLog(limit)
    res.json({ log })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar histórico de accesos.' })
  }
})

app.get('/api/monitor/users-with-balances', async (req, res) => {
  try {
    const list = getUsersWithAddresses()
    const zeroBalances = { btc: '0', sol: '0', eth: '0', usdt: '0', doge: '0', ltc: '0' }
    const users = list.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      secondName: u.second_name ?? null,
      firstSurname: u.first_surname,
      secondSurname: u.second_surname ?? null,
      createdAt: u.created_at,
      balances: zeroBalances,
      totalUsd: '0.00',
    }))
    res.json({ users })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar usuarios con saldos.' })
  }
})

app.get('/api/monitor/swaps', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500)
    const swaps = getSwapLog(limit)
    res.json({ swaps })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar swaps.' })
  }
})

app.get('/api/monitor/operations', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 300, 500)
    const operations = getOperationsLog(limit)
    res.json({ operations })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar operaciones.' })
  }
})

// ——— Jupiter Swap (Solana): quote + swap + envío de transacción ———
const JUPITER_API = 'https://api.jup.ag'
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
const HELIUS_RPC = process.env.HELIUS_API_KEY || null
const SOLANA_RPCS_SEND = HELIUS_RPC
  ? [HELIUS_RPC, 'https://api.mainnet-beta.solana.com', 'https://rpc.ankr.com/solana']
  : ['https://api.mainnet-beta.solana.com', 'https://api.mainnet.solana.com', 'https://rpc.ankr.com/solana']

function getAssociatedTokenAddress(ownerPubkey, mintPubkey) {
  const [ata] = PublicKey.findProgramAddressSync(
    [ownerPubkey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return ata.toBase58()
}

app.get('/api/jupiter/quote', async (req, res) => {
  try {
    const cfg = getSwapConfig()
    const inputMint = typeof req.query.inputMint === 'string' ? req.query.inputMint.trim() : ''
    const outputMint = typeof req.query.outputMint === 'string' ? req.query.outputMint.trim() : ''
    const amount = typeof req.query.amount === 'string' ? req.query.amount.trim() : ''
    const slippageBps = Math.min(10000, Math.max(1, Number(req.query.slippageBps) || cfg.slippageBps))
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({ error: 'Faltan inputMint, outputMint o amount.' })
    }
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: String(slippageBps),
      platformFeeBps: String(cfg.platformFeeBps),
    })
    const url = `${JUPITER_API}/swap/v1/quote?${params}`
    const r = await fetchWithTimeout(url, { method: 'GET', headers: { Accept: 'application/json' } }, 15000)
    if (!r.ok) {
      const errText = await r.text()
      let message = errText || 'Error al obtener quote de Jupiter.'
      try {
        const parsed = JSON.parse(errText)
        if (parsed?.error) message = parsed.error
        else if (parsed?.message) message = parsed.message
      } catch (_) {}
      if (/route|ruta|not found|no encontrada/i.test(message)) message = 'No hay ruta de swap para este par o monto. Probá con otro monto o par (ej. SOL → USDC).'
      return res.status(r.status).json({ error: message })
    }
    const data = await r.json()
    return res.json(data)
  } catch (err) {
    console.error('[Jupiter quote]', err)
    res.status(500).json({ error: 'Error al obtener cotización.' })
  }
})

app.post('/api/jupiter/swap', async (req, res) => {
  try {
    const cfg = getSwapConfig()
    const { quoteResponse, userPublicKey } = req.body || {}
    if (!quoteResponse || !userPublicKey || typeof userPublicKey !== 'string') {
      return res.status(400).json({ error: 'Faltan quoteResponse o userPublicKey.' })
    }
    const inputMint = quoteResponse.inputMint || quoteResponse.input?.mint
    const outputMint = quoteResponse.outputMint || quoteResponse.output?.mint
    const mintForFee = outputMint || inputMint
    if (!mintForFee) {
      return res.status(400).json({ error: 'Quote sin input/output mint.' })
    }
    const feeOwner = new PublicKey(cfg.feeWallet)
    const feeMint = new PublicKey(mintForFee)
    const feeAccount = getAssociatedTokenAddress(feeOwner, feeMint)
    const body = JSON.stringify({
      quoteResponse,
      userPublicKey: userPublicKey.trim(),
      feeAccount,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: { maxBps: 100 },
    })
    const r = await fetchWithTimeout(`${JUPITER_API}/swap/v1/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    }, 20000)
    if (!r.ok) {
      const errText = await r.text()
      return res.status(r.status).json({ error: errText || 'Error al construir swap.' })
    }
    const data = await r.json()
    return res.json(data)
  } catch (err) {
    console.error('[Jupiter swap]', err)
    res.status(500).json({ error: 'Error al construir transacción de swap.' })
  }
})

app.post('/api/solana/send-transaction', async (req, res) => {
  try {
    const { signedTransaction } = req.body || {}
    if (typeof signedTransaction !== 'string' || !signedTransaction) {
      return res.status(400).json({ error: 'Falta signedTransaction (base64).' })
    }
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [signedTransaction, { encoding: 'base64', skipPreflight: false }],
    })
    for (const rpc of SOLANA_RPCS_SEND) {
      try {
        const r = await fetchWithTimeout(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, 30000)
        if (!r.ok) continue
        const data = await r.json()
        if (data.error) {
          return res.status(400).json({ error: data.error.message || 'Transacción rechazada.' })
        }
        return res.json({ signature: data.result })
      } catch {
        continue
      }
    }
    res.status(502).json({ error: 'No se pudo enviar la transacción.' })
  } catch (err) {
    console.error('[Solana send]', err)
    res.status(500).json({ error: 'Error al enviar transacción.' })
  }
})

// Cualquier ruta no definida → 404 JSON (no HTML)
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada', path: req.path })
})

// Si se ejecuta directamente (node server/app.js), arrancar servidor en 3001
const PORT = process.env.PORT || 3001
if (process.argv[1]?.endsWith('app.js')) {
  app.listen(PORT, () => {
    console.log(`Servidor (app.js) en http://localhost:${PORT} — /api/monitor/*, /api/jupiter/quote, /api/jupiter/swap`)
  })
}

export default app
