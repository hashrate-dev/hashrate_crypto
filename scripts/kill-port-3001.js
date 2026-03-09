/**
 * Libera el puerto 3001 (mata el proceso que lo usa).
 * Windows: netstat + taskkill. Otros: lsof + kill.
 */
import { execSync } from 'child_process'

const port = 3001

try {
  if (process.platform === 'win32') {
    let out = ''
    try {
      out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (e) {
      // findstr no encontró nada = puerto libre, seguir
    }
    const lines = out.trim().split('\n').filter((l) => l.includes('LISTENING'))
    const pids = new Set()
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && /^\d+$/.test(pid)) pids.add(pid)
    }
    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' })
      console.log(`Puerto ${port} liberado (PID ${pid} terminado).`)
    }
    if (pids.size === 0) console.log(`Ningún proceso usaba el puerto ${port}.`)
  } else {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'inherit' })
    console.log(`Puerto ${port} liberado.`)
  }
} catch (e) {
  if (e.status === 1 && e.stdout === '') {
    console.log(`Ningún proceso usaba el puerto ${port}.`)
  } else {
    console.warn('No se pudo liberar el puerto:', e.message)
  }
}
