/**
 * Balance nativo de ETH (Ethereum) vía RPC público.
 * 1 ETH = 10^18 wei.
 */

const ETH_RPC_URLS = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
]

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`RPC ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'RPC error')
  return data.result
}

export interface EthBalanceResult {
  balanceEth: string
}

/** Obtener balance nativo ETH (en ETH) de una dirección 0x. */
export async function getEthBalance(walletAddress: string): Promise<EthBalanceResult> {
  if (!walletAddress?.trim() || !walletAddress.startsWith('0x')) {
    return { balanceEth: '0' }
  }
  let lastError: Error | null = null
  for (const baseUrl of ETH_RPC_URLS) {
    try {
      const result = await rpcCall(baseUrl, 'eth_getBalance', [
        walletAddress.trim(),
        'latest',
      ])
      const hex = typeof result === 'string' ? result : '0x0'
      const wei = BigInt(hex)
      const eth = Number(wei) / 1e18
      return { balanceEth: eth.toFixed(8) }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastError ?? new Error('No se pudo conectar a la red Ethereum')
}
