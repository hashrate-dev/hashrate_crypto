import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Zap, ArrowDownLeft, ArrowUpRight, Send, ArrowDownToLine } from 'lucide-react'
import { fetchMarketChartByRange, fetchCurrentPrice, type ChartRange } from '../api/prices'
import { PriceChart } from '../components/PriceChart'
import { initialWalletState } from '../store/wallet'
import type { AssetType } from '../store/wallet'
import { useWalletAddresses } from '../hooks/useWalletAddresses'
import { useMempoolBtc } from '../hooks/useMempoolBtc'
import { useUsdtBalance } from '../hooks/useUsdtBalance'
import { useDogeBalance } from '../hooks/useDogeBalance'
import { useLtcBalance } from '../hooks/useLtcBalance'
import { useEthBalance } from '../hooks/useEthBalance'
import { ETH_LOGO_URL } from '../lib/assetLogos'

const ASSET_INFO: Record<string, { name: string; symbol: string; subtitle?: string; variant: 'btc' | 'lightning' | 'usdt' | 'doge' | 'ltc' | 'eth'; icon: string | null }> = {
  btc: { name: 'Bitcoin', symbol: 'BTC', variant: 'btc', icon: '₿' },
  btc_lightning: { name: 'Bitcoin', symbol: 'BTC', subtitle: 'Lightning', variant: 'lightning', icon: '₿' },
  usdt: { name: 'Tether', symbol: 'USDT', variant: 'usdt', icon: '₮' },
  doge: { name: 'Dogecoin', symbol: 'DOGE', variant: 'doge', icon: 'Ð' },
  ltc: { name: 'Litecoin', symbol: 'LTC', variant: 'ltc', icon: 'Ł' },
  eth: { name: 'Ethereum', symbol: 'ETH', variant: 'eth', icon: 'Ξ' },
}

const RANGES: ChartRange[] = ['1m', '5m', '15m', '4h', '1d', '1w', '1M']

type BtcNetwork = 'btc' | 'btc_lightning'

