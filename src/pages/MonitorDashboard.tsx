import { useState, useEffect } from 'react'
import {
  getMonitorUsers,
  getBalanceSnapshots,
  getAccessLog,
  getMonitorSwaps,
  getMonitorOperations,
  getMonitorSwapConfig,
  updateMonitorSwapConfig,
  type MonitorUserWithBalances,
  type MonitorUser,
  type AccessLogEntry,
  type SwapLogEntry,
  type OperationLogEntry,
  type SwapConfig,
} from '../api/monitor'

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function tokenSymbol(mint: string): string {
  if (mint?.includes('So111') || mint === 'So11111111111111111111111111111111111111112') return 'SOL'
  if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') return 'USDC'
  return mint ? `${mint.slice(0, 6)}…` : '—'
}

type TabId = 'resumen' | 'usuarios' | 'accesos' | 'config-swaps' | 'swaps' | 'operaciones'

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'accesos', label: 'Accesos' },
  { id: 'config-swaps', label: 'Config. Swaps' },
  { id: 'swaps', label: 'Swaps' },
  { id: 'operaciones', label: 'Actividad' },
]

export function MonitorDashboard() {
  const [tab, setTab] = useState<TabId>('resumen')
  const [usersWithBalances, setUsersWithBalances] = useState<MonitorUserWithBalances[]>([])
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([])
  const [swaps, setSwaps] = useState<SwapLogEntry[]>([])
  const [operations, setOperations] = useState<OperationLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [balancesError, setBalancesError] = useState<string | null>(null)

  const [swapConfig, setSwapConfigState] = useState<SwapConfig | null>(null)
  const [swapConfigSaving, setSwapConfigSaving] = useState(false)
  const [swapConfigMessage, setSwapConfigMessage] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    setBalancesError(null)
    Promise.allSettled([
      getMonitorUsers(),
      getBalanceSnapshots(),
      getAccessLog(500),
      getMonitorSwaps(500),
      getMonitorOperations(500),
    ]).then(([usersRes, snapshotsRes, accessRes, swapsRes, operationsRes]) => {
      const users: MonitorUser[] = usersRes.status === 'fulfilled' ? usersRes.value : []
      const snapshots = snapshotsRes.status === 'fulfilled' ? snapshotsRes.value : []
      const snapshotByUserId = snapshots.reduce<Record<number, (typeof snapshots)[0]>>((acc, s) => {
        acc[s.userId] = s
        return acc
      }, {})
      const merged: MonitorUserWithBalances[] = users.map((u) => {
        const snap = snapshotByUserId[u.id]
        return {
          ...u,
          balances: snap?.balances ?? {},
          totalUsd: snap?.totalUsd ?? '0',
        }
      })
      setUsersWithBalances(merged)
      if (snapshotsRes.status === 'rejected') {
        setBalancesError(snapshotsRes.reason?.message || 'Snapshots no cargados')
      } else {
        setBalancesError(null)
      }
      if (accessRes.status === 'fulfilled') setAccessLog(accessRes.value)
      else setAccessLog([])
      if (swapsRes.status === 'fulfilled') setSwaps(swapsRes.value)
      else setSwaps([])
      if (operationsRes.status === 'fulfilled') setOperations(operationsRes.value)
      else setOperations([])
      const errs: string[] = []
      if (usersRes.status === 'rejected') errs.push('Usuarios: ' + (usersRes.reason?.message || 'Error'))
      if (accessRes.status === 'rejected') errs.push('Accesos: ' + (accessRes.reason?.message || 'Error'))
      setError(errs.length > 0 ? errs.join('. ') : null)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (tab === 'config-swaps') {
      getMonitorSwapConfig()
        .then(setSwapConfigState)
        .catch(() => setSwapConfigState(null))
    }
  }, [tab])

  const today = new Date().toISOString().slice(0, 10)
  const accessToday = accessLog.filter((e) => e.at?.slice(0, 10) === today).length
  const swapsToday = swaps.filter((e) => e.at?.slice(0, 10) === today).length
  const totalCommission = swaps.reduce((sum, e) => sum + parseFloat(e.commission_approx || '0'), 0)
  const totalUsdAllAccounts = usersWithBalances.reduce((sum, u) => sum + parseFloat(u.totalUsd || '0'), 0)

  return (
    <div className="min-h-screen bg-[#020509] text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-white">Monitor — Movimientos y usuarios</h1>
        <p className="text-white/50 text-sm mb-6">
          Accesos, swaps, comisiones y actividad. Actualización cada 20 s.
        </p>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-sm">
            <p className="font-medium">{error}</p>
            <p className="mt-2 text-rose-200/80 text-xs">
              Si ves 404: el backend debe ser server/index.js. Desde la raíz del proyecto ejecutá: <code className="bg-white/10 px-1 rounded">npm run dev</code> (arranca backend en 3001 + Vite; el proxy envía /api al backend).
            </p>
            <button
              type="button"
              onClick={() => load()}
              className="mt-3 px-4 py-2 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 text-white text-sm font-medium transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1 mb-6 border-b border-white/10 pb-2">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === id ? 'bg-exodus/30 text-exodus border border-exodus/50' : 'text-white/60 hover:text-white/90 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && usersWithBalances.length === 0 && accessLog.length === 0 && swaps.length === 0 ? (
          <p className="text-white/50">Cargando…</p>
        ) : (
          <>
            {tab === 'resumen' && (
              <section className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Usuarios</p>
                    <p className="text-2xl font-bold text-white">{usersWithBalances.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Accesos hoy</p>
                    <p className="text-2xl font-bold text-white">{accessToday}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Swaps hoy</p>
                    <p className="text-2xl font-bold text-white">{swapsToday}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Comisiones (aprox.)</p>
                    <p className="text-2xl font-bold text-emerald-400">{totalCommission.toFixed(6)}</p>
                    <p className="text-white/40 text-xs mt-0.5">Total histórico en token de entrada</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Total en cuentas (USD)</p>
                    <p className="text-2xl font-bold text-white">
                      ${totalUsdAllAccounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">Suma de saldos en vivo por usuario</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-white/80 font-semibold mb-2">Últimos accesos</h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
                    {accessLog.slice(0, 10).map((entry, i) => (
                      <div key={`${entry.at}-${entry.user_id}-${i}`} className="flex justify-between text-white/70">
                        <span>{entry.email}</span>
                        <span className="text-white/50 text-xs">{formatDate(entry.at)}</span>
                      </div>
                    ))}
                    {accessLog.length === 0 && <p className="text-white/50">Sin accesos</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-white/80 font-semibold mb-2">Últimos swaps</h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
                    {swaps.slice(0, 10).map((s, i) => (
                      <div key={`${s.at}-${s.tx_signature}-${i}`} className="flex justify-between items-center text-white/70">
                        <span>
                          {s.email} · {tokenSymbol(s.input_mint)}→{tokenSymbol(s.output_mint)} · Comisión ~{s.commission_approx}
                        </span>
                        <span className="text-white/50 text-xs">{formatDate(s.at)}</span>
                      </div>
                    ))}
                    {swaps.length === 0 && <p className="text-white/50">Sin swaps registrados</p>}
                  </div>
                </div>
              </section>
            )}

            {tab === 'usuarios' && (
              <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-3 py-2 font-medium text-white/70">ID</th>
                        <th className="px-3 py-2 font-medium text-white/70">Email</th>
                        <th className="px-3 py-2 font-medium text-white/70">Nombre</th>
                        <th className="px-3 py-2 font-medium text-white/70">Apellido</th>
                        <th className="px-3 py-2 font-medium text-white/70">BTC</th>
                        <th className="px-3 py-2 font-medium text-white/70">SOL</th>
                        <th className="px-3 py-2 font-medium text-white/70">ETH</th>
                        <th className="px-3 py-2 font-medium text-white/70">USDT</th>
                        <th className="px-3 py-2 font-medium text-white/70">DOGE</th>
                        <th className="px-3 py-2 font-medium text-white/70">LTC</th>
                        <th className="px-3 py-2 font-medium text-white/70">Total USD</th>
                        <th className="px-3 py-2 font-medium text-white/70">Actualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersWithBalances.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="px-4 py-6 text-white/50 text-center">
                            No hay usuarios registrados
                          </td>
                        </tr>
                      ) : (
                        usersWithBalances.map((u) => {
                          const bal = u.balances ?? {}
                          const hasBalances = Object.keys(bal).length > 0
                          const fmt = (v: string | undefined) => {
                            const n = v != null ? parseFloat(v) : 0
                            if (!hasBalances) return '—'
                            return Number.isFinite(n) ? n.toFixed(4) : '0.0000'
                          }
                          const btcTotal = (parseFloat(bal.btc || '0') + parseFloat(bal.btc_lightning || '0')).toFixed(4)
                          const btcDisplay = hasBalances ? (parseFloat(btcTotal) > 0 ? btcTotal : '0.0000') : '—'
                          const totalUsdNum = parseFloat(u.totalUsd || '0')
                          return (
                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="px-3 py-2 font-mono text-white/90">{u.id}</td>
                              <td className="px-3 py-2 text-white/90 break-all">{u.email}</td>
                              <td className="px-3 py-2 text-white/90">
                                {[u.firstName, u.secondName].filter(Boolean).join(' ') || '—'}
                              </td>
                              <td className="px-3 py-2 text-white/90">
                                {[u.firstSurname, u.secondSurname].filter(Boolean).join(' ') || '—'}
                              </td>
                              <td className="px-3 py-2 text-white/80 font-mono text-xs">{btcDisplay}</td>
                              <td className="px-3 py-2 text-white/80 font-mono text-xs">{fmt(bal.sol)}</td>
                              <td className="px-3 py-2 text-white/80 font-mono text-xs">{fmt(bal.eth)}</td>
                              <td className="px-3 py-2 text-white/80 font-mono text-xs">{fmt(bal.usdt)}</td>
                              <td className="px-3 py-2 text-white/80 font-mono text-xs">{fmt(bal.doge)}</td>
                              <td className="px-3 py-2 text-white/80 font-mono text-xs">{fmt(bal.ltc)}</td>
                              <td className="px-3 py-2 text-emerald-400 font-medium">
                                {hasBalances
                                  ? `$${totalUsdNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 text-white/50 text-xs whitespace-nowrap">En vivo</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {balancesError && (
                  <p className="px-4 py-2 text-amber-400/90 text-xs border-t border-white/10">
                    {balancesError}. Revisá que el backend tenga /api/monitor/balance-snapshots.
                  </p>
                )}
                <p className="px-4 py-2 text-white/40 text-xs border-t border-white/10">
                  Saldos según el último acceso de cada usuario a su Dashboard (wallet). Si un usuario muestra —, que abra su Dashboard una vez para actualizar.
                </p>
              </section>
            )}

            {tab === 'accesos' && (
              <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#0f1729] border-b border-white/10 z-10">
                      <tr>
                        <th className="px-4 py-3 font-medium text-white/70">ID</th>
                        <th className="px-4 py-3 font-medium text-white/70">Email</th>
                        <th className="px-4 py-3 font-medium text-white/70">Nombre</th>
                        <th className="px-4 py-3 font-medium text-white/70">Apellido</th>
                        <th className="px-4 py-3 font-medium text-white/70">Fecha y hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessLog.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-white/50 text-center">
                            Aún no hay accesos registrados
                          </td>
                        </tr>
                      ) : (
                        accessLog.map((entry, i) => (
                          <tr key={`${entry.at}-${entry.user_id}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                            <td className="px-4 py-2 font-mono text-white/90">{entry.user_id}</td>
                            <td className="px-4 py-2 text-white/90 break-all">{entry.email}</td>
                            <td className="px-4 py-2 text-white/90">{entry.first_name ?? '—'}</td>
                            <td className="px-4 py-2 text-white/90">{entry.first_surname ?? '—'}</td>
                            <td className="px-4 py-2 text-white/60 text-xs whitespace-nowrap">
                              {formatDate(entry.at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'config-swaps' && (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-6 max-w-2xl">
                <h3 className="text-lg font-semibold text-white mb-1">Configuración Jupiter</h3>
                <p className="text-white/50 text-sm mb-6">
                  Comisión, wallet de cobro y slippage por defecto para los swaps con Jupiter.
                </p>
                {swapConfig === null ? (
                  <p className="text-white/50 text-sm">Cargando…</p>
                ) : (
                  <form
                    className="space-y-5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const fd = new FormData(e.currentTarget)
                      const platformFeePct = Number(fd.get('platformFeePct') ?? swapConfig.platformFeeBps / 100)
                      const feeWallet = String(fd.get('feeWallet') ?? '').trim()
                      const slippagePct = Number(fd.get('slippagePct') ?? swapConfig.slippageBps / 100)
                      const platformFeeBps = Math.round(platformFeePct * 100)
                      const slippageBps = Math.round(slippagePct * 100)
                      setSwapConfigSaving(true)
                      setSwapConfigMessage(null)
                      updateMonitorSwapConfig({
                        platformFeeBps: Math.min(10000, Math.max(0, platformFeeBps)),
                        feeWallet: feeWallet || undefined,
                        slippageBps: Math.min(10000, Math.max(1, slippageBps)),
                      })
                        .then((updated) => {
                          setSwapConfigState(updated)
                          setSwapConfigMessage('Configuración guardada.')
                          setTimeout(() => setSwapConfigMessage(null), 4000)
                        })
                        .catch((err) => setSwapConfigMessage(err instanceof Error ? err.message : 'Error al guardar'))
                        .finally(() => setSwapConfigSaving(false))
                    }}
                  >
                    <div>
                      <label className="block text-white/80 text-sm font-medium mb-1">Comisión por operación (%)</label>
                      <input
                        name="platformFeePct"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        defaultValue={swapConfig.platformFeeBps / 100}
                        className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-exodus/50 focus:ring-1 focus:ring-exodus/50 outline-none"
                        placeholder="0.2"
                      />
                      <p className="text-white/40 text-xs mt-1">Porcentaje que se cobra en cada swap (ej. 0.2 = 0,2%)</p>
                    </div>
                    <div>
                      <label className="block text-white/80 text-sm font-medium mb-1">Wallet de comisiones (Solana)</label>
                      <input
                        name="feeWallet"
                        type="text"
                        defaultValue={swapConfig.feeWallet}
                        className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-exodus/50 focus:ring-1 focus:ring-exodus/50 outline-none font-mono text-sm"
                        placeholder="9PMkkTEdEPyrACphv1sEqjJvtC51y6qr224EBcRN6fxc"
                      />
                      <p className="text-white/40 text-xs mt-1">Dirección Solana donde se reciben las comisiones</p>
                    </div>
                    <div>
                      <label className="block text-white/80 text-sm font-medium mb-1">Slippage por defecto (%)</label>
                      <input
                        name="slippagePct"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="100"
                        defaultValue={swapConfig.slippageBps / 100}
                        className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-exodus/50 focus:ring-1 focus:ring-exodus/50 outline-none"
                        placeholder="0.5"
                      />
                      <p className="text-white/40 text-xs mt-1">Tolerancia de deslizamiento en cotizaciones (ej. 0.5 = 0,5%)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={swapConfigSaving}
                        className="px-5 py-2.5 rounded-xl bg-exodus/80 hover:bg-exodus text-white font-medium text-sm disabled:opacity-50 transition-colors"
                      >
                        {swapConfigSaving ? 'Guardando…' : 'Guardar configuración'}
                      </button>
                      {swapConfigMessage && (
                        <span className={swapConfigMessage.startsWith('Error') ? 'text-rose-400 text-sm' : 'text-emerald-400 text-sm'}>
                          {swapConfigMessage}
                        </span>
                      )}
                    </div>
                  </form>
                )}
              </section>
            )}

            {tab === 'swaps' && (
              <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#0f1729] border-b border-white/10 z-10">
                      <tr>
                        <th className="px-4 py-3 font-medium text-white/70">Usuario</th>
                        <th className="px-4 py-3 font-medium text-white/70">Par</th>
                        <th className="px-4 py-3 font-medium text-white/70">Entrada</th>
                        <th className="px-4 py-3 font-medium text-white/70">Salida</th>
                        <th className="px-4 py-3 font-medium text-white/70">Comisión (aprox.)</th>
                        <th className="px-4 py-3 font-medium text-white/70">Tx</th>
                        <th className="px-4 py-3 font-medium text-white/70">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {swaps.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-white/50 text-center">
                            Aún no hay swaps registrados
                          </td>
                        </tr>
                      ) : (
                        swaps.map((s, i) => (
                          <tr key={`${s.at}-${s.tx_signature}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                            <td className="px-4 py-2 text-white/90">
                              <span className="block font-mono text-xs text-white/50">{s.user_id}</span>
                              <span className="block break-all">{s.email}</span>
                            </td>
                            <td className="px-4 py-2 text-white/90">
                              {tokenSymbol(s.input_mint)} → {tokenSymbol(s.output_mint)}
                            </td>
                            <td className="px-4 py-2 font-mono text-white/90">{s.in_amount}</td>
                            <td className="px-4 py-2 font-mono text-white/90">{s.out_amount}</td>
                            <td className="px-4 py-2 font-mono text-emerald-400">{s.commission_approx || '—'}</td>
                            <td className="px-4 py-2">
                              {s.tx_signature ? (
                                <a
                                  href={`https://solscan.io/tx/${s.tx_signature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-exodus text-xs hover:underline truncate max-w-[100px] inline-block"
                                >
                                  {s.tx_signature.slice(0, 8)}…
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-2 text-white/60 text-xs whitespace-nowrap">
                              {formatDate(s.at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'operaciones' && (
              <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#0f1729] border-b border-white/10 z-10">
                      <tr>
                        <th className="px-4 py-3 font-medium text-white/70">ID</th>
                        <th className="px-4 py-3 font-medium text-white/70">Email</th>
                        <th className="px-4 py-3 font-medium text-white/70">Tipo</th>
                        <th className="px-4 py-3 font-medium text-white/70">Detalle</th>
                        <th className="px-4 py-3 font-medium text-white/70">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-white/50 text-center">
                            Sin eventos de actividad aún (envíos, páginas, etc.)
                          </td>
                        </tr>
                      ) : (
                        operations.map((op, i) => (
                          <tr key={`${op.at}-${op.user_id}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                            <td className="px-4 py-2 font-mono text-white/90">{op.user_id}</td>
                            <td className="px-4 py-2 text-white/90 break-all">{op.email}</td>
                            <td className="px-4 py-2 text-white/90">{op.type}</td>
                            <td className="px-4 py-2 text-white/70 text-xs">{op.detail ?? '—'}</td>
                            <td className="px-4 py-2 text-white/60 text-xs whitespace-nowrap">
                              {formatDate(op.at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        <p className="mt-6 text-white/40 text-xs">
          Enlace: <code className="bg-white/10 px-1 rounded">/dashboard</code>
        </p>
      </div>
    </div>
  )
}
