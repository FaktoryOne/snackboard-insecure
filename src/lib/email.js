import { Resend } from 'resend'
import { env } from '../env.js'

// The key comes from the environment. The one that used to be on this line is
// burned — see SECURITY-ROTATIONS.md.
const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null

export async function sendWelcomeEmail(to, name) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY is not set — skipping the welcome email.')
    return
  }
  try {
    await resend.emails.send({
      from: 'Snackboard <hello@snackboard.io>',
      to,
      subject: 'Welcome to Snackboard!',
      html: `<p>Hi ${name}, welcome aboard. Start voting for snacks!</p>`,
    })
  } catch (err) {
    // No network in the local demo — log and carry on.
    console.warn('[email] could not send welcome email:', err.message)
  }
}
