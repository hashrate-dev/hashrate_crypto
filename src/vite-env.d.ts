/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública del backend Node (sin barra final). Obligatoria en build de producción (ej. Vercel). */
  readonly VITE_API_URL?: string
  /** Proyecto Supabase (Auth + Postgres). Con URL + anon key se usan Supabase para usuarios y monitor. */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
