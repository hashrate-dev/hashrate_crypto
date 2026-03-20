import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import express from 'express'
import { PublicKey } from '@solana/web3.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })
import cors from 'cors'
import speakeasy from 'speakeasy'
import { addUser, getUserByEmail, getUserById, updateUser, updateUserPassword, updateUserPasswordWithPin, setUserPin, clearUserPin, verifyUserPin, deleteUserById, verifyUserPassword, getAllUsers, getUsersWithAddresses, logAccess, getAccessLog, logSwap, getSwapLog, logOperation, getOperationsLog, setBalanceSnapshot, getBalanceSnapshots, getSwapConfig, setSwapConfig } from './db.js'
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
    solAddress: row.sol_address ?? null,
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

// Comprobar que el backend es el correcto y que el proxy llega
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, balanceRoutes: true })
})

// Precio actual desde Binance (misma fuente para todas las monedas: ticker/price)
const BINANCE_SYMBOLS = { btc: 'BTCUSDT', usdt: 'USDCUSDT', doge: 'DOGEUSDT', ltc: 'LTCUSDT', eth: 'ETHUSDT', sol: 'SOLUSDT' }
const BINANCE_ASSET_IDS = ['btc', 'usdt', 'doge', 'ltc', 'eth', 'sol']

async function fetchBinancePrice(symbol) {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`
  const r = await fetch(url)
  if (!r.ok) return null
  const data = await r.json()
  const price = data?.price != null ? Number(data.price) : null
  return Number.isFinite(price) ? price : null
}

app.get('/api/binance/price', async (req, res) => {
  try {
    const asset = (req.query.asset || req.query.symbol || '').toString().toLowerCase()
    const symbol = BINANCE_SYMBOLS[asset] || (asset && asset.length <= 10 ? asset.toUpperCase() + (asset.includes('USDT') ? '' : 'USDT') : 'BTCUSDT')
    const price = await fetchBinancePrice(symbol)
    if (price == null) return res.status(502).json({ error: 'Binance no respondió' })
    return res.json({ price: String(price), symbol: symbol })
  } catch (err) {
    console.error('[Binance price]', err)
    res.status(500).json({ error: 'Error al obtener precio' })
  }
})

// Todos los precios en una llamada (misma fuente que Bitcoin: Binance ticker/price)
app.get('/api/binance/prices', async (_req, res) => {
  try {
    const symbols = BINANCE_ASSET_IDS.map((id) => BINANCE_SYMBOLS[id])
    const results = await Promise.all(symbols.map((s) => fetchBinancePrice(s)))
    const prices = {}
    BINANCE_ASSET_IDS.forEach((id, i) => {
      prices[id] = results[i] != null ? results[i] : 0
    })
    return res.json(prices)
  } catch (err) {
    console.error('[Binance prices]', err)
    res.status(500).json({ error: 'Error al obtener precios' })
  }
})

// Transacciones reales de la wallet: Bitcoin (mempool.space)
const MEMPOOL_BASE = 'https://mempool.space/api'
app.get('/api/btc/transactions', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    if (!address || address.length < 26) {
      return res.status(400).json({ error: 'Dirección Bitcoin inválida.' })
    }
    const r = await fetch(`${MEMPOOL_BASE}/address/${encodeURIComponent(address)}/txs`)
    if (!r.ok) {
      if (r.status === 404) return res.json([])
      throw new Error(`Mempool: ${r.status}`)
    }
    const txs = await r.json()
    const out = []
    const SAT = 1e8
    for (const tx of txs) {
      let received = 0
      let sent = 0
      let counterparty = ''
      for (const o of tx.vout || []) {
        if (o.scriptpubkey_address === address) {
          received += o.value || 0
        } else if (!counterparty && o.scriptpubkey_address) {
          counterparty = o.scriptpubkey_address
        }
      }
      for (const i of tx.vin || []) {
        const prev = i.prevout
        if (prev && prev.scriptpubkey_address === address) {
          sent += prev.value || 0
        } else if (prev && prev.scriptpubkey_address && !counterparty) {
          counterparty = prev.scriptpubkey_address
        }
      }
      const net = received - sent
      if (net === 0) continue
      const type = net > 0 ? 'receive' : 'send'
      const amountBtc = (Math.abs(net) / SAT).toFixed(8)
      const shortAddr = counterparty
        ? (counterparty.slice(0, 6) + '...' + counterparty.slice(-4))
        : (tx.txid ? tx.txid.slice(0, 8) + '...' : '—')
      out.push({
        id: tx.txid || `btc-${out.length}`,
        type,
        asset: 'btc',
        amount: amountBtc,
        amountUsd: null,
        counterparty: shortAddr,
        timestamp: (tx.status && tx.status.block_time) ? tx.status.block_time * 1000 : Date.now(),
        status: (tx.status && tx.status.confirmed) ? 'completed' : 'pending',
        txHash: tx.txid,
        isLightning: false,
      })
    }
    res.json(out)
  } catch (err) {
    console.error('[BTC transactions]', err)
    res.status(500).json({ error: 'Error al cargar transacciones Bitcoin.' })
  }
})

// Transacciones reales: Dogecoin (BlockCypher)
const BLOCKCYPHER_DOGE = 'https://api.blockcypher.com/v1/doge/main'
app.get('/api/doge/transactions', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    if (!address || address.length < 26) {
      return res.status(400).json({ error: 'Dirección Dogecoin inválida.' })
    }
    const r = await fetch(`${BLOCKCYPHER_DOGE}/addrs/${encodeURIComponent(address)}/full?limit=50`)
    if (!r.ok) {
      if (r.status === 404) return res.json([])
      throw new Error(`BlockCypher DOGE: ${r.status}`)
    }
    const data = await r.json()
    const txs = data.txs || []
    const out = []
    const SAT = 1e8
    for (const tx of txs) {
      let received = 0
      let sent = 0
      let counterparty = ''
      for (const o of tx.outputs || []) {
        const addrs = o.addresses || []
        if (addrs.includes(address)) {
          received += o.value || 0
        } else if (addrs[0] && !counterparty) {
          counterparty = addrs[0]
        }
      }
      for (const i of tx.inputs || []) {
        const addrs = i.addresses || []
        if (addrs.includes(address)) {
          sent += i.output_value || 0
        } else if (addrs[0] && !counterparty) {
          counterparty = addrs[0]
        }
      }
      const net = received - sent
      if (net === 0) continue
      const type = net > 0 ? 'receive' : 'send'
      const amountDoge = (Math.abs(net) / SAT).toFixed(8)
      const shortAddr = counterparty ? (counterparty.slice(0, 6) + '...' + counterparty.slice(-4)) : (tx.hash ? tx.hash.slice(0, 8) + '...' : '—')
      out.push({
        id: tx.hash || `doge-${out.length}`,
        type,
        asset: 'doge',
        amount: amountDoge,
        amountUsd: null,
        counterparty: shortAddr,
        timestamp: (tx.received && tx.received !== tx.confirmed) ? new Date(tx.received).getTime() : (tx.confirmed ? new Date(tx.confirmed).getTime() : Date.now()),
        status: tx.confirmations > 0 ? 'completed' : 'pending',
        txHash: tx.hash,
        isLightning: false,
      })
    }
    out.sort((a, b) => b.timestamp - a.timestamp)
    res.json(out)
  } catch (err) {
    console.error('[DOGE transactions]', err)
    res.status(500).json({ error: 'Error al cargar transacciones Dogecoin.' })
  }
})

// Transacciones reales: Litecoin (BlockCypher)
const BLOCKCYPHER_LTC = 'https://api.blockcypher.com/v1/ltc/main'
app.get('/api/ltc/transactions', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    if (!address || address.length < 26) {
      return res.status(400).json({ error: 'Dirección Litecoin inválida.' })
    }
    const r = await fetch(`${BLOCKCYPHER_LTC}/addrs/${encodeURIComponent(address)}/full?limit=50`)
    if (!r.ok) {
      if (r.status === 404) return res.json([])
      throw new Error(`BlockCypher LTC: ${r.status}`)
    }
    const data = await r.json()
    const txs = data.txs || []
    const out = []
    const SAT = 1e8
    for (const tx of txs) {
      let received = 0
      let sent = 0
      let counterparty = ''
      for (const o of tx.outputs || []) {
        const addrs = o.addresses || []
        if (addrs.includes(address)) {
          received += o.value || 0
        } else if (addrs[0] && !counterparty) {
          counterparty = addrs[0]
        }
      }
      for (const i of tx.inputs || []) {
        const addrs = i.addresses || []
        if (addrs.includes(address)) {
          sent += i.output_value || 0
        } else if (addrs[0] && !counterparty) {
          counterparty = addrs[0]
        }
      }
      const net = received - sent
      if (net === 0) continue
      const type = net > 0 ? 'receive' : 'send'
      const amountLtc = (Math.abs(net) / SAT).toFixed(8)
      const shortAddr = counterparty ? (counterparty.slice(0, 6) + '...' + counterparty.slice(-4)) : (tx.hash ? tx.hash.slice(0, 8) + '...' : '—')
      out.push({
        id: tx.hash || `ltc-${out.length}`,
        type,
        asset: 'ltc',
        amount: amountLtc,
        amountUsd: null,
        counterparty: shortAddr,
        timestamp: (tx.received && tx.received !== tx.confirmed) ? new Date(tx.received).getTime() : (tx.confirmed ? new Date(tx.confirmed).getTime() : Date.now()),
        status: tx.confirmations > 0 ? 'completed' : 'pending',
        txHash: tx.hash,
        isLightning: false,
      })
    }
    out.sort((a, b) => b.timestamp - a.timestamp)
    res.json(out)
  } catch (err) {
    console.error('[LTC transactions]', err)
    res.status(500).json({ error: 'Error al cargar transacciones Litecoin.' })
  }
})

// Transacciones reales: Ethereum (Etherscan; opcional ETHERSCAN_API_KEY en .env)
const ETHERSCAN_API = 'https://api.etherscan.io/api'
app.get('/api/eth/transactions', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    if (!address || address.length !== 42 || !address.startsWith('0x')) {
      return res.status(400).json({ error: 'Dirección Ethereum inválida.' })
    }
    const key = process.env.ETHERSCAN_API_KEY || ''
    const url = `${ETHERSCAN_API}?module=account&action=txlist&address=${encodeURIComponent(address)}&sort=desc&page=1&offset=50${key ? `&apikey=${key}` : ''}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Etherscan: ${r.status}`)
    const data = await r.json()
    if (data.status !== '1' || !Array.isArray(data.result)) {
      return res.json([])
    }
    const txs = data.result
    const out = []
    const WEI = 1e18
    for (const tx of txs) {
      const from = (tx.from || '').toLowerCase()
      const to = (tx.to || '').toLowerCase()
      const addr = address.toLowerCase()
      const value = parseInt(tx.value || '0', 10)
      if (value === 0) continue
      const isReceive = to === addr && from !== addr
      const isSend = from === addr && to !== addr
      if (!isReceive && !isSend) continue
      const type = isReceive ? 'receive' : 'send'
      const amountEth = (value / WEI).toFixed(8)
      const counterparty = isReceive ? from : to
      const shortAddr = counterparty ? (counterparty.slice(0, 6) + '...' + counterparty.slice(-4)) : '—'
      out.push({
        id: tx.hash || `eth-${out.length}`,
        type,
        asset: 'eth',
        amount: amountEth,
        amountUsd: null,
        counterparty: shortAddr,
        timestamp: parseInt(tx.timeStamp || '0', 10) * 1000,
        status: parseInt(tx.txreceipt_status || '1', 10) === 1 ? 'completed' : 'failed',
        txHash: tx.hash,
        isLightning: false,
      })
    }
    out.sort((a, b) => b.timestamp - a.timestamp)
    res.json(out)
  } catch (err) {
    console.error('[ETH transactions]', err)
    res.status(500).json({ error: 'Error al cargar transacciones Ethereum.' })
  }
})

// Balance SOL, ETH y USDT por proxy (CORS aplicado; el navegador puede llamar a :3001)
// Helius da historial de transacciones fiable (usado por Orb, etc.). Sin API key los RPC públicos suelen devolver vacío en getSignaturesForAddress.
const HELIUS_RPC = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api_key=${process.env.HELIUS_API_KEY}`
  : null
const SOLANA_RPCS = [
  ...(HELIUS_RPC ? [HELIUS_RPC] : []),
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.gateway.tatum.io',
]
const LAMPORTS_PER_SOL = 1e9
const RPC_TIMEOUT_MS = 12000
const RPC_TX_TIMEOUT_MS = 15000

function fetchWithTimeout(url, opts, ms = RPC_TIMEOUT_MS) {
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), ms)
  return fetch(url, { ...opts, signal: ac.signal })
    .finally(() => clearTimeout(to))
}

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
      params: [address, { commitment: 'finalized' }],
    })
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    let lastErr = null
    for (const rpc of SOLANA_RPCS) {
      try {
        const r = await fetchWithTimeout(rpc, opts)
        if (!r.ok) {
          lastErr = new Error(`${rpc} HTTP ${r.status}`)
          continue
        }
        const data = await r.json()
        if (data.error) {
          lastErr = new Error(data.error.message || 'RPC error')
          continue
        }
        const lamports = data.result?.value ?? data.result ?? 0
        const balanceSol = (Number(lamports) / LAMPORTS_PER_SOL).toFixed(9)
        return res.json({ balanceSol })
      } catch (e) {
        lastErr = e
        continue
      }
    }
    console.error('[Solana balance] Todos los RPC fallaron:', lastErr?.message || lastErr)
    res.status(502).json({ error: 'No se pudo conectar con la red de Solana. Reintentá más tarde.' })
  } catch (err) {
    console.error('[Solana balance]', err)
    res.status(500).json({ error: 'Error al consultar balance SOL.' })
  }
})

