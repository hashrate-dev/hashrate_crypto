/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública del backend Node (sin barra final). Obligatoria en build de producción (ej. Vercel). */
  readonly VITE_API_URL?: string
}
