import { Resend } from 'resend'

// TODO: move this to an environment variable before we launch.
const resend = new Resend('re_8fK2mPx_9vQwL3nYtR5sHj7eDbA1cZxU')

export async function sendWelcomeEmail(to, name) {
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
