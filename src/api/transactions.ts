import type { Transaction } from '../store/wallet'
import { apiUrl } from '../lib/apiBase'

function mapBtcRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id ?? ''),
    type: row.type === 'receive' ? 'receive' : 'send',
    asset: 'btc',
    amount: String(row.amount ?? '0'),
    amountUsd: row.amountUsd != null ? String(row.amountUsd) : undefined,
    counterparty: String(row.counterparty ?? '—'),
    timestamp: Number(row.timestamp) || 0,
    status: (row.status === 'pending' ? 'pending' : row.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'pending' | 'failed',
    txHash: row.txHash != null ? String(row.txHash) : undefined,
    isLightning: false,
  }
}

function mapSolRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id ?? ''),
    type: row.type === 'receive' ? 'receive' : 'send',
    asset: 'sol',
    amount: String(row.amount ?? '0'),
    amountUsd: row.amountUsd != null ? String(row.amountUsd) : undefined,
    counterparty: String(row.counterparty ?? '—'),
    timestamp: Number(row.timestamp) || 0,
    status: (row.status === 'pending' ? 'pending' : row.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'pending' | 'failed',
    txHash: row.txHash != null ? String(row.txHash) : undefined,
    isLightning: false,
  }
}

function mapDogeRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id ?? ''),
    type: row.type === 'receive' ? 'receive' : 'send',
    asset: 'doge',
    amount: String(row.amount ?? '0'),
    amountUsd: row.amountUsd != null ? String(row.amountUsd) : undefined,
    counterparty: String(row.counterparty ?? '—'),
    timestamp: Number(row.timestamp) || 0,
    status: (row.status === 'pending' ? 'pending' : row.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'pending' | 'failed',
    txHash: row.txHash != null ? String(row.txHash) : undefined,
    isLightning: false,
  }
}

function mapLtcRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id ?? ''),
    type: row.type === 'receive' ? 'receive' : 'send',
    asset: 'ltc',
    amount: String(row.amount ?? '0'),
    amountUsd: row.amountUsd != null ? String(row.amountUsd) : undefined,
    counterparty: String(row.counterparty ?? '—'),
    timestamp: Number(row.timestamp) || 0,
    status: (row.status === 'pending' ? 'pending' : row.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'pending' | 'failed',
    txHash: row.txHash != null ? String(row.txHash) : undefined,
    isLightning: false,
  }
}

function mapEthRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id ?? ''),
    type: row.type === 'receive' ? 'receive' : 'send',
    asset: 'eth',
    amount: String(row.amount ?? '0'),
    amountUsd: row.amountUsd != null ? String(row.amountUsd) : undefined,
    counterparty: String(row.counterparty ?? '—'),
    timestamp: Number(row.timestamp) || 0,
    status: (row.status === 'pending' ? 'pending' : row.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'pending' | 'failed',
    txHash: row.txHash != null ? String(row.txHash) : undefined,
    isLightning: false,
  }
}

/** Transacciones Bitcoin reales de la dirección (mempool.space vía backend). */
export async function fetchBtcTransactions(address: string): Promise<Transaction[]> {
  if (!address || address.length < 26) return []
  const url = apiUrl(`/api/btc/transactions?address=${encodeURIComponent(address)}`)
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((row: Record<string, unknown>) => mapBtcRow(row))
  } catch {
    return []
  }
}

/** Transacciones SOL = misma fuente que Orb Transfers (Helius). address = dirección Solana de la wallet del usuario (por frase semilla). */
export async function fetchSolTransactions(address: string): Promise<Transaction[]> {
  if (!address || address.length < 32 || address.length > 44) return []
  const url = apiUrl(`/api/solana/transactions?address=${encodeURIComponent(address)}`)
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((row: Record<string, unknown>) => mapSolRow(row))
  } catch {
    return []
  }
}

/** Transacciones Dogecoin de la dirección (BlockCypher). */
export async function fetchDogeTransactions(address: string): Promise<Transaction[]> {
  if (!address || address.length < 26) return []
  try {
    const res = await fetch(apiUrl(`/api/doge/transactions?address=${encodeURIComponent(address)}`))
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((row: Record<string, unknown>) => mapDogeRow(row))
  } catch {
    return []
  }
}

/** Transacciones Litecoin de la dirección (BlockCypher). */
export async function fetchLtcTransactions(address: string): Promise<Transaction[]> {
  if (!address || address.length < 26) return []
  try {
    const res = await fetch(apiUrl(`/api/ltc/transactions?address=${encodeURIComponent(address)}`))
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((row: Record<string, unknown>) => mapLtcRow(row))
  } catch {
    return []
  }
}

/** Transacciones Ethereum de la dirección (Etherscan). Opcional ETHERSCAN_API_KEY en backend. */
export async function fetchEthTransactions(address: string): Promise<Transaction[]> {
  if (!address || address.length !== 42 || !address.startsWith('0x')) return []
  try {
    const res = await fetch(apiUrl(`/api/eth/transactions?address=${encodeURIComponent(address)}`))
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map((row: Record<string, unknown>) => mapEthRow(row))
  } catch {
    return []
  }
}
