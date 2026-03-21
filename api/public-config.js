/**
 * Vercel Serverless (CommonJS: la raíz del repo tiene "type":"module").
 * Expone URL + clave pública de Supabase y API URL para el front en runtime.
 */
function pickFirstEnv(keys) {
  for (const k of keys) {
    const v = process.env[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

module.exports = function publicConfigHandler(_req, res) {
  const supabaseUrl = pickFirstEnv([
    'VITE_SUPABASE_URL',
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_URL',
  ])
  const supabaseAnonKey = pickFirstEnv([
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'PUBLIC_SUPABASE_ANON_KEY',
  ])
  const apiUrl = pickFirstEnv(['VITE_API_URL', 'API_URL'])

  const body = JSON.stringify({ supabaseUrl, supabaseAnonKey, apiUrl })
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  })
  res.end(body)
}
