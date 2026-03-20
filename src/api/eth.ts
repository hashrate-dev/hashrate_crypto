/**
 * Balance ETH vía backend (proxy) para evitar CORS. Fallback directo si backend no está.
 */

export interface EthBalanceResult {
  balanceEth: string
}

/** Obtener balance nativo ETH (en ETH) de una dirección 0x. */
export async function getEthBalance(walletAddress: string): Promise<EthBalanceResult> {
  const addr = walletAddress?.trim()
  if (!addr || !addr.startsWith('0x')) {
    return { balanceEth: '0' }
  }
  const urls = [
    `/api/eth/balance?address=${encodeURIComponent(addr)}`,
    ...(typeof window !== 'undefined' && window.location?.port === '5174'
      ? [`http://127.0.0.1:3001/api/eth/balance?address=${encodeURIComponent(addr)}`]
      : []),
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url)
      const data = (await res.json().catch(() => ({}))) as { balanceEth?: string; error?: string }
      if (res.ok && typeof data.balanceEth === 'string') return { balanceEth: data.balanceEth }
    } catch {
      continue
    }
  }
  throw new Error('No se pudo conectar a la red Ethereum. Ejecutá "npm run dev".')
}