// Transacciones reales Solana: getSignaturesForAddress + getTransaction para delta de balance.
// Los RPC públicos suelen devolver [] en getSignaturesForAddress; con HELIUS_API_KEY el historial funciona (ej. Orb usa Helius).
// Sin Helius: solo probamos 1 RPC con timeout corto para no demorar minutos; con Helius usamos solo Helius.
const SOL_TX_LIMIT = 25
const SOL_PUBLIC_RPC_TIMEOUT_MS = 8000
const SOL_SIGNATURE_MAX_PAGES = 2
// Limitar cantidad de firmas para evitar rate-limit de RPC
const SOL_SIGNATURE_MAX_TOTAL = 60
async function fetchSolanaSignatures(address, commitment = 'finalized') {
  const baseParams = { commitment, limit: SOL_TX_LIMIT }
  const rpcsToTry = HELIUS_RPC ? [HELIUS_RPC] : SOLANA_RPCS
  const timeout = HELIUS_RPC ? RPC_TX_TIMEOUT_MS : SOL_PUBLIC_RPC_TIMEOUT_MS

  let lastEmpty = null
  for (const rpc of rpcsToTry) {
    const all = []
    let before = null
    try {
      for (let page = 0; page < SOL_SIGNATURE_MAX_PAGES && all.length < SOL_SIGNATURE_MAX_TOTAL; page++) {
        const params = { ...baseParams }
        if (before) params.before = before
        const bodySigs = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [address, params],
        })
        const res = await fetchWithTimeout(
          rpc,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodySigs },
          timeout
        )
        if (!res.ok) break
        const data = await res.json()
        if (data.error) break
        if (!Array.isArray(data.result)) break
        if (data.result.length === 0) break
        all.push(...data.result)
        before = data.result[data.result.length - 1]?.signature || before
        if (data.result.length < SOL_TX_LIMIT) break
      }
    } catch {
      // intenta otro RPC
      continue
    }

    if (all.length > 0) return { result: all }
    lastEmpty = lastEmpty || null
  }

  return lastEmpty
}

