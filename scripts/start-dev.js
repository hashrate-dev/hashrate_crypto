/**
 * Arranca backend, espera a que responda, luego arranca Vite.
 * Así /api/* siempre tiene backend disponible cuando abrís la app.
 */
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

async function waitForBackend(maxMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/health')
      const data = await res.json()
      if (data?.ok) return true
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

// 1) Liberar puerto 3001
const kill = spawn('node', ['scripts/kill-port-3001.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
await new Promise((resolve) => kill.on('close', resolve))

// 2) Arrancar backend en segundo plano
const server = spawn('node', ['server/index.js'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' },
})
server.stdout?.on('data', (d) => process.stdout.write(`[api] ${d}`))
server.stderr?.on('data', (d) => process.stderr.write(`[api] ${d}`))
server.on('error', (err) => {
  console.error('[api] Error:', err.message)
  process.exit(1)
})

// 3) Esperar a que el backend responda
process.stdout.write('Esperando backend en :3001...')
const ok = await waitForBackend()
if (!ok) {
  console.error('\nEl backend no respondió a tiempo. Comprobá que el puerto 3001 esté libre.')
  server.kill('SIGTERM')
  process.exit(1)
}
console.log(' listo.')

// 4) Arrancar Vite en primer plano (el proceso termina cuando Vite termina)
const vite = spawn('npx', ['vite'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
function shutdown() {
  server.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
vite.on('close', (code) => {
  server.kill('SIGTERM')
  process.exit(code ?? 0)
})
