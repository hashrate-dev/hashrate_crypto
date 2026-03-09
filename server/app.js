import './loadEnv.js'
import express from 'express'
import cors from 'cors'
import speakeasy from 'speakeasy'
import { addUser, getUserByEmail, getUserById, updateUser, updateUserPassword, updateUserPasswordWithPin, setUserPin, clearUserPin, verifyUserPin, deleteUserById, verifyUserPassword, getAllUsers, logAccess, getAccessLog, healthCheck } from './db.js'
import { sendPasswordChangedEmail } from './email.js'

const app = express()

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
      (current.eth_address && current.eth_address.trim() !== '')
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
    const { btcAddress, usdtAddress, dogeAddress, ltcAddress, ethAddress, encryptedSeed, seedSalt } = req.body
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
    const isSavingSeed = encryptedSeed !== undefined && encryptedSeed != null && String(encryptedSeed).trim() !== ''
    if (isSavingSeed) {
      const allRequired = [btcAddress, usdtAddress, dogeAddress, ltcAddress, ethAddress]
      const missing = allRequired.some((a) => a == null || typeof a !== 'string' || String(a).trim() === '')
      if (missing) {
        return res.status(400).json({
          error: 'Al vincular o reemplazar la frase semilla tenés que enviar todas las direcciones (BTC, USDT, DOGE, LTC, ETH).',
        })
      }
    }
    const row = await updateUser(id, {
      btc_address: btcAddress != null ? String(btcAddress).trim() : current.btc_address,
      usdt_address: usdtAddress != null ? String(usdtAddress).trim() : current.usdt_address,
      doge_address: dogeAddress != null ? String(dogeAddress).trim() : current.doge_address,
      ltc_address: ltcAddress != null ? String(ltcAddress).trim() : current.ltc_address,
      eth_address: ethAddress != null ? String(ethAddress).trim() : current.eth_address,
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

app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
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

// Cualquier ruta no definida → 404 JSON (no HTML)
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada', path: req.path })
})

export default app
