const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3001'
  : (typeof import.meta.env?.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '')

/**
 * Obtiene un comentario de análisis de mercado generado por IA.
 * El servidor debe tener OPENAI_API_KEY configurado.
 */
export async function fetchMarketAnalysis(
  assetId: string,
  options?: { price?: number; change24h?: number }
): Promise<{ analysis: string }> {
  const params = new URLSearchParams()
  if (options?.price != null && options.price > 0) params.set('price', String(options.price))
  if (options?.change24h != null && !Number.isNaN(options.change24h)) params.set('change24h', String(options.change24h))
  const qs = params.toString()
  const url = `${API_BASE}/api/market-analysis/${encodeURIComponent(assetId)}${qs ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Error ${res.status}`)
  }
  return res.json()
}
