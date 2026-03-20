/**
 * Saldo SOL: vía backend (proxy a la red Solana). Prueba /api (proxy Vite) y luego backend directo :3001.
 */

export interface SolBalanceResult {
  balanceSol: string
}

const SOLANA_BALANCE_PATH = '/api/solana/balance'

/** URLs a probar: primero relativo (proxy), luego backend directo por si el proxy no reenvía. */
function getSolanaBalanceUrls(addr: string): string[] {
  const q = `?address=${encodeURIComponent(addr)}`
  const base = typeof window !== 'undefined' && window.location?.port === '5174'
    ? 'http://127.0.0.1:3001'
    : ''
  return [`${SOLANA_BALANCE_PATH}${q}`, base ? `${base}${SOLANA_BALANCE_PATH}${q}` : ''].filter(Boolean)
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
