/**
 * Precios: solo Binance (vía proxy CORS).
 */

import { apiUrlCandidates } from '../lib/apiBase'

const BINANCE_BASE = 'https://api.binance.com/api/v3'

const CORS_PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
]

/** Temporalidades de Binance (intervalos del gráfico). */
export type ChartRange = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M'

/** Descripción por rango para el pie del gráfico. */
export const CHART_RANGE_DAYS: Record<ChartRange, number> = {
  '1m': 0,
  '5m': 0,
  '15m': 0,
  '30m': 0,
  '1h': 0,
  '4h': 0,
  '1d': 1,
  '1w': 7,
  '1M': 30,
}

/** Intervalo y límite Binance. 1m/5m/15m con menos puntos = respuesta más rápida. */
const BINANCE_PARAMS: Record<ChartRange, { interval: string; limit: number }> = {
  '1m': { interval: '1m', limit: 30 },
  '5m': { interval: '5m', limit: 30 },
  '15m': { interval: '15m', limit: 24 },
  '30m': { interval: '30m', limit: 48 },
  '1h': { interval: '1h', limit: 48 },
  '4h': { interval: '4h', limit: 45 },
  '1d': { interval: '1d', limit: 24 },
  '1w': { interval: '1w', limit: 7 },
  '1M': { interval: '1M', limit: 12 },
}

/** Símbolo Binance por activo: BTC/Lightning = BTCUSDT, USDT = USDCUSDT, DOGE = DOGEUSDT, LTC = LTCUSDT, ETH = ETHUSDT. */
function getBinanceSymbol(assetId: string): string {
  if (assetId === 'usdt') return 'USDCUSDT'
  if (assetId === 'doge') return 'DOGEUSDT'
  if (assetId === 'ltc') return 'LTCUSDT'
  if (assetId === 'eth') return 'ETHUSDT'
  if (assetId === 'sol') return 'SOLUSDT'
  return 'BTCUSDT'
}

const PRICE_API = '/api/binance/price'
const PRICES_API = '/api/binance/prices'
const PRICE_TIMEOUT_MS = 6000

/** URLs para precios: una sola llamada que devuelve todos (misma fuente que Bitcoin). */
function getPricesApiUrls(): string[] {
  return apiUrlCandidates(PRICES_API)
}

function withPriceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

/** Precio actual: solo Binance. Backend (precio único o batch), luego proxies CORS. */
export async function fetchCurrentPrice(assetId: string): Promise<number> {
  const run = async (): Promise<number> => {
    const singleUrls = apiUrlCandidates(`${PRICE_API}?asset=${encodeURIComponent(assetId)}`)
    for (const url of singleUrls) {
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const data = (await res.json()) as { price?: string }
        const p = Number(data?.price)
        if (Number.isFinite(p)) return p
      } catch {
        /* siguiente */
      }
    }
    const batchUrls = apiUrlCandidates(PRICES_API)
    for (const url of batchUrls) {
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const data = (await res.json()) as Record<string, number>
        const p = data[assetId] != null ? Number(data[assetId]) : NaN
        if (Number.isFinite(p) && p > 0) return p
      } catch {
        /* siguiente */
      }
    }
    const symbol = getBinanceSymbol(assetId)
    for (const proxy of CORS_PROXIES) {
      try {
        const url = `${BINANCE_BASE}/ticker/price?symbol=${symbol}`
        const res = await fetch(proxy(url))
        if (!res.ok) continue
        const text = await res.text()
        const data = JSON.parse(text) as { price?: string }
        const p = Number(data?.price)
        if (Number.isFinite(p)) return p
      } catch {
        /* siguiente proxy */
      }
    }
    return 0
  }
  return withPriceTimeout(run(), PRICE_TIMEOUT_MS).catch(() => 0)
}


/** Reducir a máximo maxPoints para que el gráfico no sea pesado. */
function samplePrices(prices: number[], maxPoints: number): number[] {
  if (prices.length <= maxPoints) return prices
  const step = (prices.length - 1) / (maxPoints - 1)
  const out: number[] = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), prices.length - 1)
    out.push(prices[idx])
  }
  return out
}

