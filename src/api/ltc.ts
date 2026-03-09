/**
 * Saldo Litecoin vía BlockCypher (red principal).
 * 1 LTC = 100_000_000 unidades; la API devuelve balance en unidades.
 */

const BLOCKCYPHER_BASE = 'https://api.blockcypher.com/v1/ltc/main'
const CORS_PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
]

export interface LtcBalanceResult {
  balanceLtc: string
}

export async function getLtcAddressBalance(ltcAddress: string): Promise<LtcBalanceResult> {
  if (!ltcAddress?.trim()) {
    return { balanceLtc: '0' }
  }
  const url = `${BLOCKCYPHER_BASE}/addrs/${encodeURIComponent(ltcAddress.trim())}/balance`
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy(url))
      if (!res.ok) continue
      const data = (await res.json()) as { balance?: number; unconfirmed_balance?: number }
      const total = (data.balance ?? 0) + (data.unconfirmed_balance ?? 0)
      const ltc = total / 100_000_000
      return { balanceLtc: ltc.toFixed(8) }
    } catch {
      /* siguiente proxy */
    }
  }
  throw new Error('No se pudo conectar con la red de Litecoin.')
}
