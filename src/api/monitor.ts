import { apiUrl } from '../lib/apiBase'
import { isSupabaseBackend } from '../lib/backendMode'
import * as msb from './monitorSupabase'

export interface MonitorUser {
  id: number
  email: string
  firstName: string
  secondName: string | null
  firstSurname: string
  secondSurname: string | null
  createdAt: string
}

export interface MonitorUserWithBalances extends MonitorUser {
  balances: Record<string, string>
  totalUsd: string
}

export async function getMonitorUsersWithBalances(): Promise<MonitorUserWithBalances[]> {
  if (isSupabaseBackend()) return msb.getMonitorUsersWithBalances()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90000)
  try {
    const res = await fetch(apiUrl('/api/monitor/users-with-balances'), { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error('Error al cargar usuarios con saldos')
    const data = await res.json()
    return data.users ?? []
  } catch (e) {
    clearTimeout(timeoutId)
    throw e
  }
}

export interface AccessLogEntry {
  user_id: number
  email: string
  first_name: string | null
  first_surname: string | null
  at: string
}

export async function getMonitorUsers(): Promise<MonitorUser[]> {
  if (isSupabaseBackend()) return msb.getMonitorUsers()
  const res = await fetch(apiUrl('/api/monitor/users'))
  if (!res.ok) throw new Error('Error al cargar usuarios')
  const data = await res.json()
  return data.users ?? []
}

export async function getAccessLog(limit = 200): Promise<AccessLogEntry[]> {
  if (isSupabaseBackend()) return msb.getAccessLog(limit)
  const res = await fetch(apiUrl(`/api/monitor/access-log?limit=${limit}`))
  if (!res.ok) throw new Error('Error al cargar histórico de accesos')
  const data = await res.json()
  return data.log ?? []
}

export interface SwapLogEntry {
  user_id: number
  email: string
  input_mint: string
  output_mint: string
  in_amount: string
  out_amount: string
  platform_fee_bps: number
  commission_approx: string
  tx_signature: string
  at: string
}

export interface OperationLogEntry {
  user_id: number
  email: string
  type: string
  detail: string | null
  at: string
}

export interface BalanceSnapshotEntry {
  userId: number
  email: string
  totalUsd: string
  balances: Record<string, string>
  at: string
}

export async function getBalanceSnapshots(): Promise<BalanceSnapshotEntry[]> {
  if (isSupabaseBackend()) return msb.getBalanceSnapshots()
  const res = await fetch(apiUrl('/api/monitor/balance-snapshots'))
  if (!res.ok) throw new Error('Error al cargar snapshots de saldos')
  const data = await res.json()
  return data.snapshots ?? []
}

export async function postBalanceSnapshot(entry: {
  userId: number
  email: string
  totalUsd: string | number
  balances: Record<string, string>
}): Promise<void> {
  if (isSupabaseBackend()) return msb.postBalanceSnapshot(entry)
  const res = await fetch(apiUrl('/api/monitor/balance-snapshot'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error('Error al guardar snapshot')
}

export interface SwapConfig {
  platformFeeBps: number
  feeWallet: string
  slippageBps: number
}

export async function getMonitorSwapConfig(): Promise<SwapConfig> {
  if (isSupabaseBackend()) return msb.getMonitorSwapConfig()
  const res = await fetch(apiUrl('/api/monitor/swap-config'))
  if (!res.ok) throw new Error('Error al cargar configuración Jupiter')
  const data = await res.json()
  return {
    platformFeeBps: Number(data.platformFeeBps) ?? 20,
    feeWallet: data.feeWallet ?? '',
    slippageBps: Number(data.slippageBps) ?? 50,
  }
}

export async function updateMonitorSwapConfig(updates: Partial<SwapConfig>): Promise<SwapConfig> {
  if (isSupabaseBackend()) return msb.updateMonitorSwapConfig(updates)
  const res = await fetch(apiUrl('/api/monitor/swap-config'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Error al guardar configuración')
  const data = await res.json()
  return data
}

export async function getMonitorSwaps(limit = 200): Promise<SwapLogEntry[]> {
  if (isSupabaseBackend()) return msb.getMonitorSwaps(limit)
  const res = await fetch(apiUrl(`/api/monitor/swaps?limit=${limit}`))
  if (!res.ok) throw new Error('Error al cargar swaps')
  const data = await res.json()
  return data.swaps ?? []
}

export async function logMonitorSwap(entry: {
  userId: number
  email: string
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  platformFeeBps: number
  commissionApprox: string
  txSignature: string
}): Promise<void> {
  if (isSupabaseBackend()) return msb.logMonitorSwap(entry)
  const res = await fetch(apiUrl('/api/monitor/log-swap'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error('Error al registrar swap')
}

export async function getMonitorOperations(limit = 300): Promise<OperationLogEntry[]> {
  if (isSupabaseBackend()) return msb.getMonitorOperations(limit)
  const res = await fetch(apiUrl(`/api/monitor/operations?limit=${limit}`))
  if (!res.ok) throw new Error('Error al cargar operaciones')
  const data = await res.json()
  return data.operations ?? []
}

export async function logMonitorOperation(entry: {
  userId: number
  email: string
  type: string
  detail?: string | null
}): Promise<void> {
  if (isSupabaseBackend()) return msb.logMonitorOperation(entry)
  const res = await fetch(apiUrl('/api/monitor/log-operation'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) throw new Error('Error al registrar operación')
}