/** Intenta un proxy y devuelve precios o rechaza. */
function fetchBinanceViaProxy(proxyUrl: string): Promise<number[]> {
  return fetch(proxyUrl)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status))
      return res.text()
    })
    .then((text) => {
      const data = JSON.parse(text) as unknown
      if (!Array.isArray(data)) throw new Error('Invalid data')
      const prices = (data as [number, string, string, string, string, string, ...unknown[]][])
        .map((c) => Number(c[4]))
        .filter((p): p is number => typeof p === 'number' && Number.isFinite(p))
      if (prices.length === 0) throw new Error('Empty')
      return prices
    })
}

const BINANCE_KLINES_TIMEOUT_MS = 8000

/** Timeout: evita que se cuelgue si los proxies no responden. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout')), ms)
    p.then((r) => {
      clearTimeout(t)
      resolve(r)
    }, (e) => {
      clearTimeout(t)
      reject(e)
    })
  })
}

/** Klines Binance: proxies en paralelo, el que responde primero gana. Timeout para no colgar. */
async function fetchBinanceKlines(symbol: string, range: ChartRange): Promise<number[]> {
  const { interval, limit } = BINANCE_PARAMS[range]
  const targetUrl = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const tryProxies = async (): Promise<number[]> => {
    const promises = CORS_PROXIES.map((proxy) => fetchBinanceViaProxy(proxy(targetUrl)))
    try {
      return await Promise.race(promises)
    } catch {
      const results = await Promise.allSettled(promises)
      const ok = results.find((r) => r.status === 'fulfilled' && r.value.length > 0)
      if (ok && ok.status === 'fulfilled') return ok.value
      throw new Error('Binance: sin respuesta')
    }
  }
  return withTimeout(tryProxies(), BINANCE_KLINES_TIMEOUT_MS)
}

const MAX_POINTS = 80

/** Cache por (assetId, range) para mostrar al instante al cambiar de temporalidad. */
const chartCache = new Map<string, number[]>()

function chartCacheKey(assetId: string, range: ChartRange): string {
  return `${assetId}|${range}`
}

/** Datos del gráfico: solo Binance. */
async function fetchChartFromBinance(assetId: string, range: ChartRange): Promise<number[]> {
  const symbol = getBinanceSymbol(assetId)
  const prices = await fetchBinanceKlines(symbol, range)
  if (prices.length === 0) return []
  return samplePrices(prices, MAX_POINTS)
}

/** Historial: solo Binance, con caché. */
export async function fetchMarketChartByRange(
  assetId: string,
  range: ChartRange
): Promise<number[]> {
  const key = chartCacheKey(assetId, range)
  const cached = chartCache.get(key)
  if (cached && cached.length > 0) {
    void fetchChartFromBinance(assetId, range).then((data) => {
      if (data.length > 0) chartCache.set(key, data)
    })
    return cached
  }
  const data = await fetchChartFromBinance(assetId, range).catch(() => [])
  if (data.length > 0) chartCache.set(key, data)
  return data
}

const SPARKLINE_POINTS = 32

/** Precios para sparklines: solo Binance. */
export async function fetchBitcoinPrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('BTCUSDT', '1h')
    return prices.length > 0 ? samplePrices(prices, SPARKLINE_POINTS) : []
  } catch {
    return []
  }
}

export async function fetchUsdtPrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('USDCUSDT', '1h')
    return prices.length > 0 ? samplePrices(prices, SPARKLINE_POINTS) : []
  } catch {
    return []
  }
}

export async function fetchDogePrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('DOGEUSDT', '1h')
    return prices.length > 0 ? samplePrices(prices, SPARKLINE_POINTS) : []
  } catch {
    return []
  }
}

export async function fetchLtcPrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('LTCUSDT', '1h')
    return prices.length > 0 ? samplePrices(prices, SPARKLINE_POINTS) : []
  } catch {
    return []
  }
}

export async function fetchEthPrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('ETHUSDT', '1h')
    return prices.length > 0 ? samplePrices(prices, SPARKLINE_POINTS) : []
  } catch {
    return []
  }
}

export async function fetchSolPrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('SOLUSDT', '1h')
    return prices.length > 0 ? samplePrices(prices, SPARKLINE_POINTS) : []
  } catch {
    return []
  }
}

export type AssetChartData = {
  btc: number[]
  btc_lightning: number[]
  usdt: number[]
  doge: number[]
  ltc: number[]
  eth: number[]
  sol: number[]
}

export type CurrentPrices = {
  btc: number
  usdt: number
  doge: number
  ltc: number
  eth: number
  sol: number
}

export type AssetChartsResult = {
  chartData: AssetChartData
  currentPrices: CurrentPrices
}