const HELIUS_WALLET_API = 'https://api.helius.xyz'
const HELIUS_ENHANCED_BASE = 'https://api-mainnet.helius-rpc.com'
const SOLSCAN_PRO_API = 'https://pro-api.solscan.io/v2.0'
// Mint nativo SOL (wrapped) – mismo que Orb / Solscan filtros
const SOL_MINT = 'So11111111111111111111111111111111111111112'
// Mostrar todos los montos SOL (incl. 0.000000001). Cero excluido.
const MIN_SOL_AMOUNT = 0
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111'

function toAccountKeys(messageAccountKeys) {
  if (!Array.isArray(messageAccountKeys)) return []
  return messageAccountKeys
    .map((k) => (typeof k === 'string' ? k : (k && (k.pubkey || k.address)) ? String(k.pubkey || k.address) : ''))
    .filter(Boolean)
}

function hasSystemProgramTransfer(ixs, accountKeys) {
  if (!Array.isArray(ixs) || !Array.isArray(accountKeys)) return false
  for (const ix of ixs) {
    const pidIndex = ix?.programIdIndex
    if (pidIndex == null) continue
    const pid = accountKeys[pidIndex]
    if (pid !== SYSTEM_PROGRAM_ID) continue
    const dataB64 = ix?.data
    if (!dataB64 || typeof dataB64 !== 'string') continue
    try {
      const buf = Buffer.from(dataB64, 'base64')
      if (buf.length < 4) continue
      const opcode = buf.readUInt32LE(0)
      // SystemProgram::transfer has opcode = 2
      if (opcode === 2) return true
    } catch {
      continue
    }
  }
  return false
}

