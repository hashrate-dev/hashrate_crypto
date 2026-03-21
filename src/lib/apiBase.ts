import { getResolvedApiBase } from './runtimeBackendConfig'

/**
 * Base URL del backend Node (sin barra final).
 * - En local: no definas nada → peticiones relativas `/api/...` y Vite hace proxy al puerto 3001.
 * - En Vercel (u otro hosting del front): define `VITE_API_URL=https://tu-api.com` en el panel de build.
 * - También puede venir de `/api/public-config` si solo configuraste `API_URL` (sin VITE_).
 */
export function getApiBase(): string {
  const fromRuntime = getResolvedApiBase().trim()
  if (fromRuntime) return fromRuntime.replace(/\/$/, '')
  const v = import.meta.env.VITE_API_URL
  if (v == null || String(v).trim() === '') return ''
  return String(v).trim().replace(/\/$/, '')
}

/** URL completa para un path de API (ej. `/api/users/1`). */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const b = getApiBase()
  return b ? `${b}${p}` : p
}

/**
 * En dev sin `VITE_API_URL`: primero mismo origen (proxy Vite), luego backend directo :3001.
 * Con `VITE_API_URL` o en producción: una sola URL.
 */
export function apiUrlCandidates(pathWithQuery: string): string[] {
  const p = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`
  const primary = apiUrl(p)
  const urls = [primary]
  if (import.meta.env.DEV && !getApiBase()) {
    const direct = `http://127.0.0.1:3001${p}`
    if (direct !== primary) urls.push(direct)
  }
  return urls
}
