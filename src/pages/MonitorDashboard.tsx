import { useState, useEffect } from 'react'
import { getMonitorUsers, getAccessLog, type MonitorUser, type AccessLogEntry } from '../api/monitor'

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

export function MonitorDashboard() {
  const [users, setUsers] = useState<MonitorUser[]>([])
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([getMonitorUsers(), getAccessLog(200)])
      .then(([u, log]) => {
        setUsers(u)
        setAccessLog(log)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#020509] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-white">Monitor — Usuarios y accesos</h1>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-sm">
            {error}
          </div>
        )}

        {loading && users.length === 0 && accessLog.length === 0 ? (
          <p className="text-white/50">Cargando…</p>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-white/90 mb-3">Usuarios registrados</h2>
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-4 py-3 font-medium text-white/70">ID</th>
                        <th className="px-4 py-3 font-medium text-white/70">Email</th>
                        <th className="px-4 py-3 font-medium text-white/70">Nombre</th>
                        <th className="px-4 py-3 font-medium text-white/70">Apellido</th>
                        <th className="px-4 py-3 font-medium text-white/70">Alta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-white/50 text-center">
                            No hay usuarios registrados
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="px-4 py-3 font-mono text-white/90">{u.id}</td>
                            <td className="px-4 py-3 text-white/90 break-all">{u.email}</td>
                            <td className="px-4 py-3 text-white/90">
                              {[u.firstName, u.secondName].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td className="px-4 py-3 text-white/90">
                              {[u.firstSurname, u.secondSurname].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td className="px-4 py-3 text-white/60 text-xs">{u.createdAt}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white/90 mb-3">Histórico de accesos</h2>
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
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
              </div>
            </section>
          </>
        )}

        <p className="mt-6 text-white/40 text-xs">
          Actualización automática cada 30 s. Enlace: <code className="bg-white/10 px-1 rounded">/dashboard</code>
        </p>
      </div>
    </div>
  )
}