const CACHE_MS = 60_000
let cache: { data: AssetChartsResult; ts: number } | null = null

/** Precio o fallback al último del sparkline si el backend devuelve 0. */
function priceOrFallback(price: number, sparkline: number[]): number {
  if (price > 0) return price
  return sparkline.length > 0 ? sparkline[sparkline.length - 1] : 0
}

/** Todos los precios en una llamada al backend (misma fuente que Bitcoin: Binance ticker/price). */
async function fetchAllPricesFromBackend(): Promise<CurrentPrices | null> {
  for (const url of getPricesApiUrls()) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = (await res.json()) as Record<string, number>
      const btc = Number(data.btc)
      const usdt = Number(data.usdt)
      const doge = Number(data.doge)
      const ltc = Number(data.ltc)
      const eth = Number(data.eth)
      const sol = Number(data.sol)
      if (Number.isFinite(btc) || Number.isFinite(usdt)) {
        return {
          btc: Number.isFinite(btc) ? btc : 0,
          usdt: Number.isFinite(usdt) ? usdt : 0,
          doge: Number.isFinite(doge) ? doge : 0,
          ltc: Number.isFinite(ltc) ? ltc : 0,
          eth: Number.isFinite(eth) ? eth : 0,
          sol: Number.isFinite(sol) ? sol : 0,
        }
      }
    } catch {
      /* siguiente URL */
    }
  }
  return null
}

/** Solo precios actuales desde backend (Binance). Rápido para mostrar la lista enseguida. */
const PRICES_ONLY_TIMEOUT_MS = 4000

export async function fetchPricesFromBackendOnly(): Promise<CurrentPrices> {
  const result = await withPriceTimeout(fetchAllPricesFromBackend(), PRICES_ONLY_TIMEOUT_MS).catch(() => null)
  if (result) return result
  return { btc: 0, usdt: 0, doge: 0, ltc: 0, eth: 0, sol: 0 }
}

/** Lista Mercado: todas las monedas con el mismo precio que Bitcoin (backend Binance). Fallback a sparkline si falla. */
export async function fetchAllAssetCharts(): Promise<AssetChartsResult> {
  if (cache && Date.now() - cache.ts < CACHE_MS) return cache.data
  const [chartResult, allPrices] = await Promise.all([
    Promise.all([
      fetchBitcoinPrices(),
      fetchUsdtPrices(),
      fetchDogePrices(),
      fetchLtcPrices(),
      fetchEthPrices(),
      fetchSolPrices(),
    ]),
    withPriceTimeout(fetchAllPricesFromBackend(), PRICE_TIMEOUT_MS).catch(() => null),
  ])
  const [btcPrices, usdtPrices, dogePrices, ltcPrices, ethPrices, solPrices] = chartResult
  const chartData: AssetChartData = {
    btc: btcPrices,
    btc_lightning: btcPrices,
    usdt: usdtPrices,
    doge: dogePrices,
    ltc: ltcPrices,
    eth: ethPrices,
    sol: solPrices,
  }
  let currentPrices: CurrentPrices
  if (allPrices) {
    currentPrices = {
      btc: priceOrFallback(allPrices.btc, btcPrices),
      usdt: priceOrFallback(allPrices.usdt, usdtPrices),
      doge: priceOrFallback(allPrices.doge, dogePrices),
      ltc: priceOrFallback(allPrices.ltc, ltcPrices),
      eth: priceOrFallback(allPrices.eth, ethPrices),
      sol: priceOrFallback(allPrices.sol, solPrices),
    }
  } else {
    const [btcP, usdtP, dogeP, ltcP, ethP, solP] = await Promise.all([
      fetchCurrentPrice('btc'),
      fetchCurrentPrice('usdt'),
      fetchCurrentPrice('doge'),
      fetchCurrentPrice('ltc'),
      fetchCurrentPrice('eth'),
      fetchCurrentPrice('sol'),
    ])
    currentPrices = {
      btc: priceOrFallback(btcP, btcPrices),
      usdt: priceOrFallback(usdtP, usdtPrices),
      doge: priceOrFallback(dogeP, dogePrices),
      ltc: priceOrFallback(ltcP, ltcPrices),
      eth: priceOrFallback(ethP, ethPrices),
      sol: priceOrFallback(solP, solPrices),
    }
  }
  cache = { data: { chartData, currentPrices }, ts: Date.now() }
  return cache.data
}
