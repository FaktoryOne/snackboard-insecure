// Fail at startup, not at 2am in production.
//
// An app that boots happily without a credential it needs will break later,
// somewhere you are not looking. Check for the names here, on the way up.

const REQUIRED = []
const OPTIONAL = ['RESEND_API_KEY']

const missing = REQUIRED.filter((name) => !process.env[name])
if (missing.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`)
}

for (const name of OPTIONAL) {
  if (!process.env[name]) {
    console.warn(`[env] ${name} is not set — the features that need it are disabled.`)
  }
}

export const env = {
  resendApiKey: process.env.RESEND_API_KEY ?? null,
}
