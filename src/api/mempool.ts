/**
 * API de Mempool.space para Bitcoin (red principal).
 * Usado para: balance on-chain, comisiones recomendadas y broadcast de transacciones.
 * Lightning: Mempool ofrece datos de la red (nodos/canales); para balance y pagos Lightning
 * haría falta conectar a un nodo (ej. LND) o servicio custodial.
 */

const MEMPOOL_BASE = 'https://mempool.space/api'

export interface MempoolAddressResponse {
  address: string
  chain_stats: {
    funded_txo_sum: number
    spent_txo_sum: number
    tx_count: number
  }
  mempool_stats: {
    funded_txo_sum: number
    spent_txo_sum: number
  }
}

export interface MempoolFeesRecommended {
  fastestFee: number
  halfHourFee: number
  hourFee: number
  economyFee: number
  minimumFee: number
}

/** Balance de una dirección en satoshis (confirmado + sin confirmar). */
export async function getAddressBalance(address: string): Promise<{
  balanceSats: number
  balanceBtc: string
  unconfirmedSats: number
}> {
  const res = await fetch(`${MEMPOOL_BASE}/address/${encodeURIComponent(address)}`)
  if (!res.ok) throw new Error(`Mempool: ${res.status} ${res.statusText}`)
  const data: MempoolAddressResponse = await res.json()
  const confirmed = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
  const unconfirmed =
    data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum
  const balanceSats = confirmed + unconfirmed
  const balanceBtc = (balanceSats / 100_000_000).toFixed(8)
  return { balanceSats, balanceBtc, unconfirmedSats: unconfirmed }
}

/** Comisiones recomendadas (sat/vB). */
export async function getRecommendedFees(): Promise<MempoolFeesRecommended> {
  const res = await fetch(`${MEMPOOL_BASE}/v1/fees/recommended`)
  if (!res.ok) throw new Error(`Mempool fees: ${res.status}`)
  return res.json()
}

/** Transmitir transacción en hex. Devuelve txid o lanza. */
export async function broadcastTx(txHex: string): Promise<string> {
  const res = await fetch(`${MEMPOOL_BASE}/tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: txHex,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Mempool broadcast: ${res.status}`)
  }
  return res.text()
}

/** UTXOs de una dirección (para construir transacciones). */
export interface MempoolUtxo {
  txid: string
  vout: number
  value: number
  status: { confirmed: boolean }
}

export async function getAddressUtxos(address: string): Promise<MempoolUtxo[]> {
  const res = await fetch(`${MEMPOOL_BASE}/address/${encodeURIComponent(address)}/utxo`)
  if (!res.ok) throw new Error(`Mempool UTXOs: ${res.status}`)
  return res.json()
}