export function MercadoAsset() {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()
  const [range, setRange] = useState<ChartRange>('1d')
  const [chartData, setChartData] = useState<number[]>([])
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Solo para assetId === 'btc': red base o Lightning. */
  const [btcNetwork, setBtcNetwork] = useState<BtcNetwork>('btc')

  const info = assetId ? ASSET_INFO[assetId] : null
  const isBtcUnified = assetId === 'btc'

  // Precio actual: se obtiene una vez por activo, no cambia con la temporalidad
  useEffect(() => {
    if (!assetId || !ASSET_INFO[assetId]) return
    let cancelled = false
    fetchCurrentPrice(assetId)
      .then((p) => { if (!cancelled) setCurrentPrice(p) })
      .catch(() => { if (!cancelled) setCurrentPrice(0) })
    return () => { cancelled = true }
  }, [assetId])
  const chartColor = info?.variant === 'lightning' ? 'rgb(139, 92, 246)' : info?.variant === 'usdt' ? 'rgb(34, 197, 94)' : info?.variant === 'doge' ? 'rgb(198, 166, 100)' : info?.variant === 'ltc' ? 'rgb(148, 163, 184)' : info?.variant === 'eth' ? 'rgb(99, 102, 241)' : 'rgb(247, 147, 26)'
  const chartColorDown = info?.variant === 'btc' || info?.variant === 'doge' || info?.variant === 'ltc' ? chartColor : 'rgb(239, 68, 68)'

  const prevAssetId = useRef<string | undefined>(undefined)
  // Carga inicial y al cambiar rango; no mostrar "Cargando..." si ya hay gráfico (cambio de temporalidad)
  useEffect(() => {
    if (!assetId || !ASSET_INFO[assetId]) {
      navigate('/mercado', { replace: true })
      return
    }
    let cancelled = false
    const assetChanged = prevAssetId.current !== assetId
    if (assetChanged) prevAssetId.current = assetId
    const showSpinner = assetChanged || chartData.length === 0
    if (showSpinner) {
      if (assetChanged) setChartData([])
      setLoading(true)
      setError(null)
    }
    fetchMarketChartByRange(assetId, range)
      .then((prices) => {
        if (!cancelled) setChartData(prices)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar')
          setChartData([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [assetId, range, navigate])

  // Prefetch 1m, 5m, 15m, 1d, 1w en segundo plano para que al cambiar sean instantáneos
  useEffect(() => {
    if (!assetId || !ASSET_INFO[assetId] || chartData.length === 0) return
    const toPrefetch: ChartRange[] = ['1m', '5m', '15m', '1d', '1w']
    toPrefetch.forEach((r) => {
      if (r !== range) void fetchMarketChartByRange(assetId, r)
    })
  }, [assetId, range, chartData.length])

  // Auto-refresh cada 15 s
  useEffect(() => {
    if (!assetId || !ASSET_INFO[assetId]) return
    const ms = 15_000
    const interval = setInterval(() => {
      fetchMarketChartByRange(assetId, range)
        .then((prices) => setChartData(prices))
        .catch(() => {})
      fetchCurrentPrice(assetId).then((p) => setCurrentPrice(p)).catch(() => {})
    }, ms)
    return () => clearInterval(interval)
  }, [assetId, range])

  if (!info) return null

  const assetType = assetId as AssetType
  const { btcAddress, usdtAddress, dogeAddress, ltcAddress, ethAddress, hasLinkedWallet } = useWalletAddresses()
  const { balanceBtc: mempoolBtc } = useMempoolBtc(btcAddress)
  const { balanceUsdt: usdtBalance } = useUsdtBalance(usdtAddress)
  const { balanceDoge: dogeBalance } = useDogeBalance(dogeAddress)
  const { balanceLtc: ltcBalance } = useLtcBalance(ltcAddress)
  const { balanceEth: ethBalance } = useEthBalance(ethAddress)

  const lightningBalance = hasLinkedWallet ? (initialWalletState.balances.find((b) => b.asset === 'btc_lightning')?.amount ?? '0') : '0'

  const amount = useMemo(() => {
    if (isBtcUnified) return btcNetwork === 'btc' ? (mempoolBtc ?? '0') : lightningBalance
    if (assetType === 'btc') return mempoolBtc ?? '0'
    if (assetType === 'usdt') return usdtBalance ?? '0'
    if (assetType === 'doge') return dogeBalance ?? '0'
    if (assetType === 'ltc') return ltcBalance ?? '0'
    if (assetType === 'eth') return ethBalance ?? '0'
    if (assetType === 'btc_lightning') return lightningBalance
    return '0'
  }, [assetType, isBtcUnified, btcNetwork, mempoolBtc, usdtBalance, dogeBalance, ltcBalance, ethBalance, lightningBalance])

  const amountNum = parseFloat(amount)
  const valueUsd = currentPrice > 0 ? amountNum * currentPrice : 0
  // Actividad: no mostrar nada si no hay historial real (no usar transacciones demo)
  const activity: { id: string; type: 'send' | 'receive'; amount: string; amountUsd?: string; counterparty: string; asset: AssetType }[] = []

  const effectiveAssetType: AssetType = isBtcUnified ? btcNetwork : assetType
  const formatAmount = (val: string) =>
    effectiveAssetType === 'usdt' ? parseFloat(val).toFixed(2) : effectiveAssetType === 'eth' ? parseFloat(val).toFixed(6) : parseFloat(val).toFixed(8)
  const formatUsd = (val: number) =>
    val >= 1 ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val.toFixed(2)

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate('/mercado')}
          className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              info.variant === 'btc' ? 'bg-btc/20' : info.variant === 'lightning' ? 'bg-lightning/20' : info.variant === 'doge' ? 'bg-amber-200/20' : info.variant === 'ltc' ? 'bg-slate-400/20' : info.variant === 'eth' ? 'bg-indigo-400/20' : 'bg-usdt/20'
            }`}
          >
            {info.variant === 'eth' ? (
              <img src={ETH_LOGO_URL} alt="" className="w-10 h-10 object-contain" />
            ) : info.icon ? (
              <span className={`text-4xl font-bold ${info.variant === 'btc' || info.variant === 'lightning' ? 'text-btc' : info.variant === 'doge' ? 'text-amber-300' : info.variant === 'ltc' ? 'text-slate-300' : 'text-emerald-400'}`}>
                {info.icon}
              </span>
            ) : (
              <Zap className="w-7 h-7 text-violet-400" strokeWidth={2} />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{info.name}</h1>
            <p className="text-sm text-white/50">{info.subtitle ?? info.symbol}</p>
          </div>
        </div>
      </div>

      {/* Selector de red solo para Bitcoin: Red base o Lightning */}
      {isBtcUnified && (
        <div className="flex gap-2 p-1 glass rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setBtcNetwork('btc')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              btcNetwork === 'btc' ? 'bg-btc/20 text-btc border border-btc/40' : 'text-white/60 hover:text-white/80 border border-transparent'
            }`}
          >
            Red base (BTC)
          </button>
          <button
            type="button"
            onClick={() => setBtcNetwork('btc_lightning')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              btcNetwork === 'btc_lightning' ? 'bg-lightning/20 text-violet-400 border border-violet-400/40' : 'text-white/60 hover:text-white/80 border border-transparent'
            }`}
          >
            Lightning
          </button>
        </div>
      )}

      <div className="mb-4">
        <p className="text-3xl font-bold font-mono text-white">
          ${currentPrice >= 1
            ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : currentPrice.toFixed(4)}
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              range === r
                ? 'bg-exodus/20 text-exodus border border-exodus/30'
                : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl border border-white/5 overflow-hidden mt-4" style={{ minHeight: 240 }}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/50 text-sm">
            Cargando gráfico…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-amber-400/90 text-sm px-4">
            {error}
          </div>
        ) : (
          <PriceChart
            data={chartData}
            lineColor={chartColor}
            lineColorDown={chartColorDown}
            height={240}
            className="w-full"
            id={`${assetId}-${range}`}
          />
        )}
      </div>

      {/* Cantidad y valor en USD (estilo Exodus) */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl border border-white/5 p-4">
          <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Cantidad</p>
          <p className="text-lg font-semibold font-mono text-white">
            {formatAmount(amount)} <span className="text-white/60">{info.symbol}</span>
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/5 p-4">
          <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Valor</p>
          <p className="text-lg font-semibold font-mono text-white">
            ${formatUsd(valueUsd)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          to="/send"
          state={{ asset: isBtcUnified ? effectiveAssetType : assetId }}
          className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
        >
          <Send className="w-5 h-5" />
          Enviar
        </Link>
        <Link
          to={`/receive/${isBtcUnified ? (btcNetwork === 'btc_lightning' ? 'lightning' : 'btc') : (assetId === 'btc_lightning' ? 'lightning' : (assetId as string))}`}
          className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
        >
          <ArrowDownToLine className="w-5 h-5" />
          Recibir
        </Link>
      </div>

      {/* Actividad: solo se muestra si hay transacciones */}
      {activity.length > 0 && (
      <div className="mt-6">
        <h2 className="text-sm font-medium text-white/60 mb-3">Actividad</h2>
        <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {activity.map((tx) => {
              const txValueUsd = currentPrice > 0 ? parseFloat(tx.amount) * currentPrice : parseFloat(tx.amountUsd ?? '0')
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'receive' ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                    }`}
                  >
                    {tx.type === 'receive' ? (
                      <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-rose-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium capitalize">{tx.type === 'receive' ? 'Recibido' : 'Enviado'}</p>
                    <p className="text-xs text-white/50 break-all">{tx.counterparty}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono font-semibold ${tx.type === 'receive' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'receive' ? '+' : '-'}{formatAmount(tx.amount)} {info.symbol}
                    </p>
                    <p className="text-xs text-white/50">${formatUsd(txValueUsd)}</p>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
      )}
    </div>
  )
}
