import nodemailer from 'nodemailer'

/**
 * Envía un email avisando que la contraseña fue cambiada.
 * Si SMTP no está configurado (SMTP_USER, SMTP_PASS), no envía y no lanza error.
 * @param {string} toEmail - Email del usuario
 * @returns {Promise<boolean>} true si se envió, false si no estaba configurado o falló
 */
export async function sendPasswordChangedEmail(toEmail) {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) {
    console.log('[Email] SMTP no configurado (SMTP_USER/SMTP_PASS). No se envía aviso de cambio de contraseña.')
    return false
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  })

  const from = process.env.EMAIL_FROM || 'Wallet <noreply@wallet.demo>'
  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: 'Tu contraseña fue cambiada',
      text: `Hola,\n\nTe confirmamos que la contraseña de tu cuenta fue cambiada correctamente.\n\nSi no fuiste vos quien hizo este cambio, contactá a soporte de inmediato.\n\nSaludos,\nWallet`,
      html: `
        <p>Hola,</p>
        <p>Te confirmamos que la <strong>contraseña de tu cuenta fue cambiada</strong> correctamente.</p>
        <p>Si no fuiste vos quien hizo este cambio, contactá a soporte de inmediato.</p>
        <p>Saludos,<br/>Wallet</p>
      `.trim(),
    })
    console.log('[Email] Aviso de cambio de contraseña enviado a', toEmail)
    return true
  } catch (err) {
    console.error('[Email] Error al enviar aviso de cambio de contraseña:', err.message)
    return false
  }
}
