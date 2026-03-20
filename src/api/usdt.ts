/**
 * USDT (ERC-20) vía backend (proxy) para evitar CORS.
 */

import { apiUrlCandidates } from '../lib/apiBase'

/** Obtener balance USDT de una dirección (ERC-20 en Ethereum). */
export async function getUsdtBalance(walletAddress: string): Promise<{
  balanceRaw: string
  balanceUsdt: string
}> {
  const addr = walletAddress?.trim()
  if (!addr || !addr.startsWith('0x')) {
    return { balanceRaw: '0', balanceUsdt: '0.00' }
  }
  const urls = apiUrlCandidates(`/api/usdt/balance?address=${encodeURIComponent(addr)}`)
  for (const url of urls) {
    try {
      const res = await fetch(url)
      const data = (await res.json().catch(() => ({}))) as {
        balanceUsdt?: string
        balanceRaw?: string
        error?: string
      }
      if (res.ok && data.balanceUsdt != null) {
        return {
          balanceRaw: data.balanceRaw ?? '0',
          balanceUsdt: data.balanceUsdt ?? '0.00',
        }
      }
    } catch {
      continue
    }
  }
  throw new Error('No se pudo conectar a la red Ethereum. Ejecutá "npm run dev".')
}
