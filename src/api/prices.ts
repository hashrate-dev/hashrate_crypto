/**
 * Precios: Binance cuando el proxy responde; CoinGecko como respaldo (sin CORS).
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
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

/** Símbolo Binance por activo: BTC/Lightning = BTCUSDT, USDT = USDCUSDT, DOGE = DOGEUSDT. */
function getBinanceSymbol(assetId: string): string {
  if (assetId === 'usdt') return 'USDCUSDT'
  if (assetId === 'doge') return 'DOGEUSDT'
  return 'BTCUSDT'
}

/** CoinGecko id por activo. */
function getCoinGeckoId(assetId: string): string {
  if (assetId === 'usdt') return 'tether'
  if (assetId === 'doge') return 'dogecoin'
  return 'bitcoin'
}

/** Precio actual de la moneda (no depende de la temporalidad). Binance ticker o CoinGecko. */
export async function fetchCurrentPrice(assetId: string): Promise<number> {
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
  const coinId = getCoinGeckoId(assetId)
  const res = await fetch(
    `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd`
  )
  if (!res.ok) throw new Error('No se pudo obtener el precio')
  const data: Record<string, { usd?: number }> = await res.json()
  const p = data[coinId]?.usd
  if (p != null && Number.isFinite(p)) return p
  return 0
}


/** Días CoinGecko por rango (para fallback cuando Binance falla). */
const COINGECKO_DAYS: Record<ChartRange, number> = {
  '1m': 1,
  '5m': 1,
  '15m': 1,
  '30m': 1,
  '1h': 1,
  '4h': 7,
  '1d': 1,
  '1w': 7,
  '1M': 30,
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

/** CoinGecko market_chart (sin proxy, CORS permitido). */
async function fetchCoinGeckoChart(coinId: string, days: number): Promise<number[]> {
  const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko: ${res.status}`)
  const data: { prices?: [number, number][] } = await res.json()
  const raw = (data.prices ?? []).map(([, p]) => p).filter((p): p is number => Number.isFinite(p))
  return raw
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

/** Timeout: evita que se cuelgue si los proxies no responden; así el race puede usar CoinGecko. */
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

/** Devuelve datos listos para el gráfico desde CoinGecko (rápido, sin proxy). */
async function fetchChartFromCoinGecko(assetId: string, range: ChartRange): Promise<number[]> {
  const coinId = getCoinGeckoId(assetId)
  const days = Math.max(1, COINGECKO_DAYS[range])
  const prices = await fetchCoinGeckoChart(coinId, days)
  if (prices.length === 0) return []
  const slice = days === 1 && prices.length > 24 ? prices.slice(-24) : prices
  return samplePrices(slice, MAX_POINTS)
}

/** Devuelve datos listos desde Binance. */
async function fetchChartFromBinance(assetId: string, range: ChartRange): Promise<number[]> {
  const symbol = getBinanceSymbol(assetId)
  const prices = await fetchBinanceKlines(symbol, range)
  if (prices.length === 0) return []
  return samplePrices(prices, MAX_POINTS)
}

/** El que responda primero gana; si viene vacío se usa el otro. */
async function fetchChartRace(assetId: string, range: ChartRange): Promise<number[]> {
  const b = fetchChartFromBinance(assetId, range).catch(() => [] as number[])
  const c = fetchChartFromCoinGecko(assetId, range).catch(() => [] as number[])
  const winner = await Promise.race([
    b.then((r) => ({ data: r, other: c })),
    c.then((r) => ({ data: r, other: b })),
  ])
  if (winner.data.length > 0) return winner.data
  const other = await winner.other
  return other
}

/** Historial: caché al instante; race Binance vs CoinGecko (Binance primero, CoinGecko respaldo). */
export async function fetchMarketChartByRange(
  assetId: string,
  range: ChartRange
): Promise<number[]> {
  const key = chartCacheKey(assetId, range)
  const cached = chartCache.get(key)
  if (cached && cached.length > 0) {
    void fetchChartRace(assetId, range).then((data) => {
      if (data.length > 0) chartCache.set(key, data)
    })
    return cached
  }
  const data = await fetchChartRace(assetId, range)
  if (data.length > 0) chartCache.set(key, data)
  return data
}

const SPARKLINE_POINTS = 32

/** Precios BTC para sparkline: Binance o CoinGecko. */
export async function fetchBitcoinPrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('BTCUSDT', '1h')
    if (prices.length > 0) return samplePrices(prices, SPARKLINE_POINTS)
  } catch {
    /* sigue a CoinGecko */
  }
  const prices = await fetchCoinGeckoChart('bitcoin', 7)
  if (prices.length === 0) return []
  return samplePrices(prices, SPARKLINE_POINTS)
}

/** Precios USDT para sparkline: Binance o CoinGecko. */
export async function fetchUsdtPrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('USDCUSDT', '1h')
    if (prices.length > 0) return samplePrices(prices, SPARKLINE_POINTS)
  } catch {
    /* sigue a CoinGecko */
  }
  const prices = await fetchCoinGeckoChart('tether', 7)
  if (prices.length === 0) return []
  return samplePrices(prices, SPARKLINE_POINTS)
}

/** Precios Dogecoin para sparkline: Binance o CoinGecko. */
export async function fetchDogePrices(): Promise<number[]> {
  try {
    const prices = await fetchBinanceKlines('DOGEUSDT', '1h')
    if (prices.length > 0) return samplePrices(prices, SPARKLINE_POINTS)
  } catch {
    /* sigue a CoinGecko */
  }
  const prices = await fetchCoinGeckoChart('dogecoin', 7)
  if (prices.length === 0) return []
  return samplePrices(prices, SPARKLINE_POINTS)
}

export type AssetChartData = {
  btc: number[]
  btc_lightning: number[]
  usdt: number[]
  doge: number[]
}

export type CurrentPrices = {
  btc: number
  usdt: number
  doge: number
}

export type AssetChartsResult = {
  chartData: AssetChartData
  currentPrices: CurrentPrices
}

const CACHE_MS = 60_000
let cache: { data: AssetChartsResult; ts: number } | null = null

export async function fetchAllAssetCharts(): Promise<AssetChartsResult> {
  if (cache && Date.now() - cache.ts < CACHE_MS) return cache.data
  const [btcPrices, usdtPrices, dogePrices] = await Promise.all([
    fetchBitcoinPrices(),
    fetchUsdtPrices(),
    fetchDogePrices(),
  ])
  const chartData: AssetChartData = {
    btc: btcPrices,
    btc_lightning: btcPrices,
    usdt: usdtPrices,
    doge: dogePrices,
  }
  const currentPrices: CurrentPrices = {
    btc: btcPrices.length > 0 ? btcPrices[btcPrices.length - 1] : 0,
    usdt: usdtPrices.length > 0 ? usdtPrices[usdtPrices.length - 1] : 0,
    doge: dogePrices.length > 0 ? dogePrices[dogePrices.length - 1] : 0,
  }
  cache = { data: { chartData, currentPrices }, ts: Date.now() }
  return cache.data
}
