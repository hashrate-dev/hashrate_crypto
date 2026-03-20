/**
 * Saldo SOL: vía backend (proxy a la red Solana). En dev: proxy Vite o :3001; en prod: VITE_API_URL.
 */

import { apiUrlCandidates } from '../lib/apiBase'

export interface SolBalanceResult {
  balanceSol: string
}

const SOLANA_BALANCE_PATH = '/api/solana/balance'

function getSolanaBalanceUrls(addr: string): string[] {
  const q = `?address=${encodeURIComponent(addr)}`
  return apiUrlCandidates(`${SOLANA_BALANCE_PATH}${q}`)
}

/** Obtiene el balance SOL de una dirección (base58) desde la red Solana vía nuestro backend. */
export async function getSolAddressBalance(solAddress: string): Promise<SolBalanceResult> {
  const addr = solAddress?.trim()
  if (!addr) {
    return { balanceSol: '0' }
  }

  const urls = getSolanaBalanceUrls(addr)
  let lastRes: Response | null = null
  let lastData: { balanceSol?: string; error?: string } = {}

  for (const url of urls) {
    try {
      const res = await fetch(url)
      lastRes = res
      lastData = (await res.json().catch(() => ({}))) as { balanceSol?: string; error?: string }
      if (res.ok && typeof lastData.balanceSol === 'string') {
        return { balanceSol: lastData.balanceSol }
      }
      if (res.status !== 404) break
    } catch {
      continue
    }
  }

  if (lastRes?.status === 404) {
    throw new Error('Backend sin ruta Solana. Ejecutá "npm run dev" y asegurate que el servidor esté en el puerto 3001.')
  }
  if (lastRes?.status === 502 || (lastRes && !lastRes.ok)) {
    throw new Error(lastData.error || 'No se pudo conectar con la red de Solana.')
  }
  throw new Error(lastData.error || 'Error al consultar balance SOL.')
}
