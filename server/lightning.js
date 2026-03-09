/**
 * Integración con LNbits para generar facturas Lightning (BOLT11) reales.
 * Si LNBITS_URL y LNBITS_INVOICE_KEY están en .env, se crean facturas reales con QR y dirección pagable.
 * Si no, el llamador debe usar factura de prueba (mock).
 *
 * Cómo obtener las claves:
 * 1. Entrá a https://lnbits.com (o tu instancia LNbits).
 * 2. Creá una wallet.
 * 3. En la wallet: "API Info" → copiá "Invoice/Read Key" para LNBITS_INVOICE_KEY.
 * 4. LNBITS_URL = https://lnbits.com (sin barra final) o la URL de tu instancia.
 */

const LNBITS_URL = (process.env.LNBITS_URL || '').replace(/\/$/, '')
const LNBITS_INVOICE_KEY = process.env.LNBITS_INVOICE_KEY || ''

const EXPIRY_SECONDS = 1800 // 30 minutos (como Binance)

/**
 * Crea una factura Lightning real vía LNbits.
 * @param {number} amountSats - Monto en satoshis (obligatorio para factura real).
 * @param {{ memo?: string }} [options]
 * @returns {Promise<{ invoice: string, expiresIn: number } | null>}
 *   Si LNbits está configurado y responde OK, devuelve { invoice (bolt11), expiresIn }.
 *   Si no está configurado o falla, devuelve null (el llamador usará mock).
 */
export async function createLightningInvoiceFromLnbits(amountSats, options = {}) {
  if (!LNBITS_URL || !LNBITS_INVOICE_KEY) return null
  const sats = Math.max(1, parseInt(amountSats, 10) || 0)
  const url = `${LNBITS_URL}/api/v1/payments`
  const body = {
    out: false,
    amount: sats,
    memo: typeof options.memo === 'string' ? options.memo.trim().slice(0, 200) : 'Imperium Wallet',
    expiry: EXPIRY_SECONDS,
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Api-Key': LNBITS_INVOICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    const bolt11 = data.bolt11 || data.payment_request
    if (res.ok && bolt11 && typeof bolt11 === 'string' && bolt11.toLowerCase().startsWith('lnbc')) {
      return { invoice: bolt11, expiresIn: EXPIRY_SECONDS }
    }
    console.error('[lightning] LNbits error:', res.status, data)
    return null
  } catch (err) {
    console.error('[lightning] LNbits request failed:', err.message)
    return null
  }
}

export function isLightningConfigured() {
  return Boolean(LNBITS_URL && LNBITS_INVOICE_KEY)
}
