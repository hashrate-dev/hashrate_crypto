import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import express from 'express'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })
import cors from 'cors'
import speakeasy from 'speakeasy'
import OpenAI from 'openai'
import { addUser, getUserByEmail, getUserById, updateUser, updateUserPassword, updateUserPasswordWithPin, setUserPin, clearUserPin, verifyUserPin, deleteUserById, verifyUserPassword, getAllUsers, logAccess, getAccessLog } from './db.js'
import { sendPasswordChangedEmail } from './email.js'

const openaiKey = process.env.OPENAI_API_KEY?.trim()
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

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
    lightningAddress: row.lightning_address ?? null,
    totpEnabled: !!(row.totp_secret != null && row.totp_secret !== ''),
  }
}

// Contraseña: mínimo 6 caracteres, letras o números, al menos una mayúscula
function isValidPassword(pwd) {
  if (typeof pwd !== 'string' || pwd.length < 6) return false
  if (!/^(?=.*[A-Z])[A-Za-z0-9]+$/.test(pwd)) return false
  return true
}
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true }))
app.use(express.json())

/**
 * Registro de usuario.
 * Body: { email, password, firstName, secondName, firstSurname, secondSurname }
 * Contraseña: mínimo 6 caracteres, letras o números, al menos una mayúscula.
 */
app.post('/api/register', (req, res) => {
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
    if (getUserByEmail(normalizedEmail)) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email.' })
    }

    const row = addUser({
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

/**
 * Obtener usuario por ID NUMBER.
 */
app.get('/api/users/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = getUserById(id)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ user: toUserResponse(row) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener el usuario.' })
  }
})

/**
 * Inicio de sesión con email y contraseña.
 * Body: { email, password }
 */
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'El email es obligatorio.' })
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'La contraseña es obligatoria.' })
    }
    const user = verifyUserPassword(email.trim(), password)
    if (!user) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos.' })
    }
    logAccess({
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

/**
 * Obtener usuario por email.
 */
app.get('/api/users/by-email/:email', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).trim().toLowerCase()
    if (!email) {
      return res.status(400).json({ error: 'Email no válido.' })
    }
    const row = getUserByEmail(email)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ user: toUserResponse(row) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener el usuario.' })
  }
})

/**
 * Actualizar usuario por ID NUMBER. El email no se puede cambiar.
 * Body: { firstName?, secondName?, firstSurname?, secondSurname?, lightningAddress? }
 */
app.put('/api/users/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const current = getUserById(id)
    if (!current) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const { firstName, secondName, firstSurname, secondSurname, lightningAddress } = req.body
    const row = updateUser(id, {
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

/**
 * Vincular o reemplazar direcciones de wallet (derivadas de frase semilla).
 * Body: { btcAddress, usdtAddress, encryptedSeed?, seedSalt?, password? }
 * Si la cuenta ya tiene wallets, password es obligatorio para reemplazar.
 */
app.put('/api/users/:id/wallets', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const current = getUserById(id)
    if (!current) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const alreadyHasWallets =
      (current.btc_address && current.btc_address.trim() !== '') ||
      (current.usdt_address && current.usdt_address.trim() !== '') ||
      (current.doge_address && current.doge_address.trim() !== '')
    if (alreadyHasWallets) {
      const { password } = req.body
      if (!password || typeof password !== 'string') {
        return res.status(400).json({
          error: 'Para generar una nueva frase semilla tenés que ingresar tu contraseña.',
        })
      }
      const verified = verifyUserPassword(current.email, password)
      if (!verified) {
        return res.status(401).json({ error: 'Contraseña incorrecta.' })
      }
    }
    const { btcAddress, usdtAddress, dogeAddress, encryptedSeed, seedSalt } = req.body
    if (btcAddress != null && typeof btcAddress !== 'string') {
      return res.status(400).json({ error: 'btcAddress debe ser una cadena.' })
    }
    if (usdtAddress != null && typeof usdtAddress !== 'string') {
      return res.status(400).json({ error: 'usdtAddress debe ser una cadena.' })
    }
    if (dogeAddress != null && typeof dogeAddress !== 'string') {
      return res.status(400).json({ error: 'dogeAddress debe ser una cadena.' })
    }
    const row = updateUser(id, {
      btc_address: btcAddress != null ? String(btcAddress).trim() : current.btc_address,
      usdt_address: usdtAddress != null ? String(usdtAddress).trim() : current.usdt_address,
      doge_address: dogeAddress != null ? String(dogeAddress).trim() : current.doge_address,
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

/**
 * Obtener la frase semilla cifrada para mostrarla tras verificar contraseña en el cliente.
 * GET /api/users/:id/encrypted-seed
 */
app.get('/api/users/:id/encrypted-seed', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = getUserById(id)
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
 * Guardar PIN del usuario (para poder cambiar contraseña con PIN si no la recuerda).
 * Body: { pin } — 4 a 6 dígitos.
 */
app.put('/api/users/:id/pin', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const { pin } = req.body
    if (!pin || typeof pin !== 'string' || !/^[0-9]{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos (solo números).' })
    }
    const ok = setUserPin(id, pin)
    if (!ok) return res.status(404).json({ error: 'Usuario no encontrado.' })
    res.json({ message: 'PIN guardado correctamente.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar el PIN.' })
  }
})

/**
 * Eliminar PIN del usuario.
 */
app.delete('/api/users/:id/pin', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const ok = clearUserPin(id)
    if (!ok) return res.status(404).json({ error: 'Usuario no encontrado.' })
    res.json({ message: 'PIN eliminado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar el PIN.' })
  }
})

/**
 * Google Authenticator (TOTP): obtener secreto para configurar. No guarda hasta totp-enable.
 */
app.get('/api/users/:id/totp-setup', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = getUserById(id)
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

/**
 * Activar Google Authenticator: verificar código y guardar secreto.
 * Body: { secret, token } (token = código de 6 dígitos de la app).
 */
app.post('/api/users/:id/totp-enable', (req, res) => {
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
    const row = updateUser(id, { totp_secret: secret.trim() })
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ message: 'Google Authenticator activado.', user: toUserResponse(row) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al activar 2FA.' })
  }
})

/**
 * Verificar código TOTP (para enviar fondos u otras acciones sensibles).
 * Body: { token }
 */
app.post('/api/users/:id/totp-verify', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = getUserById(id)
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

/**
 * Desactivar Google Authenticator. Body: { password }
 */
app.post('/api/users/:id/totp-disable', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = getUserById(id)
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const { password } = req.body
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Ingresá tu contraseña para desactivar 2FA.' })
    }
    const user = verifyUserPassword(row.email, password)
    if (!user) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' })
    }
    const updated = updateUser(id, { totp_secret: null })
    if (!updated) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ message: 'Google Authenticator desactivado.', user: toUserResponse(updated) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al desactivar 2FA.' })
  }
})

/**
 * Cambiar contraseña del usuario por ID.
 * Body: { currentPassword, newPassword } O bien { pin, newPassword } si no recuerda la contraseña.
 */
app.put('/api/users/:id/password', (req, res) => {
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
      updated = updateUserPasswordWithPin(id, pin, newPassword)
      if (!updated) {
        return res.status(401).json({ error: 'PIN incorrecto.' })
      }
    } else if (currentPassword != null && typeof currentPassword === 'string') {
      updated = updateUserPassword(id, currentPassword, newPassword)
      if (!updated) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta.' })
      }
    } else {
      return res.status(400).json({ error: 'Ingresá tu contraseña actual o tu PIN.' })
    }
    const user = getUserById(id)
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
 * Eliminar usuario por ID NUMBER. Borra la cuenta de la base de datos.
 */
app.delete('/api/users/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const deleted = deleteUserById(id)
    if (!deleted) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    res.json({ message: 'Cuenta eliminada correctamente.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar la cuenta.' })
  }
})

