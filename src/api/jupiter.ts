/**
 * Jupiter Swap (Solana): quote y swap vía backend. La comisión se envía a la wallet configurada en el servidor.
 */

const API_BASE = ''

export interface JupiterQuoteResponse {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  priceImpactPct?: string
  routePlan?: unknown[]
  [key: string]: unknown
}

export interface JupiterSwapResponse {
  swapTransaction: string
  lastValidBlockHeight: number
  prioritizationFeeLamports?: number
}

/** Obtiene cotización de swap (con comisión de plataforma incluida). amount = raw en atomic units (ej. lamports para SOL). Si no se pasa slippageBps, el backend usa el configurado en el monitor. */
export async function getJupiterQuote(params: {
  inputMint: string
  outputMint: string
  amount: string
  slippageBps?: number
}): Promise<JupiterQuoteResponse> {
  const q = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
  })
  if (params.slippageBps != null) q.set('slippageBps', String(params.slippageBps))
  const res = await fetch(`${API_BASE}/api/jupiter/quote?${q}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || 'Error al obtener cotización')
  }
  return res.json()
}

/** Obtiene la transacción de swap (serializada en base64) para firmar y enviar. */
export async function getJupiterSwapTransaction(params: {
  quoteResponse: JupiterQuoteResponse
  userPublicKey: string
}): Promise<JupiterSwapResponse> {
  const res = await fetch(`${API_BASE}/api/jupiter/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || 'Error al construir swap')
  }
  return res.json()
}

/** Envía la transacción firmada (base64) a la red Solana vía backend. */
export async function sendSolanaTransaction(signedTransactionBase64: string): Promise<{ signature: string }> {
  const res = await fetch(`${API_BASE}/api/solana/send-transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction: signedTransactionBase64 }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || 'Error al enviar transacción')
  }
  return res.json()
}
