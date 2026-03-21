/**
 * En Vercel, Vite solo inyecta variables que empiezan con VITE_ en el build.
 * Si pusiste SUPABASE_URL / SUPABASE_ANON_KEY (sin VITE_), el front no las ve hasta
 * que las expone la función serverless `/api/public-config`.
 */
import { normalizeSupabaseUrl, sanitizeSupabaseAnonKey } from './supabaseEnv'

export interface BackendRuntimeState {
  supabaseUrl: string
  supabaseAnonKey: string
  apiBase: string
}

function readBuildEnv(): BackendRuntimeState {
  const u = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
  const k = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? ''
  return {
    supabaseUrl: u ? normalizeSupabaseUrl(u) : '',
    supabaseAnonKey: k ? sanitizeSupabaseAnonKey(k) : '',
    apiBase: api.replace(/\/$/, ''),
  }
}

let state: BackendRuntimeState = readBuildEnv()
let loadPromise: Promise<void> | null = null

function mergeFromPublicConfigPayload(j: Record<string, unknown>): void {
  const fu = typeof j.supabaseUrl === 'string' ? normalizeSupabaseUrl(j.supabaseUrl) : ''
  const fk = typeof j.supabaseAnonKey === 'string' ? sanitizeSupabaseAnonKey(j.supabaseAnonKey) : ''
  const fa = typeof j.apiUrl === 'string' ? String(j.apiUrl).trim().replace(/\/$/, '') : ''

  const prevUrl = state.supabaseUrl
  const prevKey = state.supabaseAnonKey

  // En Vercel las variables del servidor son la fuente de verdad: corrige bundle viejo o key truncada.
  if (fu && fk) {
    state = { ...state, supabaseUrl: fu, supabaseAnonKey: fk }
  } else {
    if (fu) state = { ...state, supabaseUrl: fu }
    if (fk) state = { ...state, supabaseAnonKey: fk }
  }
  if (fa) {
    state = { ...state, apiBase: fa }
  }

  if (state.supabaseUrl !== prevUrl || state.supabaseAnonKey !== prevKey) {
    void import('./supabaseClient').then((m) => m.resetSupabaseClient())
  }
}

async function fetchPublicConfig(): Promise<void> {
  if (!import.meta.env.PROD) return
  try {
    const r = await fetch('/api/public-config', { cache: 'no-store' })
    if (!r.ok) {
      console.warn('[Supabase] /api/public-config respondió', r.status, '— revisá Vercel → Functions y vercel.json (no reescribir /api/*).')
      return
    }
    const ct = r.headers.get('content-type') || ''
    const text = await r.text()
    if (text.trimStart().startsWith('<')) {
      console.warn(
        '[Supabase] /api/public-config devolvió HTML (seguro el rewrite SPA capturó /api). Actualizá vercel.json y redeploy.'
      )
      return
    }
    if (!ct.includes('json')) {
      console.warn('[Supabase] /api/public-config no es JSON:', ct)
    }
    const j = JSON.parse(text) as Record<string, unknown>
    mergeFromPublicConfigPayload(j)
  } catch (e) {
    console.warn('[Supabase] No se pudo cargar /api/public-config:', e instanceof Error ? e.message : e)
  }
}

/**
 * Llamar una vez antes de montar React en producción (o si puede faltar VITE_* en el bundle).
 * Idempotente.
 */
export function loadRuntimeBackendConfig(): Promise<void> {
  if (loadPromise) return loadPromise

  if (!import.meta.env.PROD) {
    loadPromise = Promise.resolve()
    return loadPromise
  }

  // Siempre pedir /api/public-config en producción: sobrescribe credenciales del bundle con las de Vercel
  // (evita "Invalid API key" si el build tenía una anon key mala o de otro entorno).
  loadPromise = fetchPublicConfig()
  return loadPromise
}

export function getSupabaseCredentials(): { url: string; key: string } {
  return { url: state.supabaseUrl, key: state.supabaseAnonKey }
}

/** Base del API Node (sin barra final), para legacy y proxies. */
export function getResolvedApiBase(): string {
  return state.apiBase
}
