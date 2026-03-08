/**
 * Saldo Dogecoin vía BlockCypher (red principal).
 * 1 DOGE = 100_000_000 unidades; la API devuelve balance en unidades.
 */

const BLOCKCYPHER_BASE = 'https://api.blockcypher.com/v1/doge/main'
const CORS_PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
]

export interface DogeBalanceResult {
  balanceDoge: string
}

export async function getAddressBalance(dogeAddress: string): Promise<DogeBalanceResult> {
  if (!dogeAddress?.trim()) {
    return { balanceDoge: '0' }
  }
  const url = `${BLOCKCYPHER_BASE}/addrs/${encodeURIComponent(dogeAddress.trim())}/balance`
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy(url))
      if (!res.ok) continue
      const data = (await res.json()) as { balance?: number; unconfirmed_balance?: number }
      const total = (data.balance ?? 0) + (data.unconfirmed_balance ?? 0)
      const doge = total / 100_000_000
      return { balanceDoge: doge.toFixed(8) }
    } catch {
      /* siguiente proxy */
    }
  }
  throw new Error('No se pudo conectar con la red de Dogecoin.')
}
