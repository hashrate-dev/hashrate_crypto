const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:3001' : ''

export interface MonitorUser {
  id: number
  email: string
  firstName: string
  secondName: string | null
  firstSurname: string
  secondSurname: string | null
  createdAt: string
}

export interface AccessLogEntry {
  user_id: number
  email: string
  first_name: string | null
  first_surname: string | null
  at: string
}

export async function getMonitorUsers(): Promise<MonitorUser[]> {
  const res = await fetch(`${API_BASE}/api/monitor/users`)
  if (!res.ok) throw new Error('Error al cargar usuarios')
  const data = await res.json()
  return data.users ?? []
}

export async function getAccessLog(limit = 200): Promise<AccessLogEntry[]> {
  const res = await fetch(`${API_BASE}/api/monitor/access-log?limit=${limit}`)
  if (!res.ok) throw new Error('Error al cargar histórico de accesos')
  const data = await res.json()
  return data.log ?? []
}