function isSolSystemTransferTx(txRes) {
  const message = txRes?.transaction?.message
  const staticKeys = toAccountKeys(message?.accountKeys)
  const loaded = txRes?.meta?.loadedAddresses || {}
  const lw = Array.isArray(loaded.writable) ? loaded.writable : []
  const lr = Array.isArray(loaded.readonly) ? loaded.readonly : []
  const accountKeys = [...staticKeys, ...lw, ...lr]
  const topIxs = message?.instructions || []
  if (hasSystemProgramTransfer(topIxs, accountKeys)) return true
  const inner = txRes?.meta?.innerInstructions || []
  for (const group of inner) {
    if (hasSystemProgramTransfer(group?.instructions || [], accountKeys)) return true
  }
  return false
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Historial SOL vía Solscan Pro API (mismos datos que https://solscan.io/account/{address} → Transfers).
 * Requiere SOLSCAN_API_KEY en .env (https://solscan.io/apis).
 */
async function fetchSolanaFromSolscanPro(address) {
  const key = process.env.SOLSCAN_API_KEY?.trim()
  if (!key || !address) return null
  const out = []
  let page = 1
  const pageSize = 100
  const maxPages = 8
  try {
    for (let p = 0; p < maxPages; p++) {
      const qs = new URLSearchParams({
        address,
        token: SOL_MINT,
        page: String(page),
        page_size: String(pageSize),
        sort_by: 'block_time',
        sort_order: 'desc',
        exclude_amount_zero: 'true',
      })
      const url = `${SOLSCAN_PRO_API}/account/transfer?${qs}`
      const r = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { token: key, Accept: 'application/json' },
      }, 22000)
      if (!r.ok) break
      const body = await r.json().catch(() => ({}))
      let list = body.data
      if (!Array.isArray(list) && list && typeof list === 'object') {
        list = list.data ?? list.items ?? list.transfers ?? list.result
      }
      if (!Array.isArray(list)) list = body.result ?? []
      if (!Array.isArray(list) || list.length === 0) break
      for (const item of list) {
        let flow = String(item.flow || item.direction || '').toLowerCase()
        if (!flow) {
          const fr = String(item.from_address || item.from || '').trim()
          const to = String(item.to_address || item.to || '').trim()
          if (to === address && fr !== address) flow = 'in'
          else if (fr === address && to !== address) flow = 'out'
          else flow = 'out'
        }
        const type = flow === 'in' ? 'receive' : 'send'
        let amountRaw = item.amount ?? item.token_amount ?? item.change_amount ?? item.value
        if (amountRaw == null && item.amount_info?.amount != null) amountRaw = item.amount_info.amount
        const n = typeof amountRaw === 'string' ? parseFloat(amountRaw) : Number(amountRaw)
        if (!Number.isFinite(n) || Math.abs(n) <= MIN_SOL_AMOUNT) continue
        const amountAbs = Math.abs(n)
        const amountStr = (amountAbs < 1e-3 || amountAbs >= 1e12)
          ? amountAbs.toFixed(9).replace(/\.?0+$/, '') || '0'
          : String(amountAbs)
        const sig = String(item.trans_id || item.signature || item.tx_hash || item.hash || '').trim()
        let ts = Number(item.block_time ?? item.time ?? item.blockTime ?? 0)
        if (ts > 0 && ts < 1e12) ts *= 1000
        const fromAddr = String(item.from_address || item.from || item.source || '').trim()
        const toAddr = String(item.to_address || item.to || item.destination || '').trim()
        const counterparty = type === 'receive'
          ? (fromAddr ? `${fromAddr.slice(0, 6)}...${fromAddr.slice(-4)}` : '—')
          : (toAddr ? `${toAddr.slice(0, 6)}...${toAddr.slice(-4)}` : '—')
        out.push({
          id: sig ? `${sig.slice(0, 12)}-${out.length}` : `solscan-${out.length}`,
          type,
          asset: 'sol',
          amount: amountStr,
          amountUsd: item.value != null ? String(item.value) : null,
          counterparty,
          timestamp: ts || Date.now(),
          status: 'completed',
          txHash: sig,
          isLightning: false,
          source: 'solscan',
        })
      }
      if (list.length < pageSize) break
      page += 1
    }
    out.sort((a, b) => b.timestamp - a.timestamp)
    return out.length ? out : null
  } catch (e) {
    console.error('[Solscan Pro transfers]', e?.message || e)
    return null
  }
}

/** Misma fuente que Orb Transfers: Helius Wallet API → /v1/wallet/{address}/transfers. Paginación para traer todos los montos. */
async function fetchSolanaTransfersHeliusWallet(address) {
  const key = process.env.HELIUS_API_KEY
  if (!key || !address) return null
  const out = []
  let cursor = null
  const maxPages = 10
  try {
    for (let page = 0; page < maxPages; page++) {
      let url = `${HELIUS_WALLET_API}/v1/wallet/${address}/transfers?api-key=${key}&limit=100`
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`
      const r = await fetchWithTimeout(url, { method: 'GET', headers: { 'X-Api-Key': key } }, 15000)
      if (!r.ok) break
      const body = await r.json()
      let data = body.data ?? body.transfers ?? body
      if (data && typeof data === 'object' && !Array.isArray(data)) data = data.data ?? data.transfers ?? data.items ?? (Array.isArray(data.list) ? data.list : null)
      if (!Array.isArray(data) || data.length === 0) break
      for (const t of data) {
        const mint = String(t.mint || '').trim()
        const symbol = (t.symbol || '').toUpperCase()
        const isSol = mint === SOL_MINT || symbol === 'SOL' || (mint.length > 30 && mint.includes('111111111111111111111111111111'))
        if (!isSol) continue
        let amount = '0'
        if (t.amount != null) {
          const v = t.amount
          if (typeof v === 'string') amount = v.trim()
          else if (typeof v === 'number' && !Number.isNaN(v)) amount = (v < 1e-6 || v > 1e15) ? v.toFixed(9) : String(v)
          else amount = String(Number(v) || 0)
        } else if (t.amountRaw != null && t.decimals != null) {
          const raw = Number(t.amountRaw) || 0
          const dec = Math.max(0, Number(t.decimals) || 9)
          amount = (raw / Math.pow(10, dec)).toFixed(9)
        }
        const amountNum = parseFloat(amount)
        const amountAbs = Math.abs(amountNum)
        if (Number.isNaN(amountNum) || amountAbs <= MIN_SOL_AMOUNT) continue
        // Evitar notación científica: montos muy pequeños o grandes como 0.00000001, 3.67314073
        const amountPositive = (amountAbs < 1e-3 || amountAbs >= 1e12) ? amountAbs.toFixed(9).replace(/\.?0+$/, '') || '0' : String(amountAbs)
        const sig = t.signature || t.txHash || ''
        const ts = (t.timestamp != null ? Number(t.timestamp) : 0) * 1000
        const direction = (t.direction || '').toLowerCase()
        const type = direction === 'in' ? 'receive' : 'send'
        const counterparty = t.counterparty ? `${String(t.counterparty).slice(0, 6)}...${String(t.counterparty).slice(-4)}` : '—'
        out.push({ id: sig.slice(0, 20) || `sol-${out.length}`, type, asset: 'sol', amount: amountPositive, amountUsd: null, counterparty, timestamp: ts, status: 'completed', txHash: sig, isLightning: false })
      }
      const pagination = body.pagination
      if (!pagination?.hasMore || !pagination?.nextCursor) break
      cursor = pagination.nextCursor
    }
    out.sort((a, b) => b.timestamp - a.timestamp)
    return out.length ? out : null
  } catch {
    return null
  }
}

/** Fallback: Enhanced API solo tipo TRANSFER (equivalente a la pestaña Transfers de Orb). */
async function fetchSolanaTransfersHeliusEnhanced(address) {
  const key = process.env.HELIUS_API_KEY
  if (!key || !address) return null
  const url = `${HELIUS_ENHANCED_BASE}/v0/addresses/${address}/transactions?api-key=${key}&type=TRANSFER&limit=50`
  try {
    const r = await fetchWithTimeout(url, { method: 'GET' }, 12000)
    if (!r.ok) return null
    const list = await r.json()
    if (!Array.isArray(list)) return null
    const out = []
    for (const tx of list) {
      const sig = tx.signature
      const ts = (tx.timestamp != null ? Number(tx.timestamp) : 0) * 1000
      const native = tx.nativeTransfers || []
      for (const tr of native) {
        const from = tr.fromUserAccount || tr.from_user_account || ''
        const to = tr.toUserAccount || tr.to_user_account || ''
        let lamports = Number(tr.amount) ?? Number(tr.lamports) ?? 0
        if (typeof tr.amount === 'string') lamports = Math.round(parseFloat(tr.amount) || 0)
        if (lamports <= 0) continue
        if (lamports > 0 && lamports < 1e7) lamports = Math.round(lamports * LAMPORTS_PER_SOL)
        const amountSolRaw = (lamports / LAMPORTS_PER_SOL).toFixed(9)
        const amountSol = amountSolRaw.replace(/\.?0+$/, '') || '0'
        const amountNum = parseFloat(amountSol)
        if (amountNum <= MIN_SOL_AMOUNT) continue
        if (to === address && from !== address) {
          out.push({ id: `${sig}-${out.length}`, type: 'receive', asset: 'sol', amount: amountSol, amountUsd: null, counterparty: from ? `${from.slice(0, 6)}...${from.slice(-4)}` : '—', timestamp: ts, status: 'completed', txHash: sig, isLightning: false })
        } else if (from === address && to !== address) {
          out.push({ id: `${sig}-${out.length}`, type: 'send', asset: 'sol', amount: amountSol, amountUsd: null, counterparty: to ? `${to.slice(0, 6)}...${to.slice(-4)}` : '—', timestamp: ts, status: 'completed', txHash: sig, isLightning: false })
        }
      }
    }
    out.sort((a, b) => b.timestamp - a.timestamp)
    return out.length ? out : null
  } catch {
    return null
  }
}

// Historial SOL: 1) Solscan Pro (mismo criterio que solscan.io) si hay SOLSCAN_API_KEY
// 2) Helius Wallet / Enhanced 3) RPC
// address = wallet Solana del usuario (frase semilla), ej. 5NRr1M8F... para esa cuenta.
app.get('/api/solana/transactions', async (req, res) => {
  try {
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    if (!address || address.length < 32 || address.length > 44) {
      return res.status(400).json({ error: 'Dirección Solana inválida.' })
    }
    let solTxs = await fetchSolanaFromSolscanPro(address)
    if (solTxs && solTxs.length > 0) {
      return res.json(solTxs)
    }
    // 2) Helius Wallet API
    solTxs = await fetchSolanaTransfersHeliusWallet(address)
    // 2) Fallback: Enhanced Transactions con type=TRANSFER (solo transfers)
    if (!solTxs || solTxs.length === 0) {
      solTxs = await fetchSolanaTransfersHeliusEnhanced(address)
    }
    if (solTxs && solTxs.length > 0) {
      return res.json(solTxs)
    }
    let sigRes = await fetchSolanaSignatures(address, 'finalized')
    if (HELIUS_RPC && (!sigRes || !Array.isArray(sigRes.result) || sigRes.result.length === 0)) {
      sigRes = await fetchSolanaSignatures(address, 'confirmed')
    }
    if (!sigRes || !Array.isArray(sigRes.result) || sigRes.result.length === 0) {
      return res.json([])
    }
    const signatures = sigRes.result
    // Concurrencia alta + timeout corto en getTransaction puede dejar todo en 0/filtrado.
    // Si NO hay Helius, usamos un subconjunto de RPCs que suelen responder con historial.
    const rpcForTx = HELIUS_RPC
      ? [HELIUS_RPC]
      : ['https://api.mainnet-beta.solana.com', 'https://solana-mainnet.gateway.tatum.io']
    const txTimeout = 25000
    const BATCH = 1
    const fetchOne = async (item, rpc) => {
      const sig = item.signature
      if (!sig) return null
      const blockTime = item.blockTime != null ? item.blockTime * 1000 : Date.now()
      for (const maxVer of [0, 1]) {
        const bodyTx = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [sig, { commitment: 'finalized', encoding: 'json', maxSupportedTransactionVersion: maxVer }],
        })
        for (const r of rpc) {
          try {
            const res = await fetchWithTimeout(
              r,
              { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyTx },
              txTimeout
            )
            if (!res.ok) {
              if (res.status === 429) {
                await sleep(1200)
              }
              continue
            }
            const data = await res.json()
            if (data.error || !data.result) continue
            const txRes = data.result
            if (!txRes?.transaction?.message) continue
            // Solo “ACTION: TRANSFER” de Solscan (SystemProgram::transfer).
            // Esto excluye stake/withdraw/otros movimientos que también cambian el balance SOL.
            // (Temporal debug) Sin claves externas, el parseo de “ACTION: TRANSFER” vía instrucciones puede fallar.
            // Por ahora no filtramos por opcode; dejamos que aparezcan transacciones con delta real.
            // if (!isSolSystemTransferTx(txRes)) continue

            const rawKeys = txRes.transaction.message.accountKeys || []
            const staticKeys = Array.isArray(rawKeys)
              ? rawKeys.map((k) => (typeof k === 'string' ? k : (k && (k.pubkey || k.address)) ? String(k.pubkey || k.address) : '')).filter(Boolean)
              : []

            // v0 transactions can put extra keys in meta.loadedAddresses (writable/readonly).
            const loaded = txRes.meta?.loadedAddresses || {}
            const lw = Array.isArray(loaded.writable) ? loaded.writable : []
            const lr = Array.isArray(loaded.readonly) ? loaded.readonly : []
            const accountKeysFull = [...staticKeys, ...lw, ...lr]

            const preBalances = (txRes.meta && txRes.meta.preBalances) || []
            const postBalances = (txRes.meta && txRes.meta.postBalances) || []
            const idx = accountKeysFull.indexOf(address)

            let deltaLamports = 0
            if (idx >= 0 && idx < preBalances.length && idx < postBalances.length) {
              deltaLamports = Number(postBalances[idx]) - Number(preBalances[idx])
            }
            // Si el delta calculado es 0, no corresponde a un “transfer” real para la cuenta.
            if (!Number.isFinite(deltaLamports) || deltaLamports === 0) return null

            const amountSol = ((Math.abs(deltaLamports) / LAMPORTS_PER_SOL).toFixed(9).replace(/\.?0+$/, '') || '0')
            const type = deltaLamports >= 0 ? 'receive' : 'send'

            let counterparty = sig.slice(0, 8) + '...'
            if (accountKeysFull.length > 1) {
              const other = accountKeysFull.find((k) => k !== address)
              if (other) counterparty = other.slice(0, 6) + '...' + other.slice(-4)
            }

            return {
              id: sig.slice(0, 20),
              type,
              asset: 'sol',
              amount: amountSol,
              amountUsd: null,
              counterparty,
              timestamp: (txRes.blockTime != null ? txRes.blockTime * 1000 : blockTime),
              status: (txRes.meta && txRes.meta.err) ? 'failed' : 'completed',
              txHash: sig,
              isLightning: false,
            }
          } catch {
            continue
          }
        }
      }
      return null
    }
    const out = []
    for (let i = 0; i < signatures.length; i += BATCH) {
      const chunk = signatures.slice(i, i + BATCH)
      const results = await Promise.all(chunk.map((item) => fetchOne(item, rpcForTx)))
      out.push(...results.filter(Boolean))
    }
    // No filtrar por monto: en algunos RPCs el delta SOL puede calcularse como 0 para ciertas txs,
    // pero igual queremos que el historial aparezca (y luego afinamos el cálculo).
    const filtered = out.filter((t) => parseFloat(t.amount || '0') > 0)
    res.json(filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
  } catch (err) {
    console.error('[Solana transactions]', err)
    res.status(500).json({ error: 'Error al cargar transacciones Solana.' })
  }
})

// ——— Jupiter Swap (Solana): quote + swap con comisión a wallet del proyecto ———
const JUPITER_API = 'https://api.jup.ag'
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

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
    const r = await fetchWithTimeout(url, { method: 'GET', headers: { 'Accept': 'application/json' } }, 15000)
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
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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
    const rpcs = HELIUS_RPC ? [HELIUS_RPC] : SOLANA_RPCS
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [signedTransaction, { encoding: 'base64', skipPreflight: false }],
    })
    for (const rpc of rpcs) {
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

// ——— Helpers para calcular saldos por usuario en el monitor (desde direcciones guardadas) ———
async function fetchBtcBalance(address) {
  if (!address || address.length < 26) return '0'
  try {
    const r = await fetch(`${MEMPOOL_BASE}/address/${encodeURIComponent(address)}`)
    if (!r.ok) return '0'
    const data = await r.json()
    const confirmed = (data.chain_stats?.funded_txo_sum ?? 0) - (data.chain_stats?.spent_txo_sum ?? 0)
    const unconfirmed = (data.mempool_stats?.funded_txo_sum ?? 0) - (data.mempool_stats?.spent_txo_sum ?? 0)
    const sats = Math.max(0, confirmed + unconfirmed)
    return (sats / 1e8).toFixed(8)
  } catch {
    return '0'
  }
}

async function fetchDogeBalance(address) {
  if (!address || address.length < 26) return '0'
  try {
    const r = await fetch(`${BLOCKCYPHER_DOGE}/addrs/${encodeURIComponent(address)}/balance`)
    if (!r.ok) return '0'
    const data = await r.json()
    const total = (data.balance ?? 0) + (data.unconfirmed_balance ?? 0)
    return (total / 1e8).toFixed(8)
  } catch {
    return '0'
  }
}

async function fetchLtcBalance(address) {
  if (!address || address.length < 26) return '0'
  try {
    const r = await fetch(`${BLOCKCYPHER_LTC}/addrs/${encodeURIComponent(address)}/balance`)
    if (!r.ok) return '0'
    const data = await r.json()
    const total = (data.balance ?? 0) + (data.unconfirmed_balance ?? 0)
    return (total / 1e8).toFixed(8)
  } catch {
    return '0'
  }
}

async function fetchSolBalanceInternal(address) {
  if (!address || address.length < 32 || address.length > 44) return '0'
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address, { commitment: 'finalized' }] })
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
  for (const rpc of SOLANA_RPCS) {
    try {
      const r = await fetchWithTimeout(rpc, opts)
      if (!r.ok) continue
      const data = await r.json()
      if (data.error) continue
      const lamports = data.result?.value ?? data.result ?? 0
      return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(9)
    } catch {
      continue
    }
  }
  return '0'
}

async function fetchEthBalanceInternal(address) {
  if (!address || !address.startsWith('0x')) return '0'
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
  for (const rpc of ETH_RPCS) {
    try {
      const r = await fetch(rpc, opts)
      if (!r.ok) continue
      const data = await r.json()
      if (data.error) continue
      const hex = data.result || '0x0'
      const wei = BigInt(hex)
      return (Number(wei) / 1e18).toFixed(8)
    } catch {
      continue
    }
  }
  return '0'
}

async function fetchUsdtBalanceInternal(address) {
  if (!address || !address.startsWith('0x')) return '0'
  const addr = address.slice(2).padStart(64, '0').toLowerCase()
  const callData = '0x70a08231' + addr
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: USDT_CONTRACT, data: callData }, 'latest'] })
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
  for (const rpc of ETH_RPCS) {
    try {
      const r = await fetch(rpc, opts)
      if (!r.ok) continue
      const data = await r.json()
      if (data.error) continue
      const hex = data.result || '0x'
      const raw = hex === '0x' || !hex ? '0' : BigInt(hex).toString()
      return (Number(raw) / 1e6).toFixed(2)
    } catch {
      continue
    }
  }
  return '0'
}

async function getAllBinancePrices() {
  const results = await Promise.all(BINANCE_ASSET_IDS.map((id) => fetchBinancePrice(BINANCE_SYMBOLS[id])))
  const prices = {}
  BINANCE_ASSET_IDS.forEach((id, i) => {
    prices[id] = results[i] != null && Number.isFinite(results[i]) ? results[i] : 0
  })
  return prices
}

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

    logOperation({
      userId: row.id,
      email: row.email,
      type: 'user_registered',
      detail: `Nuevo usuario: ${String(firstName).trim()} ${String(firstSurname).trim()}`,
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
 * Al vincular o reemplazar se deben enviar todas las direcciones (btcAddress, usdtAddress, dogeAddress, ltcAddress, ethAddress)
 * para que queden registradas y disponibles en toda la app sin tener que ver la frase.
 * Body: { btcAddress, usdtAddress, dogeAddress?, ltcAddress?, ethAddress?, encryptedSeed?, seedSalt?, password? }
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
      const verified = verifyUserPassword(current.email, password)
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
    // Al guardar frase semilla (vincular o reemplazar), tienen que enviarse todas las direcciones derivadas
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
    const row = updateUser(id, {
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
 * Generar código de pago Lightning (factura BOLT11) para recibir.
 * Conectado a LNbits si LNBITS_URL y LNBITS_INVOICE_KEY están en .env; si no, se devuelve factura de prueba.
 * Body: { amountSats?: number, description?: string }
 * Respuesta: { invoice: string, expiresIn?: number } (invoice = lnbc...)
 */
app.post('/api/users/:id/lightning-invoice', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    const row = getUserById(id)
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
 * Eliminar usuario por ID. Requiere contraseña en el body: { password: string }
 */
app.delete('/api/users/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const password = req.body?.password
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID no válido.' })
    }
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'La contraseña es obligatoria para eliminar la cuenta.' })
    }
    const user = getUserById(id)
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }
    const verified = verifyUserPassword(user.email, password.trim())
    if (!verified) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' })
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
 * Diagnóstico: comprobar que el monitor API está disponible (evitar 404).
 */
app.get('/api/monitor/health', (_req, res) => {
  res.json({ ok: true, monitor: true })
})

/**
 * Monitor: snapshots de saldos por usuario (montos por moneda y total USD).
 */
app.get('/api/monitor/balance-snapshots', (req, res) => {
  try {
    const snapshots = getBalanceSnapshots()
    res.json({ snapshots })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al cargar snapshots de saldos.' })
  }
})

/**
 * Guardar snapshot de saldos del usuario (llamado por el Dashboard cuando carga).
 * Body: { userId, email, totalUsd, balances: { btc, sol, eth, usdt, doge, ltc, ... } }
 */
app.post('/api/monitor/balance-snapshot', (req, res) => {
  try {
    const body = req.body || {}
    const userId = body.userId ?? body.user_id
    if (userId == null) {
      return res.status(400).json({ error: 'Falta userId.' })
    }
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
 * Monitor: usuarios con saldos por moneda y total USD (calculados desde direcciones guardadas).
 * Si falla algo, se devuelve la lista de usuarios con saldos en 0 para que la tabla siempre tenga datos.
 */
app.get('/api/monitor/users-with-balances', async (req, res) => {
  let list = []
  try {
    list = getUsersWithAddresses()
  } catch (err) {
    console.error('[users-with-balances] getUsersWithAddresses:', err)
    return res.json({ users: [] })
  }
  const zeroBalances = { btc: '0', sol: '0', eth: '0', usdt: '0', doge: '0', ltc: '0' }
  const toUserRow = (u) => ({
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    secondName: u.second_name ?? null,
    firstSurname: u.first_surname,
    secondSurname: u.second_surname ?? null,
    createdAt: u.created_at,
    balances: zeroBalances,
    totalUsd: '0.00',
  })
  let prices = { btc: 0, usdt: 0, doge: 0, ltc: 0, eth: 0, sol: 0 }
  try {
    prices = await getAllBinancePrices()
  } catch (err) {
    console.error('[users-with-balances] precios Binance:', err?.message || err)
  }
  try {
    const usersWithBalances = await Promise.all(
      list.map(async (u) => {
        let btc = '0', sol = '0', eth = '0', usdt = '0', doge = '0', ltc = '0'
        try {
          ;[btc, sol, eth, usdt, doge, ltc] = await Promise.all([
            u.btc_address ? fetchBtcBalance(u.btc_address) : Promise.resolve('0'),
            u.sol_address ? fetchSolBalanceInternal(u.sol_address) : Promise.resolve('0'),
            u.eth_address ? fetchEthBalanceInternal(u.eth_address) : Promise.resolve('0'),
            u.usdt_address ? fetchUsdtBalanceInternal(u.usdt_address) : Promise.resolve('0'),
            u.doge_address ? fetchDogeBalance(u.doge_address) : Promise.resolve('0'),
            u.ltc_address ? fetchLtcBalance(u.ltc_address) : Promise.resolve('0'),
          ])
        } catch (err) {
          console.error('[users-with-balances] balances user', u.id, err?.message || err)
        }
        const balances = { btc, sol, eth, usdt, doge, ltc }
        const totalUsd =
          (prices.btc || 0) * parseFloat(btc) +
          (prices.sol || 0) * parseFloat(sol) +
          (prices.eth || 0) * parseFloat(eth) +
          (prices.usdt || 0) * parseFloat(usdt) +
          (prices.doge || 0) * parseFloat(doge) +
          (prices.ltc || 0) * parseFloat(ltc)
        return {
          id: u.id,
          email: u.email,
          firstName: u.first_name,
          secondName: u.second_name ?? null,
          firstSurname: u.first_surname,
          secondSurname: u.second_surname ?? null,
          createdAt: u.created_at,
          balances,
          totalUsd: totalUsd.toFixed(2),
        }
      })
    )
    return res.json({ users: usersWithBalances })
  } catch (err) {
    console.error('[users-with-balances]', err)
    return res.json({ users: list.map(toUserRow) })
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
 * Monitor: obtener configuración Jupiter (comisión %, wallet, slippage).
 */
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

/**
 * Monitor: guardar configuración Jupiter. Body: { platformFeeBps?, feeWallet?, slippageBps? }
 */
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

/**
 * Monitor: listado de swaps (Jupiter) con comisiones.
 */
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

/**
 * Registrar un swap completado (llamado por el frontend tras éxito).
 */
app.post('/api/monitor/log-swap', (req, res) => {
  try {
    const body = req.body || {}
    const userId = body.userId ?? body.user_id
    if (userId == null) {
      return res.status(400).json({ error: 'Falta userId.' })
    }
    logSwap({
      userId: Number(userId),
      email: body.email || '',
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      inAmount: body.inAmount,
      outAmount: body.outAmount,
      platformFeeBps: body.platformFeeBps,
      commissionApprox: body.commissionApprox,
      txSignature: body.txSignature || '',
    })
    logOperation({
      userId: Number(userId),
      email: body.email || '',
      type: 'swap_completed',
      detail: `Swap ${body.inAmount} → ${body.outAmount} | Comisión ~${body.commissionApprox || ''} | ${body.txSignature ? body.txSignature.slice(0, 12) + '…' : ''}`,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar swap.' })
  }
})

/**
 * Monitor: log de operaciones / actividad reciente.
 */
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

/**
 * Registrar una operación (opcional: el frontend puede llamar para auditar).
 */
app.post('/api/monitor/log-operation', (req, res) => {
  try {
    const body = req.body || {}
    const userId = body.userId ?? body.user_id
    if (userId == null) {
      return res.status(400).json({ error: 'Falta userId.' })
    }
    logOperation({
      userId: Number(userId),
      email: body.email || '',
      type: body.type || 'unknown',
      detail: body.detail ?? null,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar operación.' })
  }
})

// 404: devolver path para depurar si las rutas de balance no coinciden
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.path, method: req.method })
})

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`)
  console.log('Monitor: GET /api/monitor/health, /api/monitor/users-with-balances, /api/monitor/swaps, /api/monitor/operations')
})
