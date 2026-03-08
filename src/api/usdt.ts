/**
 * USDT (Tether) en Ethereum (ERC-20).
 * Consulta de balance vía eth_call a la red Ethereum (RPC público).
 * Contrato USDT mainnet: 0xdAC17F958D2ee523a2206206994597C13D831ec7 (6 decimales).
 */

const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const USDT_DECIMALS = 6

const ETH_RPC_URLS = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
]

/** Selector de balanceOf(address): 0x70a08231 + address en 32 bytes. */
function encodeBalanceOf(address: string): string {
  const addr = address.startsWith('0x') ? address.slice(2) : address
  const padded = addr.padStart(64, '0').toLowerCase()
  return '0x70a08231' + padded
}

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

/** Obtener balance USDT de una dirección (ERC-20 en Ethereum). */
export async function getUsdtBalance(walletAddress: string): Promise<{
  balanceRaw: string
  balanceUsdt: string
}> {
  const data = encodeBalanceOf(walletAddress)
  let lastError: Error | null = null
  for (const baseUrl of ETH_RPC_URLS) {
    try {
      const result = await rpcCall(baseUrl, 'eth_call', [
        {
          to: USDT_CONTRACT,
          data,
        },
        'latest',
      ])
      const hex = typeof result === 'string' ? result : ''
      if (!hex || hex === '0x') {
        return { balanceRaw: '0', balanceUsdt: '0.00' }
      }
      const raw = BigInt(hex).toString()
      const value = Number(raw) / 10 ** USDT_DECIMALS
      const balanceUsdt = value.toFixed(2)
      return { balanceRaw: raw, balanceUsdt }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastError ?? new Error('No se pudo conectar a la red Ethereum')
}
