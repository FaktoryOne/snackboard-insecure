// Fail at startup, not at 2am in production.
//
// An app that boots happily without a credential it needs will break later,
// somewhere you are not looking. Check for the names here, on the way up.

const REQUIRED = []
const OPTIONAL = ['RESEND_API_KEY']

// GITHUB_TOKEN is optional too, but it is deliberately not in OPTIONAL: the
// start-up check in src/lib/github.js reports it in more useful words than this
// file can, and two lines saying the same thing is noise on the way up.

const missing = REQUIRED.filter((name) => !process.env[name])
if (missing.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`)
}

for (const name of OPTIONAL) {
  if (!process.env[name]) {
    console.warn(`[env] ${name} is not set — the features that need it are disabled.`)
  }
}

/**
 * Read an optional variable, treating blank as absent.
 *
 * An exported-but-empty variable is not a value. It happens more than you would
 * think — a CI job that sets every name it knows about, a shell profile with
 * `export GITHUB_TOKEN=`, a `.env` line with nothing after the `=` — and an
 * empty string wins over a `.env` file, because the real environment always
 * does. Treating it as a credential means sending `Authorization: Bearer ` and
 * reading the 401 as "my credential was refused" when the truth is "I never
 * sent one". That confusion is the whole of failure mode 1 in the rotation
 * session, so it is worth three lines here to make it impossible.
 */
function optional(name) {
  const raw = process.env[name]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

export const env = {
  resendApiKey: optional('RESEND_API_KEY'),

  // The practice credential for the rotation exercise. Absent is a normal
  // state: the app runs fine without it and says so once on the way up.
  githubToken: optional('GITHUB_TOKEN'),
  // Overridable so the connection check can be pointed at a stub when there is
  // no network.
  githubApi: optional('GITHUB_API') ?? 'https://api.github.com',
  // Short, because this runs on the way up and on a page load. A training
  // room's wifi is not a reason for the app to hang.
  githubTimeoutMs: Number(optional('GITHUB_TIMEOUT_MS') ?? 4000),
}
