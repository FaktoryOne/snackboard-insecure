// Tiny HTTP helper for probes. No dependencies — Node has fetch built in.
//
// Nothing here is Snackboard-specific. The target, the login path and the
// session cookie name all come from `config.mjs`, so the same helper works
// against your own app. See probe/README.md.

import { CONFIG } from './config.mjs'

export const TARGET = CONFIG.target

/**
 * Send a request to the target and return everything a probe needs to judge
 * the result: status, headers, parsed body (when it is JSON) and raw text.
 *
 * `session` is what `loginAs` handed back, or null for an anonymous request.
 */
export async function request(method, path, { session = null, body = null } = {}) {
  const headers = {}
  if (body !== null) headers['Content-Type'] = 'application/json'
  Object.assign(headers, authHeaders(session))

  const res = await fetch(`${TARGET}${path}`, {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // Not JSON. `text` is still available to the probe.
  }
  return { status: res.status, headers: res.headers, text, json }
}

export const get = (path, opts) => request('GET', path, opts)
export const post = (path, body, opts) => request('POST', path, { ...opts, body })
export const del = (path, opts) => request('DELETE', path, opts)

/**
 * A session is carried either in a cookie or in an `Authorization: Bearer`
 * header. A plain string is a cookie value, which is what Snackboard uses and
 * what every probe in `probes/` was written against.
 */
function authHeaders(session) {
  if (!session) return {}
  if (typeof session === 'string') return { Cookie: `${CONFIG.sessionCookie}=${session}` }
  if (session.bearer) return { Authorization: `Bearer ${session.bearer}` }
  if (session.cookie) return { Cookie: session.cookie }
  throw new Error(`unrecognised session: ${JSON.stringify(session)}`)
}

const TOKEN_FIELDS = ['token', 'access_token', 'accessToken', 'jwt', 'sessionToken']

/**
 * Log in and return something `request` can authenticate with. Throws if the
 * credentials are wrong or no session comes back, so a broken probe run fails
 * loudly instead of silently testing nothing — an authorization probe that
 * runs anonymously goes green against a vulnerable app, which is the worst
 * outcome available.
 */
export async function loginAs(email, password) {
  const res = await fetch(`${TARGET}${CONFIG.loginPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error(`login failed for ${email}: HTTP ${res.status} from ${CONFIG.loginPath}`)
  }

  const setCookie = res.headers.get('set-cookie') ?? ''
  const name = CONFIG.sessionCookie.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Anchored on a delimiter so a cookie called `csrf_session` cannot be read
  // as `session` when both are set.
  const cookie = setCookie.match(new RegExp(`(?:^|[;,]\\s*)${name}=([^;,\\s]+)`))
  if (cookie) return cookie[1]

  // No cookie. A token in the response body is the other common shape.
  let body = null
  try {
    body = await res.json()
  } catch {
    // not JSON
  }
  const field = TOKEN_FIELDS.find((f) => typeof body?.[f] === 'string')
  if (field) return { bearer: body[field] }

  throw new Error(
    `login for ${email} returned no "${CONFIG.sessionCookie}" cookie and no token field. ` +
      `Set PROBE_SESSION_COOKIE to your cookie name, or PROBE_USERS=none if your probes ` +
      `do not need an identity.`,
  )
}

/**
 * Wait until something is serving HTTP at the target, or give up.
 *
 * Any response counts, including a 404 — the question is "is the app up", not
 * "does it have a health endpoint". Your own app almost certainly does not
 * have one, and that must not read as "could not reach the app".
 */
export async function waitForTarget({ timeoutMs = 20000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(`${TARGET}${CONFIG.healthPath}`)
      return true
    } catch {
      // Nothing listening yet. A refused connection is the only "down".
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}