/**
 * Monitor: listado de usuarios registrados (ID, email, nombre, apellido).
 */
app.get('/api/monitor/users', (req, res) => {
  try {
    const list = getAllUsers()
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

/**
 * Monitor: histórico de accesos (logins).
 */
app.get('/api/monitor/access-log', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500)
    const log = getAccessLog(limit)
    res.json({ log })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar histórico de accesos.' })
  }
})

/**
 * Análisis de mercado por IA (OpenAI). Actualizable cada 10 min desde el front.
 * GET /api/market-analysis/:assetId?price=67142&change24h=-1.5
 */
const ASSET_NAMES = { btc: 'Bitcoin', btc_lightning: 'Bitcoin (Lightning)', usdt: 'USDT (Tether)', doge: 'Dogecoin' }
app.get('/api/market-analysis/:assetId', async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: 'Análisis IA no configurado. Configurá OPENAI_API_KEY en el servidor.' })
    }
    const { assetId } = req.params
    const assetName = ASSET_NAMES[assetId] || 'este activo'
    const price = parseFloat(req.query.price) || 0
    const change24h = req.query.change24h != null ? parseFloat(req.query.change24h) : null

    const context = []
    if (price > 0) context.push(`Precio actual aproximado: $${price >= 1000 ? Math.round(price).toLocaleString('en-US') : price.toFixed(2)} USD`)
    if (change24h != null && !Number.isNaN(change24h)) context.push(`Variación 24h: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`)
    const contextStr = context.length ? context.join('. ') : 'Sin datos de precio recientes.'

    const userPrompt = `Analizá ${assetName} en este momento. Contexto: ${contextStr}. Escribí un comentario breve (2 a 4 frases) en español: qué está pasando con el activo y qué podría pasar a corto plazo (próximos días). Sé conciso y directo. No des consejos de inversión ni recomendaciones de compra/venta.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sos un analista de mercados cripto. Respondés solo con el análisis solicitado, en español, de forma breve y clara.' },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 280,
      temperature: 0.6,
    })
    const text = completion.choices[0]?.message?.content?.trim() || 'No se pudo generar el análisis.'
    res.json({ analysis: text })
  } catch (err) {
    console.error('Market analysis AI error:', err)
    const msg = err?.message || 'Error al generar el análisis.'
    const status = err?.status === 401 ? 503 : err?.status === 429 ? 429 : 500
    res.status(status).json({ error: msg })
  }
})

app.listen(PORT, () => {
  console.log(`Servidor de usuarios escuchando en http://localhost:${PORT}`)
  if (!openai) console.warn('OPENAI_API_KEY no configurada: el análisis IA en Mercado mostrará análisis local. Agregá OPENAI_API_KEY en server/.env para activarlo.')
})
