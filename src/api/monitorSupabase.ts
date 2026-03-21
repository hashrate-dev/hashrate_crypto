/**
 * Monitor (solo perfiles con is_admin = true). Requiere migración SQL y marcar admin:
 * update public.profiles set is_admin = true where email = 'tu@email.com';
 */
import { getSupabase } from '../lib/supabaseClient'
import { profileRowToUser, type ProfileRow } from './profileMapper'
import type {
  AccessLogEntry,
  BalanceSnapshotEntry,
  MonitorUser,
  MonitorUserWithBalances,
  OperationLogEntry,
  SwapConfig,
  SwapLogEntry,
} from './monitor'

function sb() {
  return getSupabase()
}

export async function getMonitorUsersWithBalances(): Promise<MonitorUserWithBalances[]> {
  const s = sb()
  const { data: profiles, error: pe } = await s.from('profiles').select('*').order('created_at', { ascending: false })
  if (pe) throw new Error(pe.message || 'Sin permiso de monitor (¿is_admin en SQL?)')
  const { data: snaps, error: se } = await s.from('balance_snapshots').select('*')
  if (se) throw new Error(se.message)
  const snapByNum = new Map<number, (typeof snaps)[0]>()
  for (const row of snaps ?? []) {
    snapByNum.set(Number(row.user_numeric_id), row)
  }
  return (profiles ?? []).map((p) => {
    const row = p as ProfileRow
    const u = profileRowToUser(row)
    const snap = snapByNum.get(Number(row.numeric_id))
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      secondName: u.secondName,
      firstSurname: u.firstSurname,
      secondSurname: u.secondSurname,
      createdAt: u.createdAt,
      balances: (snap?.balances as Record<string, string>) ?? {},
      totalUsd: snap?.total_usd != null ? String(snap.total_usd) : '0',
    }
  })
}

export async function getMonitorUsers(): Promise<MonitorUser[]> {
  const s = sb()
  const { data, error } = await s.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Sin permiso de monitor')
  return (data ?? []).map((p) => {
    const u = profileRowToUser(p as ProfileRow)
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      secondName: u.secondName,
      firstSurname: u.firstSurname,
      secondSurname: u.secondSurname,
      createdAt: u.createdAt,
    }
  })
}

export async function getAccessLog(limit = 200): Promise<AccessLogEntry[]> {
  const s = sb()
  const { data, error } = await s
    .from('access_log')
    .select('*')
    .order('at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    user_id: Number(r.user_numeric_id),
    email: r.email ?? '',
    first_name: r.first_name ?? null,
    first_surname: r.first_surname ?? null,
    at: r.at,
  }))
}

export async function getBalanceSnapshots(): Promise<BalanceSnapshotEntry[]> {
  const s = sb()
  const { data, error } = await s.from('balance_snapshots').select('*')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    userId: Number(r.user_numeric_id),
    email: r.email ?? '',
    totalUsd: String(r.total_usd ?? '0'),
    balances: (r.balances as Record<string, string>) ?? {},
    at: r.at,
  }))
}

export async function postBalanceSnapshot(entry: {
  userId: number
  email: string
  totalUsd: string | number
  balances: Record<string, string>
}): Promise<void> {
  const s = sb()
  const { error } = await s.from('balance_snapshots').upsert(
    {
      user_numeric_id: entry.userId,
      email: entry.email,
      total_usd: String(entry.totalUsd),
      balances: entry.balances,
      at: new Date().toISOString(),
    },
    { onConflict: 'user_numeric_id' }
  )
  if (error) throw new Error(error.message)
}

export async function getMonitorSwapConfig(): Promise<SwapConfig> {
  const s = sb()
  const { data, error } = await s.from('swap_settings').select('*').eq('id', 1).single()
  if (error || !data) {
    return { platformFeeBps: 20, feeWallet: '', slippageBps: 50 }
  }
  return {
    platformFeeBps: Number(data.platform_fee_bps) ?? 20,
    feeWallet: data.fee_wallet ?? '',
    slippageBps: Number(data.slippage_bps) ?? 50,
  }
}

export async function updateMonitorSwapConfig(updates: Partial<SwapConfig>): Promise<SwapConfig> {
  const s = sb()
  const patch: Record<string, unknown> = {}
  if (updates.platformFeeBps != null) patch.platform_fee_bps = updates.platformFeeBps
  if (updates.feeWallet != null) patch.fee_wallet = updates.feeWallet
  if (updates.slippageBps != null) patch.slippage_bps = updates.slippageBps
  const { data, error } = await s.from('swap_settings').update(patch).eq('id', 1).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'Error al guardar')
  return {
    platformFeeBps: Number(data.platform_fee_bps) ?? 20,
    feeWallet: data.fee_wallet ?? '',
    slippageBps: Number(data.slippage_bps) ?? 50,
  }
}

export async function getMonitorSwaps(limit = 200): Promise<SwapLogEntry[]> {
  const s = sb()
  const { data, error } = await s.from('swap_log').select('*').order('at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    user_id: Number(r.user_numeric_id),
    email: r.email ?? '',
    input_mint: r.input_mint ?? '',
    output_mint: r.output_mint ?? '',
    in_amount: r.in_amount ?? '',
    out_amount: r.out_amount ?? '',
    platform_fee_bps: Number(r.platform_fee_bps) ?? 0,
    commission_approx: r.commission_approx ?? '',
    tx_signature: r.tx_signature ?? '',
    at: r.at,
  }))
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
  const s = sb()
  const { error } = await s.from('swap_log').insert({
    user_numeric_id: entry.userId,
    email: entry.email,
    input_mint: entry.inputMint,
    output_mint: entry.outputMint,
    in_amount: entry.inAmount,
    out_amount: entry.outAmount,
    platform_fee_bps: entry.platformFeeBps,
    commission_approx: entry.commissionApprox,
    tx_signature: entry.txSignature,
  })
  if (error) throw new Error(error.message)
}

export async function getMonitorOperations(limit = 300): Promise<OperationLogEntry[]> {
  const s = sb()
  const { data, error } = await s.from('operations_log').select('*').order('at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    user_id: Number(r.user_numeric_id),
    email: r.email ?? '',
    type: r.type ?? '',
    detail: r.detail ?? null,
    at: r.at,
  }))
}

export async function logMonitorOperation(entry: {
  userId: number
  email: string
  type: string
  detail?: string | null
}): Promise<void> {
  const s = sb()
  const { error } = await s.from('operations_log').insert({
    user_numeric_id: entry.userId,
    email: entry.email,
    type: entry.type,
    detail: entry.detail ?? null,
  })
  if (error) throw new Error(error.message)
}
