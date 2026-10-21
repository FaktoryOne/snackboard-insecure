// Everything the suite needs to know about *which* application it is attacking.
//
// Every default below describes Snackboard, and every one of them can be
// overridden from the command line or the environment. That is what lets you
// copy this directory into your own project and point it at your own app
// without editing a line of code — see "Point it at your own app" in
// probe/README.md.
//
//   --target URL   PROBE_TARGET           base URL of the app      http://127.0.0.1:3000
//   --dir NAMES    PROBE_DIR              which probes to run      probes
//                  PROBE_HEALTH           readiness path           /health
//                  PROBE_LOGIN            login path               /api/login
//                  PROBE_SESSION_COOKIE   session cookie name      session
//                  PROBE_USERS            identities, or `none`    alice,bob,admin
//                  PROBE_REPO             repo root for static probes   the parent of probe/

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROBE_HOME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
export const flag = (name) => argv.includes(name)
export const option = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? null : (argv[i + 1] ?? null)
}

const trimSlash = (url) => url.replace(/\/+$/, '')
const withSlash = (p) => (p.startsWith('/') ? p : `/${p}`)

/**
 * The seeded identities the suite logs in as. Snackboard's three are the
 * default; `PROBE_USERS=none` turns logins off entirely, which is what you
 * want on an app whose probes do not need an identity yet.
 *
 * Format: `name=email:password`, comma separated.
 *   PROBE_USERS='alice=ann@acme.test:hunter2,bob=bo@acme.test:hunter2'
 */
function parseUsers(raw) {
  if (raw === undefined) {
    return [
      { name: 'alice', email: 'alice@example.com', password: 'password123' },
      { name: 'bob', email: 'bob@example.com', password: 'password123' },
      { name: 'admin', email: 'admin@example.com', password: 'admin123' },
    ]
  }
  if (raw.trim() === '' || raw.trim() === 'none') return []

  return raw.split(',').map((entry) => {
    const match = entry.trim().match(/^([^=]+)=([^:]+):(.*)$/)
    if (!match) {
      throw new Error(
        `PROBE_USERS entry "${entry.trim()}" is not name=email:password. ` +
          `Example: PROBE_USERS='alice=ann@acme.test:hunter2'. Use PROBE_USERS=none for no logins.`,
      )
    }
    const [, name, email, password] = match
    return { name: name.trim(), email: email.trim(), password }
  })
}

export const CONFIG = Object.freeze({
  // 127.0.0.1 rather than `localhost`. Snackboard's API binds loopback IPv4
  // only, and on a machine where `localhost` resolves to ::1 first every probe
  // would fail to connect — which looks like a broken suite rather than an
  // unreachable app.
  target: trimSlash(option('--target') ?? process.env.PROBE_TARGET ?? 'http://127.0.0.1:3000'),

  // Which directories of probes to run, in order. `probes` is Snackboard's
  // eleven; `yours` is where you write your own. Comma separate to run both:
  // `--dir probes,yours` is the one command that re-checks everything.
  probeDirs: (option('--dir') ?? process.env.PROBE_DIR ?? 'probes')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => path.resolve(PROBE_HOME, d)),

  // Used only to answer "is anything serving HTTP here yet". Any response at
  // all counts, including a 404 — your app does not need a health endpoint.
  healthPath: withSlash(process.env.PROBE_HEALTH ?? '/health'),

  loginPath: withSlash(process.env.PROBE_LOGIN ?? '/api/login'),
  sessionCookie: process.env.PROBE_SESSION_COOKIE ?? 'session',
  users: parseUsers(process.env.PROBE_USERS),

  // Static probes read the repository rather than the running app. By default
  // that is whatever directory `probe/` sits in, so copying `probe/` into your
  // project is enough.
  repoRoot: path.resolve(process.env.PROBE_REPO ?? path.join(PROBE_HOME, '..')),
})
