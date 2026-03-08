/**
 * Sonidos de notificación: alcancía (recibir) y enviar (transferencia).
 * Usa Web Audio API para no depender de archivos.
 */

let audioContext: AudioContext | null = null

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioContext
}

function beep(frequency: number, durationMs: number, volume = 0.15): void {
  try {
    const ctx = getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = 'sine'
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000)
  } catch {
    // ignore
  }
}

/** Sonido tipo alcancía / moneda al recibir fondos (dos tonos ascendentes). */
export function playAlcanciaSound(): void {
  beep(880, 80)
  setTimeout(() => beep(1320, 120), 90)
}

/** Sonido al enviar transferencia (tono de confirmación). */
export function playSendSound(): void {
  beep(440, 60)
  setTimeout(() => beep(330, 100), 70)
}
